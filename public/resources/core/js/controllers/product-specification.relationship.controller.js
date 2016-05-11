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

    function RelationshipCreateController($controller, $rootScope, $scope, EVENTS, PROMISE_STATUS, LIFECYCLE_STATUS, Utils, ProductSpec) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.RELATIONSHIPS = ProductSpec.TYPES.RELATIONSHIP;
        vm.STATUS = PROMISE_STATUS;

        vm.data = new ProductSpec.Relationship({}, vm.RELATIONSHIPS.MIGRATION.code);

        vm.create = create;
        vm.setProductSpec = setProductSpec;
        vm.hasRelationship = hasRelationship;

        var searchPromise = ProductSpec.search({
            owner: true,
            status: LIFECYCLE_STATUS.LAUNCHED
        }).then(function (collection) {
            vm.list = collection;
        }, function (response) {
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve product specifications.');
        });

        Object.defineProperty(vm, 'status', {
            get: function () { return searchPromise != null ? searchPromise.$$state.status : -1; }
        });

        var createPromise = null;

        function create($parentController) {
            createPromise = $parentController.createRelationship(vm.data).then(function (productSpec) {
                vm.data = new ProductSpec.Relationship({}, vm.RELATIONSHIPS.MIGRATION.code);
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the relationship.')
                });
            });
        }

        Object.defineProperty(create, 'status', {
            get: function () { return createPromise != null ? createPromise.$$state.status : -1; }
        });

        function hasRelationship(productSpec, relationshipProductSpec) {
            return productSpec.id === relationshipProductSpec.id || productSpec.productSpecificationRelationship.some(function (relationship) {
                return relationship.productSpec.id === relationshipProductSpec.id;
            });
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
            removePromise = $parentController.removeRelationship(index).then(function (productSpec) {
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to remove the relationship.')
                });
            });
        }

        Object.defineProperty(remove, 'status', {
            get: function () { return removePromise != null ? removePromise.$$state.status : -1; }
        });
    }

})();
