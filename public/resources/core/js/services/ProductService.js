/**
 *
 */

angular.module('app.services')
    .factory('Product', ['$resource', 'URLS', 'User', 'LOGGED_USER', function ($resource, URLS, User, LOGGED_USER) {
        var Product, service;

        service = {

            $collection: [],

            list: function list(next) {
                var params = {};

                return Product.query(params, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Product = $resource(URLS.PRODUCT, {id: '@id'}, {
        });

        return service;
    }]);
