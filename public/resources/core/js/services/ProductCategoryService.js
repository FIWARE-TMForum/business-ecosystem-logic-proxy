/**
 *
 */

angular.module('app.services')
    .factory('Category', ['$resource', 'URLS', function ($resource, URLS) {
        var Category, service;

        service = {

            $collection: [],

            list: function list(next) {
                return Category.query(function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Category = $resource(URLS.PRODUCT_CATEGORY, {categoryId: '@id'}, {
        });

        return service;
    }]);
