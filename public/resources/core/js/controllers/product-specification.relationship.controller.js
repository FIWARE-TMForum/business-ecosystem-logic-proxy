/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
(function () {

    'use strict';

    angular
        .module('app')
        .controller('RelationshipCreateCtrl', RelationshipCreateController)
        .controller('RelationshipDeleteCtrl', RelationshipDeleteController);

    function RelationshipCreateController($controller, $rootScope, $scope, EVENTS, DATA_STATUS, LIFECYCLE_STATUS, Utils, ProductSpec) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.RELATIONSHIPS = ProductSpec.TYPES.RELATIONSHIP;
        vm.DATA_STATUS = DATA_STATUS;

        vm.status = DATA_STATUS.LOADING;
        vm.data = new ProductSpec.Relationship({}, vm.RELATIONSHIPS.MIGRATION.code);

        vm.create = create;
        vm.setProductSpec = setProductSpec;
        vm.hasRelationship = hasRelationship;

        ProductSpec.search({
            owner: true,
            status: LIFECYCLE_STATUS.LAUNCHED
        }).then(function (collection) {
            vm.status = DATA_STATUS.LOADED;
            vm.list = collection;
        }, function (response) {
            vm.status = DATA_STATUS.ERROR;
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve product specifications.');
        });

        function create($parentController) {
            vm.status = DATA_STATUS.LOADING;
            $parentController.createRelationship(vm.data).then(function (productSpec) {
                vm.status = DATA_STATUS.LOADED;
                vm.data = new ProductSpec.Relationship({}, vm.RELATIONSHIPS.MIGRATION.code);
            }, function (response) {
                vm.status = DATA_STATUS.ERROR;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the relationship.')
                });
            });
        }

        function hasRelationship(productSpec, relationshipProductSpec) {
            return productSpec.id === relationshipProductSpec.id || productSpec.productSpecificationRelationship.some(function (relationship) {
                return relationship.productSpec.id === relationshipProductSpec.id;
            });
        }

        function setProductSpec(productSpec) {
            vm.data = new ProductSpec.Relationship(productSpec, vm.data.type);
        }
    }

    function RelationshipDeleteController($rootScope, EVENTS, DATA_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.DATA_STATUS = DATA_STATUS;

        vm.status = DATA_STATUS.LOADED;

        vm.remove = remove;

        function remove($parentController, index) {
            vm.status = DATA_STATUS.LOADING;
            $parentController.removeRelationship(index).then(function (productSpec) {
                vm.status = DATA_STATUS.LOADED;
            }, function (response) {
                vm.status = DATA_STATUS.ERROR;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to remove the relationship.')
                });
            });
        }
    }

})();
