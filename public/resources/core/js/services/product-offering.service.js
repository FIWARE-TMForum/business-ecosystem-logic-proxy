/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Offering', OfferingService);

    function OfferingService($q, $resource, URLS, LIFECYCLE_STATUS, User, Product) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogue/:catalogueId/productOffering/:offeringId', {
            offeringId: '@id'
        }, {
            update: {
                method: 'PUT'
            }
        });

        resource.prototype.getPicture = getPicture;

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
            var params = {}, productFilters = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.catalogueId) {
                params.catalogue = 'catalog';
                params.catalogueId = filters.catalogueId;
            }

            if (filters.status) {
                params['lifecycleStatus'] = filters.status;
            }

            if (filters.type) {
                params['isBundle'] = filters.type == 'Bundle';
            }

            if (filters.owner) {
                productFilters['owner'] = true;

                Product.search(productFilters).then(function (productList) {
                    var products = {};

                    if (productList.length) {
                        params['productSpecification.id'] = productList.map(function (product) {
                            products[product.id] = product;
                            return product.id;
                        }).join();

                        resource.query(params, function (offeringList) {
                            offeringList.forEach(function (offering) {
                                offering.productSpecification = products[offering.productSpecification.id];
                            });
                            deferred.resolve(offeringList);
                        });
                    } else {
                        deferred.resolve([]);
                    }
                });
            } else {
                params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;

                resource.query(params, function (offeringList) {

                    if (offeringList.length) {
                        productFilters.id = offeringList.map(function (offering) {
                            return offering.productSpecification.id;
                        }).join();

                        Product.search(productFilters).then(function (productList) {
                            productList.forEach(function (product) {
                                offeringList.some(function (offering) {

                                    if (offering.productSpecification.id == product.id) {
                                        offering.productSpecification = product;
                                        return true;
                                    }
                                });
                            });
                            deferred.resolve(offeringList);
                        });
                    } else {
                        deferred.resolve(offeringList);
                    }
                });
            }

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function (offeringList) {
                deferred.resolve(!!offeringList.length);
            });

            return deferred.promise;
        }

        function create(data, product, catalogue) {
            var deferred = $q.defer();
            var params = {
                catalogue: 'catalog',
                catalogueId: catalogue.id
            };

            angular.extend(data, {
                productSpecification: product.serialize()
            });

            resource.save(params, data, function (offeringCreated) {
                offeringCreated.productSpecification = product;
                deferred.resolve(offeringCreated);
            });

            return deferred.promise;
        }

        function detail(offeringId) {
            var deferred = $q.defer();
            var params = {
                id: offeringId
            };

            resource.query(params, function (offeringList) {

                if (offeringList.length) {
                    var offeringRetrieved = offeringList[0];

                    Product.detail(offeringRetrieved.productSpecification.id).then(function (productRetrieved) {
                        offeringRetrieved.productSpecification = productRetrieved;
                        deferred.resolve(offeringRetrieved);
                    });
                } else {
                    deferred.reject(404);
                }
            });

            return deferred.promise;
        }

        function update(offering) {
            var deferred = $q.defer();
            var params = {
                catalogue: 'catalog',
                catalogueId: getCatalogueId(offering),
                offeringId: offering.id
            };
            var product = offering.productSpecification;

            offering.productSpecification = product.serialize();

            resource.update(params, offering, function (offeringUpdated) {
                offeringUpdated.productSpecification = product;
                deferred.resolve(offeringUpdated);
            });

            return deferred.promise;
        }

        function getCatalogueId(offering) {
            var keys = offering.href.split('/');
            return keys[keys.indexOf('catalog') + 1];
        }

        function buildInitialData() {
            return {
                version: '0.1',
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                isBundle: false
            };
        }

        function getPicture() {
            return this.productSpecification.getPicture();
        }
    }

})();
