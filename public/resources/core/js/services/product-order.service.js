/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

(function() {
    'use strict';

    angular
        .module('app')
        .factory('ProductOrder', [
            '$q',
            '$resource',
            'URLS',
            'User',
            'Offering',
            'BillingAccount',
            'Party',
            ProductOrderService
        ]);

    function ProductOrderService($q, $resource, URLS, User, Offering, BillingAccount, Party) {
        var resource = $resource(
            URLS.PRODUCTORDER_MANAGEMENT + '/productOrder/:productOrderId',
            {
                productOrderId: '@id'
            },
            {
                save: {
                    method: 'POST',
                    headers: {
                        'X-Terms-Accepted': 'True'
                    }
                },
                updatePartial: {
                    method: 'PATCH'
                }
            }
        );

        resource.prototype.getCustomer = getCustomer;
        resource.prototype.getItemSeller = getItemSeller;
        resource.prototype.getRoleOf = getRoleOf;
        resource.prototype.getPriceplanOf = getPriceplanOf;
        resource.prototype.formatPriceplanOf = formatPriceplanOf;
        /*resource.prototype.getBillingAccount = function getBillingAccount() {
            return this.productOrderItem[0].billingAccount[0];
        };*/

        var TYPES = {
            PRIORITY: [
                /* 0 */ { title: '0 (the highest)' },
                /* 1 */ { title: '1' },
                /* 2 */ { title: '2' },
                /* 3 */ { title: '3' },
                /* 4 */ { title: '4 (the lowest)' }
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
                params['relatedParty.id'] = User.loggedUser.currentUser.partyId;
            }

            if (filters.status) {
                params['state'] = filters.status;
            }

            if (filters.action) {
                params['action'] = filters.action;
            }

            if (filters.offset !== undefined) {
                params['offset'] = filters.offset;
                params['limit'] = filters.limit;
            }

            if (filters.role) {
                params['relatedParty.role'] = filters.role;
            }

            method(params, callback, function(response) {
                deferred.reject(response);
            });
        }

        function search(filters) {
            var deferred = $q.defer();

            query(filters, deferred, resource.query, function(productOrderList) {
                var productOfferingFilters = {};

                if (productOrderList.length) {
                    productOfferingFilters.href = getProductOfferingIds(productOrderList).join();

                    Offering.search(productOfferingFilters).then(function(productOfferingList) {
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

                productOrderList.forEach(function(productOrder) {
                    productOrder.productOrderItem.forEach(function(productOrderItem) {
                        productOfferingIds[productOrderItem.productOffering.id] = {};
                    });
                });

                return Object.keys(productOfferingIds);
            }

            function replaceProductOffering(productOrderList, productOfferingList) {
                var productOfferings = {};

                productOfferingList.forEach(function(productOffering) {
                    productOfferings[productOffering.id] = productOffering;
                });

                productOrderList.forEach(function(productOrder) {
                    productOrder.productOrderItem.forEach(function(productOrderItem) {
                        productOrderItem.productOffering = productOfferings[productOrderItem.productOffering.id];
                    });
                });
            }
        }

        function count(filters) {
            filters.action = 'count';
            var deferred = $q.defer();

            query(filters, deferred, resource.get, function(info) {
                deferred.resolve(info);
            });

            return deferred.promise;
        }

        function create(orderInfo) {
            var deferred = $q.defer();

            resource.save(
                orderInfo,
                function(orderCreated, getResponseHeaders) {
                    deferred.resolve({
                        order: orderCreated,
                        headers: getResponseHeaders()
                    });
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                productOrderId: id
            };

            resource.get(
                params,
                function(productOrder) {
                    // Remove empty characteristics
                    productOrder.productOrderItem.forEach(function(item) {
                        if (
                            item.product.productCharacteristic == null ||
                            (item.product.productCharacteristic.length === 1 &&
                            Object.keys(item.product.productCharacteristic[0]).length === 0)
                        ) {
                            item.product.productCharacteristic = [];
                        }
                    });

                    //detailBillingAccount(productOrder);
                    detailProductOffering(productOrder);
                    // -----
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;

            function detailBillingAccount(productOrder) {
                BillingAccount.detail(productOrder.getBillingAccount().id).then(
                    function(billingAccount) {
                        extendBillingAccount(productOrder, billingAccount);
                        detailProductOffering(productOrder);
                    },
                    function(response) {
                        deferred.reject(response);
                    }
                );
            }

            function detailProductOffering(productOrder) {
                const filters = {
                    href: getProductOfferingIds(productOrder)
                };

                Offering.search(filters).then(function(productOfferings) {
                    replaceProductOffering(productOrder, productOfferings);
                    deferred.resolve(productOrder);
                });
            }
        }

        function extendBillingAccount(productOrder, billingAccount) {
            productOrder.productOrderItem.forEach(function(productOrderItem) {
                productOrderItem.billingAccount = billingAccount;
            });
        }

        function update(productOrder, dataUpdated) {
            var deferred = $q.defer();
            var params = {
                productOrderId: productOrder.id
            };

            resource.updatePartial(
                params,
                dataUpdated,
                function(productOrderUpdated) {
                    var productOfferingFilters = {
                        id: getProductOfferingIds(productOrderUpdated).join()
                    };

                    Offering.search(productOfferingFilters).then(function(productOfferingList) {
                        replaceProductOffering(productOrderUpdated, productOfferingList);
                        deferred.resolve(productOrderUpdated);
                    });
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function getProductOfferingIds(productOrder) {
            var productOfferingIds = {};

            productOrder.productOrderItem.forEach(function(productOrderItem) {
                productOfferingIds[productOrderItem.productOffering.id] = {};
            });

            return Object.keys(productOfferingIds);
        }

        function replaceProductOffering(productOrder, productOfferingList) {
            var productOfferings = {};

            productOfferingList.forEach(function(productOffering) {
                productOfferings[productOffering.id] = productOffering;
            });

            productOrder.productOrderItem.forEach(function(productOrderItem) {
                productOrderItem.productOffering = productOfferings[productOrderItem.productOffering.id];
            });
        }

        function getPartyByRole(parties, role) {
            var i, user;

            for (i = 0; i < parties.length && !user; i++) {
                if (parties[i].role.toLowerCase() === role) {
                    user = parties[i];
                }
            }

            // Include name of the party
            if (!user.hasOwnProperty('name')) {
                // Set the id as value to avoid multiple calls while the first is being processing
                user.name = user.id;

                Party.getPartyName(user.href).then((name) => {
                    user.name = name;
                });
            }

            return user;
        }

        function getCustomer() {
            /* jshint validthis: true */
            return getPartyByRole(this.relatedParty, 'customer');
        }

        function getItemSeller(item) {
            /* jshint validthis: true */
            return getPartyByRole(item.product.relatedParty, 'seller');
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
            return this.productOrderItem[orderIndex].product.productPrice[0];
        }

        function formatPriceplanOf(orderIndex) {
            var result,
                priceplan,
                priceplans = this.productOrderItem[orderIndex].product.productPrice;

            if (priceplans && priceplans.length) {
                priceplan = priceplans[0];
                result = priceplan.price.taxIncludedAmount.value + ' ' + priceplan.price.taxIncludedAmount.unit;
                switch (priceplan.priceType) {
                    case Offering.TYPES.PRICE.RECURRING:
                        result += ' / ' + priceplan.recurringChargePeriod;
                        break;
                    case Offering.TYPES.PRICE.USAGE:
                        result += ' / ' + priceplan.unitOfMeasure;
                        break;
                }
            } else {
                result = 'Free';
            }

            return result;
        }
    }
})();
