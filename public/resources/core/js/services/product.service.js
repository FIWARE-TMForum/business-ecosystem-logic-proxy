/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Product', ProductService);

    function ProductService($q, $resource, URLS, LIFECYCLE_STATUS, User) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/productSpecification/:productId', {
            productId: '@id'
        }, {
            update: {
                method:'PUT'
            }
        });

        resource.prototype.getPicture = getPicture;
        resource.prototype.serialize = serialize;

        return {
            search: search,
            exists: exists,
            create: create,
            detail: detail,
            update: update,
            buildInitialData: buildInitialData
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.status) {
                params['lifecycleStatus'] = filters.status;
            }

            if (filters.owner) {
                params['relatedParty.id'] = User.loggedUser.id;
            }

            resource.query(params, function (productList) {
                deferred.resolve(productList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function (productList) {
                deferred.resolve(!!productList.length);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();

            angular.extend(data, {
                bundledProductSpecification: data.bundledProductSpecification.map(function (product) {
                    return product.serialize();
                })
            });

            resource.save(data, function (productCreated) {
                deferred.resolve(productCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(productId) {
            var deferred = $q.defer();
            var params = {
                productId: productId
            };

            resource.get(params, function (productRetrieved) {
                extendBundledProduct(productRetrieved);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function extendBundledProduct(product) {

                if (!angular.isArray(product.bundledProductSpecification)) {
                    product.bundledProductSpecification = [];
                }

                if (product.isBundle) {
                    var params = {
                        'relatedParty.id': User.loggedUser.id,
                        'id': product.bundledProductSpecification.map(function (data) {
                            return data.id;
                        }).join()
                    };

                    resource.query(params, function (productList) {
                        product.bundledProductSpecification = productList;
                        deferred.resolve(product);
                    }, function (response) {
                        deferred.reject(response);
                    });
                } else {
                    deferred.resolve(product);
                }
            }
        }

        function update(product) {
            var deferred = $q.defer();
            var params = {
                productId: product.id
            };

            resource.update(params, product, function (productUpdated) {
                deferred.resolve(productUpdated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function buildInitialData() {
            return {
                version: '0.1',
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                isBundle: false,
                bundledProductSpecification: [],
                productSpecCharacteristic: [],
                attachment: [
                    {
                        type: 'Picture'
                    }
                ],
                relatedParty: [
                    User.serialize()
                ]
            };
        }

        function serialize() {
            /* jshint validthis: true */
            return {
                id: this.id,
                href: this.href
            };
        }

        function getPicture() {
            /* jshint validthis: true */
            var i, src = "";

            if (angular.isArray(this.attachment)) {
                for (i = 0; i < this.attachment.length && !src; i++) {
                    if (this.attachment[i].type == 'Picture') {
                        src = this.attachment[i].url;
                    }
                }
            }

            return src;
        }
    }

})();
