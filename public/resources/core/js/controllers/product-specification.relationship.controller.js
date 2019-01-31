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

    angular
        .module('app')
        .controller('RelationshipCreateCtrl', [
            '$controller',
            '$rootScope',
            '$scope',
            '$timeout',
            'EVENTS',
            'DATA_STATUS',
            'LIFECYCLE_STATUS',
            'Utils',
            'ProductSpec',
            RelationshipCreateController
        ])

        .controller('RelationshipDeleteCtrl', [
            '$rootScope',
            'EVENTS',
            'PROMISE_STATUS',
            'Utils',
            RelationshipDeleteController
        ]);

    function RelationshipCreateController(
        $controller,
        $rootScope,
        $scope,
        $timeout,
        EVENTS,
        DATA_STATUS,
        LIFECYCLE_STATUS,
        Utils,
        ProductSpec
    ) {
        /* jshint validthis: true */
        var vm = this;
        vm.offset = -1;
        vm.size = 0;
        vm.list = [];
        vm.searchInput = '';

        angular.extend(vm, $controller('FormMixinCtrl', { $scope: $scope }));

        vm.RELATIONSHIPS = ProductSpec.TYPES.RELATIONSHIP;
        vm.STATUS = DATA_STATUS;

        vm.data = new ProductSpec.Relationship({}, vm.RELATIONSHIPS.MIGRATION.code);

        vm.create = create;
        vm.setProductSpec = setProductSpec;
        vm.getElementsLength = getElementsLength;
        vm.hasRelationship = hasRelationship;
        vm.handleEnterKeyUp = handleEnterKeyUp;
        vm.launchSearch = launchSearch;

        function handleEnterKeyUp(event) {
            if (event.keyCode == 13) {
                $timeout(function() {
                    $('#relSearch').click();
                });
            }
        }

        function getParams() {
            var params = {
                owner: true,
                status: LIFECYCLE_STATUS.LAUNCHED
            };

            if (vm.searchInput.length) {
                params.body = vm.searchInput;
            }
            return params;
        }

        function getElementsLength() {
            var params = getParams();
            return ProductSpec.count(params);
        }

        function launchSearch() {
            vm.offset = -1;
            vm.reloadPager();
        }

        vm.list.status = vm.STATUS.LOADING;
        $scope.$watch(
            function() {
                return vm.offset;
            },
            function() {
                vm.list.status = vm.STATUS.LOADING;

                if (vm.offset >= 0) {
                    var params = getParams();
                    params.offset = vm.offset;
                    params.size = vm.size;

                    ProductSpec.search(params).then(
                        function(productList) {
                            angular.copy(productList, vm.list);
                            vm.list.status = vm.STATUS.LOADED;
                        },
                        function(response) {
                            vm.errorMessage = Utils.parseError(
                                response,
                                'Unexpected error trying to retrieve product specifications.'
                            );
                            vm.list.status = vm.STATUS.ERROR;
                        }
                    );
                }
            }
        );

        var createPromise = null;

        function create($parentController) {
            createPromise = $parentController.createRelationship(vm.data);
            createPromise.then(
                function(productSpec) {
                    vm.data = new ProductSpec.Relationship({}, vm.RELATIONSHIPS.MIGRATION.code);
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to create the relationship.')
                    });
                }
            );
        }

        Object.defineProperty(create, 'status', {
            get: function() {
                return createPromise != null ? createPromise.$$state.status : -1;
            }
        });

        function hasRelationship(productSpec, relationshipProductSpec) {
            return (
                productSpec.id === relationshipProductSpec.id ||
                productSpec.productSpecificationRelationship.some(function(relationship) {
                    return relationship.productSpec.id === relationshipProductSpec.id;
                })
            );
        }

        function setProductSpec(productSpec) {
            vm.data = new ProductSpec.Relationship(productSpec, vm.data.type);
        }
    }

    function RelationshipDeleteController($rootScope, EVENTS, PROMISE_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var removePromise = null;

        vm.STATUS = PROMISE_STATUS;

        vm.remove = remove;

        function remove($parentController, index) {
            removePromise = $parentController.removeRelationship(index);
            removePromise.then(
                function(productSpec) {},
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to remove the relationship.')
                    });
                }
            );
        }

        Object.defineProperty(remove, 'status', {
            get: function() {
                return removePromise != null ? removePromise.$$state.status : -1;
            }
        });
    }
})();
