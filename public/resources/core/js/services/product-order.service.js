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

    function ProductOrderService($q, $resource, URLS, User, Offering) {
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

        function detail(productOrderId) {
            var deferred = $q.defer();
            var params = {
                productOrderId: productOrderId
            };

            resource.get(params, function (productOrderRetrieved) {
                var productOfferingFilters = {
                    id: getProductOfferingIds(productOrderRetrieved).join()
                };
                var billingAccountCompleted = false, offeringListCompleted = false;

                User.detail(function (userRetrived) {
                    replaceBillingAccount(productOrderRetrieved, userRetrived);
                    billingAccountCompleted = true;

                    if (billingAccountCompleted && offeringListCompleted) {
                        deferred.resolve(productOrderRetrieved);
                    }
                });

                Offering.search(productOfferingFilters).then(function (productOfferingList) {
                    replaceProductOffering(productOrderRetrieved, productOfferingList);
                    offeringListCompleted = true;

                    if (billingAccountCompleted && offeringListCompleted) {
                        deferred.resolve(productOrderRetrieved);
                    }
                });
                //deferred.resolve(productOrderRetrieved);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function replaceBillingAccount(productOrderRetrieved, user) {
                productOrderRetrieved.orderItem.forEach(function (orderItem) {
                    orderItem.billingAccount = user;
                });
            }
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
                case Offering.PRICE_TYPES.RECURRING:
                    result += " / " + priceplan.recurringChargePeriod;
                    break;
                case Offering.PRICE_TYPES.USAGE:
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
