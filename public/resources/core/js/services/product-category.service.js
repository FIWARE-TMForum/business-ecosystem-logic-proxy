/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function() {
    'use strict';

    angular.module('app').factory('Category', ['$q', '$resource', 'URLS', 'LIFECYCLE_STATUS', CategoryService]);

    function CategoryService($q, $resource, URLS, LIFECYCLE_STATUS) {
        var resource = $resource(
            URLS.CATALOGUE_MANAGEMENT + '/category/:categoryId',
            {
                categoryId: '@id'
            },
            {
                update: {
                    method: 'PATCH'
                }
            }
        );

        var dataCached = {
            roots: {},
            subcategories: {}
        };

        var PATCHEABLE_ATTRS = ['name', 'description'];

        resource.prototype.getBreadcrumb = getBreadcrumb;
        resource.prototype.serialize = serialize;

        return {
            search: search,
            exists: exists,
            create: create,
            detail: detail,
            update: update,
            initiate: initiate,
            PATCHEABLE_ATTRS: PATCHEABLE_ATTRS
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (!filters.all) {
                if (filters.categoryId) {
                    params['parentId'] = filters.categoryId;
                } else {
                    params['isRoot'] = true;
                }
            }

            resource.query(
                params,
                function(categoryList) {
                    var i = 0;

                    categoryList.forEach(function(category) {
                        saveCategory(category);
                    });

                    if (!filters.all || !categoryList.length) {
                        deferred.resolve(categoryList);
                    } else {
                        categoryList.forEach(function(category) {
                            extendBreadcrumb(category).then(function() {
                                i++;
                                if (i === categoryList.length) {
                                    deferred.resolve(categoryList);
                                }
                            });
                        });
                    }
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function(categoryList) {
                deferred.resolve(!!categoryList.length);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();

            resource.save(
                data,
                function(categoryCreated) {
                    deferred.resolve(categoryCreated);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function detail(categoryId, callExtendBreadcrumb) {
            var deferred = $q.defer();
            var params = {
                categoryId: categoryId
            };

            if (typeof callExtendBreadcrumb !== 'boolean') {
                callExtendBreadcrumb = true;
            }

            resource.get(
                params,
                function(categoryRetrieved) {
                    saveCategory(categoryRetrieved);
                    if (callExtendBreadcrumb) {
                        extendBreadcrumb(categoryRetrieved).then(function() {
                            deferred.resolve(categoryRetrieved);
                        });
                    } else {
                        deferred.resolve(categoryRetrieved);
                    }
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function update(categoryId, category) {
            var deferred = $q.defer();
            var params = {
                categoryId: categoryId
            };

            resource.update(
                params,
                category,
                function(categoryUpdated) {
                    deferred.resolve(categoryUpdated);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function saveCategory(category) {
            dataCached[category.isRoot ? 'roots' : 'subcategories'][category.id] = category;
        }

        function extendBreadcrumb(category) {
            var deferred = $q.defer();

            if (category.isRoot) {
                deferred.resolve(category);
            } else {
                findParent(category.parentId);
            }

            return deferred.promise;

            function findParent(categoryId) {
                if (categoryId in dataCached.roots) {
                    deferred.resolve(category);
                } else if (categoryId in dataCached.subcategories) {
                    findParent(dataCached.subcategories[categoryId].parentId);
                } else {
                    detail(categoryId, false).then(function(categoryRetrieved) {
                        findParent(categoryRetrieved.id);
                    });
                }
            }
        }

        function getBreadcrumb() {
            /* jshint validthis: true */
            var breadcrumb = [];

            if (!this.isRoot) {
                findParent(this.parentId);
            }

            return breadcrumb;

            function findParent(categoryId) {
                if (categoryId in dataCached.roots) {
                    breadcrumb.unshift(dataCached.roots[categoryId]);
                } else if (categoryId in dataCached.subcategories) {
                    breadcrumb.unshift(dataCached.subcategories[categoryId]);
                    findParent(dataCached.subcategories[categoryId].parentId);
                }
            }
        }

        function serialize() {
            /* jshint validthis: true */
            return {
                id: this.id,
                href: this.href
                //version: this.version,
                //name: this.name
            };
        }

        function initiate() {
            return {
                version: '1.0',
                lifecycleStatus: LIFECYCLE_STATUS.LAUNCHED,
                name: '',
                description: '',
                isRoot: true
            };
        }
    }
})();
