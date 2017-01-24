/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('ProductOrder', ProductOrderService);

    function ProductOrderService($q, $resource, URLS, User, Offering, BillingAccount) {
        var resource = $resource(URLS.PRODUCTORDER_MANAGEMENT + '/productOrder/:productOrderId', {
            productOrderId: '@id'
        }, {
            updatePartial: {
                method: 'PATCH'
            }
        });

        resource.prototype.getCustomer = getCustomer;
        resource.prototype.getRoleOf = getRoleOf;
        resource.prototype.getPriceplanOf = getPriceplanOf;
        resource.prototype.formatPriceplanOf = formatPriceplanOf;
        resource.prototype.getBillingAccount = function getBillingAccount() {
            return this.orderItem[0].billingAccount[0];
        };

        var TYPES = {
            PRIORITY: [
                /* 0 */{title: '0 (the highest)'},
                /* 1 */{title: '1'},
                /* 2 */{title: '2'},
                /* 3 */{title: '3'},
                /* 4 */{title: '4 (the lowest)'}
            ]
        };

        var Comment = function Comment(author) {
            this.author = author;
            this.notes = [];
        };
        Comment.prototype.appendNote = function appendNote(date, text) {
            this.notes.push({
                date: date,
                text: text
            });
        };

        return {
            TYPES: TYPES,
            Comment: Comment,
            search: search,
            count: count,
            create: create,
            detail: detail,
            update: update
        };

        function query(filters, deferred, method, callback) {

            var params = {};

            if (filters.owner) {
                params['relatedParty.id'] = User.loggedUser.id;
            }

            if (filters.status) {
                params['state'] = filters.status;
            }

            if (filters.action) {
                params['action'] = filters.action;
            }

            if (filters.offset !== undefined) {
                params['offset'] = filters.offset;
                params['size'] = filters.size;
            }

            if (filters.role) {
                params['relatedParty.role'] = filters.role;
            }

            method(params, callback, function (response) {
                deferred.reject(response);
            });
        }

        function search(filters) {
            var deferred = $q.defer();

            query(filters, deferred, resource.query, function (productOrderList) {
                var productOfferingFilters = {};

                if (productOrderList.length) {
                    productOfferingFilters.id = getProductOfferingIds(productOrderList).join();

                    Offering.search(productOfferingFilters).then(function (productOfferingList) {
                        replaceProductOffering(productOrderList, productOfferingList);
                        deferred.resolve(productOrderList);
                    });
                } else {
                    deferred.resolve(productOrderList);
                }
            });

            return deferred.promise;

            function getProductOfferingIds(productOrderList) {
                var productOfferingIds = {};

                productOrderList.forEach(function (productOrder) {
                    productOrder.orderItem.forEach(function (orderItem) {
                        productOfferingIds[orderItem.productOffering.id] = {};
                    });
                });

                return Object.keys(productOfferingIds);
            }

            function replaceProductOffering(productOrderList, productOfferingList) {
                var productOfferings = {};

                productOfferingList.forEach(function (productOffering) {
                    productOfferings[productOffering.id] = productOffering;
                });

                productOrderList.forEach(function (productOrder) {
                    productOrder.orderItem.forEach(function (orderItem) {
                        orderItem.productOffering = productOfferings[orderItem.productOffering.id];
                    });
                });
            }
        }

        function count(filters) {
            filters.action = 'count';
            var deferred = $q.defer();

            query(filters, deferred, resource.get, function (info) {
                deferred.resolve(info);
            });

            return deferred.promise;
        }

        function create(orderInfo) {
            var deferred = $q.defer();

            resource.save(orderInfo, function (orderCreated, getResponseHeaders) {
                deferred.resolve({
                    order: orderCreated,
                    headers:getResponseHeaders()
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                productOrderId: id
            };

            resource.get(params, function (productOrder) {

                // Remove empty characteristics
                productOrder.orderItem.forEach(function(item) {
                    if (item.product.productCharacteristic.length === 1 &&
                            Object.keys(item.product.productCharacteristic[0]).length === 0) {

                        item.product.productCharacteristic = [];
                    }
                });

                detailBillingAccount(productOrder);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function detailBillingAccount(productOrder) {
                BillingAccount.detail(productOrder.getBillingAccount().id).then(function (billingAccount) {
                    extendBillingAccount(productOrder, billingAccount);
                    detailProductOffering(productOrder);
                }, function (response) {
                    deferred.reject(response);
                });
            }

            function detailProductOffering(productOrder) {
                var filters = {
                    id: getProductOfferingIds(productOrder)
                };

                Offering.search(filters).then(function (productOfferings) {
                    replaceProductOffering(productOrder, productOfferings);
                    deferred.resolve(productOrder);
                });
            }
        }

        function extendBillingAccount(productOrder, billingAccount) {
            productOrder.orderItem.forEach(function (orderItem) {
                orderItem.billingAccount = billingAccount;
            });
        }

        function update(productOrder, dataUpdated) {
            var deferred = $q.defer();
            var params = {
                productOrderId: productOrder.id
            };

            resource.updatePartial(params, dataUpdated, function (productOrderUpdated) {
                var productOfferingFilters = {
                    id: getProductOfferingIds(productOrderUpdated).join()
                };

                Offering.search(productOfferingFilters).then(function (productOfferingList) {
                    replaceProductOffering(productOrderUpdated, productOfferingList);
                    deferred.resolve(productOrderUpdated);
                });

            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function getProductOfferingIds(productOrder) {
            var productOfferingIds = {};

            productOrder.orderItem.forEach(function (orderItem) {
                productOfferingIds[orderItem.productOffering.id] = {};
            });

            return Object.keys(productOfferingIds);
        }

        function replaceProductOffering(productOrder, productOfferingList) {
            var productOfferings = {};

            productOfferingList.forEach(function (productOffering) {
                productOfferings[productOffering.id] = productOffering;
            });

            productOrder.orderItem.forEach(function (orderItem) {
                orderItem.productOffering = productOfferings[orderItem.productOffering.id];
            });
        }

        function getCustomer() {
            /* jshint validthis: true */
            var i, user;

            for (i = 0; i < this.relatedParty.length && !user; i++) {
                if (this.relatedParty[i].role === 'Customer') {
                    user = this.relatedParty[i];
                }
            }

            return user;
        }

        function getRoleOf(userId) {
            /* jshint validthis: true */
            var i, role;

            for (i = 0; i < this.relatedParty.length && !role; i++) {
                if (this.relatedParty[i].id == userId) {
                    role = this.relatedParty[i].role;
                }
            }

            return role;
        }

        function getPriceplanOf(orderIndex) {
            /* jshint validthis: true */
            return this.orderItem[orderIndex].product.productPrice[0];
        }

        function formatPriceplanOf(orderIndex) {
            var result, priceplan, priceplans = this.orderItem[orderIndex].product.productPrice;

            if (priceplans.length) {
                priceplan = priceplans[0];
                result = priceplan.price.amount + " " + priceplan.price.currency;
                switch (priceplan.priceType) {
                case Offering.TYPES.PRICE.RECURRING:
                    result += " / " + priceplan.recurringChargePeriod;
                    break;
                case Offering.TYPES.PRICE.USAGE:
                    result += " / " + priceplan.unitOfMeasure;
                    break;
                }
            } else {
                result = "Free";
            }

            return result;
        }
    }

})();
