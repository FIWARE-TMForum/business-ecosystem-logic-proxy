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
            return productSpec.productSpecificationRelationship.some(function (relationship) {
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
