/**
 *
 */

angular.module('app')
    .factory('Product', function ($rootScope, $resource, $q, URLS, EVENTS, LIFECYCLE_STATUS, User, $location) {

        var messageTemplate = 'The product <strong>{{ name }}</strong> was {{ action }} successfully.';

        var Product, service = {

            TYPES: {
                PRODUCT: 'Product',
                PRODUCT_BUNDLE: 'Product Bundle'
            },

            list: function list(role, filters) {
                var deferred = $q.defer(), params = {};

                if (angular.isObject(filters)) {

                    if (filters.status) {
                        params['lifecycleStatus'] = filters.status;
                    }
                }

                switch (role) {
                case User.ROLES.CUSTOMER:
                    break;
                case User.ROLES.SELLER:
                    params['relatedParty.id'] = User.current.id;
                    break;
                }

                Resource.query(params, function (productList) {
                    deferred.resolve(productList);
                });

                return deferred.promise;
            },

            create: function create(data) {
                var deferred = $q.defer();

                angular.extend(data, {
                    lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                    isBundle: !!data.bundledProductSpecification.length,
                    bundledProductSpecification: data.bundledProductSpecification.map(function (product) {
                        return Resource.serialize(product);
                    }),
                    relatedParty: [{
                        id: User.current.id,
                        href: $location.protocol() + '://' + $location.host() + ':' + $location.port() + User.current.href,
                        role: 'Owner'
                    }]
                });

                Resource.save(data, function (productCreated) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', messageTemplate, {
                        name: productCreated.name,
                        action: 'created'
                    });

                    deferred.resolve(productCreated);
                });

                return deferred.promise;
            },

            get: function get(productId) {
                var deferred = $q.defer(), params = {
                    productId: productId
                };

                Resource.get(params, function (productRetrieved) {
                    deferred.resolve(productRetrieved);
                });

                return deferred.promise;
            },

            update: function update(product, next) {
                var deferred = $q.defer(), params = {
                    productId: product.id
                };

                Resource.update(params, product, function (productUpdated) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', messageTemplate, {
                        name: productUpdated.name,
                        action: 'updated'
                    });

                    deferred.resolve(productUpdated);
                });

                return deferred.promise;
            },

            serialize: function serialize(product) {
                return {id: product.id, href: product.href};
            },

            getPictureOf: function getPictureOf(product) {
                var i, src = "";

                if (angular.isArray(product.attachment)) {
                    for (i = 0; i < product.attachment.length && !src.length; i++) {
                        if (product.attachment[i].type == 'Picture') {
                            src = $product.attachment[i].url;
                        }
                    }
                }

                return src;
            },

            getBundledProductOf: function getBundledProductOf(product, next) {
                var deferred = $q.defer(), params;

                if (product.isBundle) {
                    params = {
                        'relatedParty.id': User.current.id,
                        'id': product.bundledProductSpecification.map(function (data) {
                            return data.id;
                        }).join()
                    };

                    Resource.query(params, function (productList) {
                        product.bundledProductSpecification = productList;
                        deferred.resolve(productList);
                    });
                } else {

                    if (!angular.isArray(product.bundledProductSpecification)) {
                        product.bundledProductSpecification = [];
                    }

                    deferred.resolve(product.bundledProductSpecification);
                }

                return deferred.promise;
            }

        };

        Resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/productSpecification/:productId', {productId: '@id'}, {
            update: {method:'PUT'}
        });

        return service;
    });
