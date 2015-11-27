/**
 *
 */

angular.module('app.services')
    .factory('Category', ['$resource', 'URLS', function ($resource, URLS) {
        var Category, service;

        service = {

            $collection: [],

            $collectionById: {},

            list: function list(next) {
                var params = {'isRoot': true, 'fields': 'name'};

                Category.query(params, function ($collection) {

                    $collection.forEach(function ($entry) {
                        if (!Array.isArray(service.$collectionById[$entry.id])) {
                            service.$collectionById[$entry.id] = [];
                        }
                    });

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            get: function get($category, next) {
                var params = {'parentId': $category.id, 'fields': 'name'};

                Category.query(params, function ($collection) {

                    $collection.forEach(function ($entry) {
                        if (!Array.isArray(service.$collectionById[$entry.id])) {
                            service.$collectionById[$entry.id] = [];
                        }
                    });

                    angular.copy($collection, service.$collectionById[$category.id]);

                    if (next != null) {
                        next(service.$collectionById[$category.id]);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Category = $resource(URLS.CATALOGUE_MANAGEMENT + '/category/:categoryId', {categoryId: '@id'}, {
        });

        return service;
    }]);
