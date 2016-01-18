/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Category', CategoryService);

    function CategoryService($q, $resource, URLS) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/category/:categoryId', {
            categoryId: '@id'
        });

        var dataCached = {
            roots: {},
            subcategories: {}
        };

        resource.prototype.serialize = serialize;

        return {
            search: search,
            detail: detail,
            getBreadcrumbOf: getBreadcrumbOf
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.categoryId) {
                params['parentId'] = filters.categoryId;
            } else {
                params['isRoot'] = true;
            }

            resource.query(params, function (categoryList) {
                categoryList.forEach(function (category) {
                    saveCategory(category);
                });
                deferred.resolve(categoryList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(categoryId) {
            var deferred = $q.defer();
            var params = {
                categoryId: categoryId
            };

            resource.get(params, function (category) {
                saveCategory(category);
                deferred.resolve(category);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function saveCategory(category) {
            dataCached[category.isRoot ? 'roots' : 'subcategories'][category.id] = category;
        }

        function getBreadcrumbOf(categoryId) {
            var deferred = $q.defer();
            var breadcrumb = [];

            if (categoryId) {
                findParent(categoryId);
            } else {
                deferred.resolve(breadcrumb);
            }

            return deferred.promise;

            function findParent(categoryId) {

                if (categoryId in dataCached.roots) {
                    breadcrumb.unshift(dataCached.roots[categoryId]);
                    deferred.resolve(breadcrumb);
                } else if (categoryId in dataCached.subcategories) {
                    breadcrumb.unshift(dataCached.subcategories[categoryId]);
                    findParent(dataCached.subcategories[categoryId].parentId);
                } else {
                    detail(categoryId).then(function (category) {
                        findParent(category.id);
                    });
                }
            }
        }

        function serialize() {
            /* jshint validthis: true */
            return {
                id: this.id,
                href: this.href,
                //version: this.version,
                //name: this.name
            };
        }
    }

})();
