/**
 *
 */

angular.module('app.services')
    .factory('Offering', ['$resource', 'URLS', 'User', 'Product', 'LOGGED_USER', function ($resource, URLS, User, Product, LOGGED_USER) {
        var Offering, service;

        service = {

            STATUS: {
                ACTIVE: 'Active',
                LAUNCHED: 'Launched',
                RETIRED: 'Retired',
                OBSOLETE: 'Obsolete'
            },

            TYPES: {
                OFFERING: 'Offering',
                OFFERING_BUNDLE: 'Offering bundle'
            },

            $collection: [],

            list: function list(role, next) {
                var params = {};

                switch (role) {
                case User.ROLES.CUSTOMER:
                    break;
                case User.ROLES.SELLER:

                    Product.list(function ($productList) {
                        var products = {};

                        params['productSpecification.id'] = $productList.map(function ($product) {
                            products[$product.id] = $product;
                            return $product.id;
                        }).join();

                        Offering.query(params, function ($collection) {

                            angular.copy($collection, service.$collection);

                            service.$collection.forEach(function ($offering) {
                                $offering.productSpecification = products[$offering.productSpecification.id];
                            });

                            if (next != null) {
                                next(service.$collection);
                            }
                        }, function (response) {
                            // TODO: onfailure.
                        });
                    });

                    break;
                default:
                    // TODO: do nothing.
                }
            }

        };

        Offering = $resource(URLS.PRODUCT_OFFERING, {offeringId: '@id'}, {
        });

        return service;
    }]);
