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
        var ProductSpec = $resource(URLS.CATALOGUE_MANAGEMENT + '/productSpecification/:productSpecId', {
            productId: '@id'
        }, {
            update: {
                method:'PUT'
            }
        });

        var VALUE_TYPES = {
            STRING: 'String',
            NUMBER: 'Number',
            NUMBER_RANGE: 'Number range'
        };

        var EVENTS = {
            UPDATED: '$productSpecUpdated'
        };

        var TYPES = {
            RELATIONSHIP: {
                DEPENDENCY: {code: 'dependency', name: 'Dependency'},
                EXCLUSIVITY: {code: 'exclusivity', name: 'Exclusivity'},
                MIGRATION: {code: 'migration', name: 'Migration'},
                SUBSTITUTION: {code: 'substitution', name: 'Substitution'}
            }
        };

        var Relationship = function Relationship(productSpec, relationshipType) {
            this.productSpec = productSpec;
            this.type = relationshipType;
        };
        Relationship.prototype.parseType = function parseType() {
            for (var key in TYPES.RELATIONSHIP) {
                if (TYPES.RELATIONSHIP[key].code === this.type) {
                    return TYPES.RELATIONSHIP[key].name;
                }
            }
            return "";
        };
        Relationship.prototype.toJSON = function toJSON() {
            return {
                id: this.productSpec.id,
                href: this.productSpec.href,
                type: this.type
            };
        };

        ProductSpec.prototype.getPicture = getPicture;
        ProductSpec.prototype.getCharacteristicDefaultValue = getCharacteristicDefaultValue;
        ProductSpec.prototype.serialize = serialize;
        ProductSpec.prototype.appendRelationship = appendRelationship;
        ProductSpec.prototype.removeRelationship = removeRelationship;

        return {
            VALUE_TYPES: VALUE_TYPES,
            TYPES: TYPES,
            Relationship: Relationship,
            search: search,
            exists: exists,
            create: create,
            detail: detail,
            update: update,
            buildInitialData: buildInitialData,
            createCharacteristic: createCharacteristic,
            createCharacteristicValue: createCharacteristicValue
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

            ProductSpec.query(params, function (productSpecList) {
                deferred.resolve(productSpecList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            ProductSpec.query(params, function (productSpecList) {
                deferred.resolve(!!productSpecList.length);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();
            var bundledProductSpecification = data.bundledProductSpecification;

            data.productSpecCharacteristic.forEach(function (characteristic) {

                if (characteristic.valueType === VALUE_TYPES.NUMBER_RANGE) {
                    characteristic.valueType = VALUE_TYPES.NUMBER;
                }

                characteristic.valueType = characteristic.valueType.toLowerCase();
            });


            angular.extend(data, {
                bundledProductSpecification: data.bundledProductSpecification.map(function (productSpec) {
                    return productSpec.serialize();
                })
            });

            ProductSpec.save(data, function (productSpecCreated) {
                productSpecCreated.bundledProductSpecification = bundledProductSpecification;
                deferred.resolve(productSpecCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(id) {
            var params = {
                productSpecId: id
            };

            return ProductSpec.get(params)
                .$promise
                .then(detailBundled)
                .then(detailRelationship);
        }

        function update(resource, dataUpdated) {
            var params = {
                productSpecId: resource.id
            };

            return ProductSpec.update(params, angular.extend(resource.toJSON(), {
                    bundledProductSpecification: resource.bundledProductSpecification.map(function (productSpec) {
                        return productSpec.serialize();
                    })
                }, dataUpdated))
                .$promise
                .then(detailBundled)
                .then(detailRelationship);
        }

        function detailBundled(resource) {

            if (!angular.isArray(resource.bundledProductSpecification)) {
                resource.bundledProductSpecification = [];
            }

            return resource.bundledProductSpecification.length ? extendBundled() : resource;

            function extendBundled() {
                var params = {
                    id: resource.bundledProductSpecification.map(function (data) {
                        return data.id;
                    }).join()
                };

                return ProductSpec.query(params)
                    .$promise
                    .then(function (collection) {
                        resource.bundledProductSpecification = collection;
                        return resource;
                    });
            }
        }

        function detailRelationship(resource) {

            if (!angular.isArray(resource.productSpecificationRelationship)) {
                resource.productSpecificationRelationship = [];
            }

            return resource.productSpecificationRelationship.length ? extendRelationship() : resource;

            function extendRelationship() {
                var params = {
                    id: resource.productSpecificationRelationship.map(function (data) {
                        return data.id;
                    }).join()
                };

                return ProductSpec.query(params)
                    .$promise
                    .then(function (collection) {
                        var collectionById = {};

                        collection.forEach(function (data) {
                            collectionById[data.id] = data;
                        });

                        resource.productSpecificationRelationship.forEach(function (data, index) {
                            resource.productSpecificationRelationship[index] = new Relationship(collectionById[data.id], data.type);
                        });
                        return resource;
                    });
            }
        }

        function appendRelationship(relationship) {
            /* jshint validthis: true */
            var dataUpdated = {
                productSpecificationRelationship: this.productSpecificationRelationship.concat(relationship)
            };

            return update(this, dataUpdated);
        }

        function removeRelationship(index) {
            /* jshint validthis: true */
            var dataUpdated = {
                productSpecificationRelationship: this.productSpecificationRelationship.slice(0)
            };

            dataUpdated.productSpecificationRelationship.splice(index, 1);

            return update(this, dataUpdated);
        }

        function buildInitialData() {
            return {
                version: '0.1',
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                isBundle: false,
                bundledProductSpecification: [],
                productSpecCharacteristic: [],
                productSpecificationRelationship: [],
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

        function createCharacteristic(initialInfo) {
            return angular.extend({
                name: "",
                description: "",
                valueType: VALUE_TYPES.STRING,
                configurable: false,
                productSpecCharacteristicValue: []
            }, initialInfo || {});
        }

        function createCharacteristicValue(data) {
            return angular.extend({
                default: false,
                unitOfMeasure: "",
                value: "",
                valueFrom: "",
                valueTo: ""
            }, data);
        }
    }

})();
