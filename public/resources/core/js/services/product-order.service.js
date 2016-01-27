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
        });

        resource.prototype.getCustomer = getCustomer;
        resource.prototype.getRoleOf = getRoleOf;
        resource.prototype.getPriceplanOf = getPriceplanOf;

        return {
            search: search,
            create: create
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (filters.owner) {
                params['relatedParty.id'] = User.loggedUser.id;
            }

            if (filters.role) {
                params['relatedParty.role'] = filters.role;
            }

            if (filters.status) {
                params['state'] = filters.status;
            }

            resource.query(params, function (productOrderList) {
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
    }

})();
