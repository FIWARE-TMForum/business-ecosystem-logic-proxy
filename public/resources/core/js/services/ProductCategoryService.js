/**
 *
 */

angular.module('app')
    .factory('Category', function ($resource, $q, URLS) {

        var Resource, service = {

            data: {
                roots: {},
                subcategories: {}
            },

            list: function list(filters) {
                var deferred = $q.defer(), params = {
                    fields: 'name,isRoot,parentId'
                };

                if (angular.isObject(filters) && filters.categoryId) {
                    params.parentId = filters.categoryId;
                } else {
                    params.isRoot = true;
                }

                Resource.query(params, function (categoryList) {

                    categoryList.forEach(function (category) {
                        service.data[category.isRoot ? 'roots' : 'subcategories'][category.id] = category;
                    });

                    deferred.resolve(categoryList);
                });

                return deferred.promise;
            },

            breadcrumbOf: function breadcrumbOf(categoryId) {
                var deferred = $q.defer();

                if (categoryId) {
                    _breadcrumbOf(deferred, [], categoryId);
                } else {
                    deferred.resolve([]);
                }

                return deferred.promise;
            }

        };

        var _breadcrumbOf = function _breadcrumbOf(deferred, categoryList, categoryId) {

            if (categoryId in service.data.roots) {
                categoryList.unshift(service.data.roots[categoryId]);
                deferred.resolve(categoryList);
            } else if (categoryId in service.data.subcategories) {
                categoryList.unshift(service.data.subcategories[categoryId]);
                _breadcrumbOf(deferred, categoryList, service.data.subcategories[categoryId].parentId);
            } else {
                var params = {
                    fields: 'name,isRoot,parentId',
                    categoryId: categoryId
                };

                Resource.get(params, function (category) {
                    service.data[category.isRoot ? 'roots' : 'subcategories'][category.id] = category;
                    _breadcrumbOf(deferred, categoryList, category.id);
                });
            }
        };

        Resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/category/:categoryId', {categoryId: '@id'}, {
        });

        return service;
    });
