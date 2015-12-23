/**
 *
 */

angular.module('app')
    .factory('Offering', function ($rootScope, $resource, $q, URLS, EVENTS, LIFECYCLE_STATUS, User, Product) {

        var messageTemplate = 'The offering <strong>{{ name }}</strong> was {{ action }} successfully.';

        var Offering, service = {

            TYPES: {
                OFFERING: 'Offering',
                OFFERING_BUNDLE: 'Offering bundle'
            },

            list: function list(role, filters) {
                var deferred = $q.defer(), params = {};

                if (angular.isObject(filters)) {

                    if (filters.catalogueId) {
                        params.catalogue = 'catalog';
                        params.catalogueId = filters.catalogueId;
                    }

                    if (filters.status) {
                        params.lifecycleStatus = filters.status;
                    }
                }

                switch (role) {
                case User.ROLES.CUSTOMER:
                    params.lifecycleStatus = LIFECYCLE_STATUS.LAUNCHED;

                    Offering.query(params, function (offeringList) {
                        var productFilters = {};

                        if (offeringList.length) {

                            productFilters.id = offeringList.map(function (offering) {
                                return offering.productSpecification.id;
                            }).join();

                            Product.list(role, productFilters).then(function (productList) {

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

                    break;
                case User.ROLES.SELLER:

                    Product.list(role).then(function (productList) {
                        var products = {};

                        if (productList.length) {

                            params['productSpecification.id'] = productList.map(function (product) {
                                products[product.id] = product;
                                return product.id;
                            }).join();

                            Offering.query(params, function (offeringList) {

                                offeringList.forEach(function (offering) {
                                    offering.productSpecification = products[offering.productSpecification.id];
                                });
                                deferred.resolve(offeringList);
                            });
                        } else {
                            deferred.resolve([]);
                        }
                    });
                }

                return deferred.promise;
            },

            create: function create(data, product, catalogue) {
                var deferred = $q.defer(), params = {
                    catalogue: 'catalog',
                    catalogueId: catalogue.id
                };

                angular.extend(data, {
                    lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                    productSpecification: Product.serialize(product)
                });

                Offering.save(params, data, function (offeringCreated) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', messageTemplate, {
                        name: offeringCreated.name,
                        action: 'created'
                    });

                    offeringCreated.productSpecification = product;
                    deferred.resolve(offeringCreated);
                });

                return deferred.promise;
            },

            get: function get(offeringId) {
                var deferred = $q.defer(), params = {
                    id: offeringId
                };

                Offering.query(params, function (catalogueList) {
                    deferred.resolve(catalogueList[0]);
                });

                return deferred.promise;
            },

            getProductPictureOf: function getProductPictureOf(offering) {
                return Product.getPictureOf(offering.productSpecification);
            }

        };

        Offering = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogue/:catalogueId/productOffering/:offeringId', {offeringId: '@id'}, {
        });

        return service;
    });
