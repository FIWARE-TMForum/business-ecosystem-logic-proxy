/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('ProductSpec', ProductSpecificationService);

    function ProductSpecificationService($q, $resource, URLS, LIFECYCLE_STATUS, User) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/productSpecification/:productSpecId', {
            productId: '@id'
        }, {
            update: {
                method:'PUT'
            }
        });

        resource.prototype.getPicture = getPicture;
        resource.prototype.getCharacteristicDefaultValue = getCharacteristicDefaultValue;
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

            if (filters.id) {
                params['id'] = filters.id;
            }

            if (filters.status) {
                params['lifecycleStatus'] = filters.status;
            }

            if (filters.owner) {
                params['relatedParty.id'] = User.loggedUser.id;
            }

            resource.query(params, function (productSpecList) {
                deferred.resolve(productSpecList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function (productSpecList) {
                deferred.resolve(!!productSpecList.length);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();
            var bundledProductSpecification = data.bundledProductSpecification;

            angular.extend(data, {
                bundledProductSpecification: data.bundledProductSpecification.map(function (productSpec) {
                    return productSpec.serialize();
                })
            });

            resource.save(data, function (productSpecCreated) {
                productSpecCreated.bundledProductSpecification = bundledProductSpecification;
                deferred.resolve(productSpecCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(productSpecId) {
            var deferred = $q.defer();
            var params = {
                productSpecId: productSpecId
            };

            resource.get(params, function (productSpecRetrieved) {
                extendBundledProductSpec(productSpecRetrieved).then(function (productSpecExtended) {
                    deferred.resolve(productSpecExtended);
                },function (response) {
                    deferred.reject(response);
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function extendBundledProductSpec(productSpec) {
            var deferred = $q.defer();

            if (!angular.isArray(productSpec.bundledProductSpecification)) {
                productSpec.bundledProductSpecification = [];
            }

            if (productSpec.isBundle) {
                search({
                    owner: true,
                    id: productSpec.bundledProductSpecification.map(function (data) {
                        return data.id;
                    }).join()
                }).then(function (productSpecList) {
                    productSpec.bundledProductSpecification = productSpecList;
                    deferred.resolve(productSpec);
                }, function (response) {
                    deferred.reject(response);
                });
            } else {
                deferred.resolve(productSpec);
            }

            return deferred.promise;
        }

        function update(productSpec) {
            var deferred = $q.defer();
            var params = {
                productSpecId: productSpec.id
            };
            var bundledProductSpecification = productSpec.bundledProductSpecification;

            angular.extend(productSpec, {
                bundledProductSpecification: productSpec.bundledProductSpecification.map(function (bundledProductSpec) {
                    return bundledProductSpec.serialize();
                })
            });

            resource.update(params, productSpec, function (productSpecUpdated) {
                productSpecUpdated.bundledProductSpecification = bundledProductSpecification;
                deferred.resolve(productSpecUpdated);
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

        function getCharacteristicDefaultValue(index) {
            var value, i;

            for (var i = 0; i < this.productSpecCharacteristic[index].productSpecCharacteristicValue.length; i++) {
                if (this.productSpecCharacteristic[index].productSpecCharacteristicValue[i].default) {
                    value = this.productSpecCharacteristic[index].productSpecCharacteristicValue[i];
                }
            }

            return value;
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

        function serialize() {
            /* jshint validthis: true */
            return {
                id: this.id,
                href: this.href
            };
        }
    }

})();
