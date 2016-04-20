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

        return {
            search: search,
            create: create,
            detail: detail,
            update: update
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (filters.owner) {
                params['relatedParty.id'] = User.loggedUser.id;
            }

            if (filters.status) {
                params['state'] = filters.status;
            }

            resource.query(params, function (productOrderList) {
                var productOfferingFilters = {};

                productOrderList = productOrderList.filter(function(ordering) {

                    return ordering.relatedParty.some(function(party) {
                       return party.role === filters.role && party.id === User.loggedUser.id;
                    });

                });

                if (productOrderList.length) {
                    productOfferingFilters.id = getProductOfferingIds(productOrderList).join();

                    Offering.search(productOfferingFilters).then(function (productOfferingList) {
                        replaceProductOffering(productOrderList, productOfferingList);
                        deferred.resolve(productOrderList);
                    });
                } else {
                    deferred.resolve(productOrderList);
                }
            }, function (response) {
                deferred.reject(response);
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
