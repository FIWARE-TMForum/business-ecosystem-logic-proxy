/**
 * 
 */

angular.module('app.controllers')
    .controller('CatalogueListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', function ($scope, $rootScope, EVENTS, Catalogue) {

        $scope.$catalogueList = Catalogue.$collection;
        $scope.$catalogueItem = null;

        $scope.select = function select($catalogue) {
            $scope.$catalogueItem = $catalogue;
            $rootScope.$broadcast(EVENTS.CATALOGUE_SHOW, $catalogue);
        };

        $scope.isSelected = function isSelected($catalogue) {
            return $scope.$catalogueItem != null && angular.equals($scope.$catalogueItem, $catalogue);
        };

        $scope.hasRoleAsOwner = function hasRoleAsOwner($catalogue) {
            return $catalogue != null && Catalogue.hasRoleAs($catalogue, Catalogue.ROLES.OWNER);
        };

        $scope.hasRoleAsSeller = function hasRoleAsSeller($catalogue) {
            return $catalogue != null && Catalogue.hasRoleAs($catalogue, Catalogue.ROLES.SELLER);
        };

        $scope.filterByRoleOwner = function filterByRoleOwner() {
            return $scope.$catalogueList.filter(function ($catalogue) {
                return Catalogue.hasRoleAs($catalogue, Catalogue.ROLES.OWNER);
            });
        };

        $scope.filterByRoleSeller = function filterByRoleSeller() {
            return $scope.$catalogueList.filter(function ($catalogue) {
                return Catalogue.hasRoleAs($catalogue, Catalogue.ROLES.SELLER);
            });
        };

        $scope.showCreateForm = function showCreateForm() {
            $rootScope.$broadcast(EVENTS.CATALOGUE_CREATEFORM_SHOW);
        };

        $scope.$on(EVENTS.CATALOGUE_SELECT, function ($event, $catalogue) {
            $scope.select($catalogue);
        });
    }])
    .controller('CatalogueDetailCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', function ($scope, $rootScope, EVENTS, Catalogue) {

        $scope.$catalogue = null;
        $scope.activeView = 'OfferingView';

        $scope.showOfferingView = function showOfferingView() {
            $scope.activeView = 'OfferingView';
        };

        $scope.showPartyView = function showPartyView() {
            $scope.activeView = 'PartyView';
        };

        $scope.showUpdateForm = function showUpdateForm() {
            $rootScope.$broadcast(EVENTS.CATALOGUE_UPDATEFORM_SHOW, $scope.$catalogue);
        };

        $scope.$on(EVENTS.CATALOGUE_SHOW, function (event, $catalogue) {
            $scope.showOfferingView();
            $scope.$catalogue = $catalogue;
        });
    }])
    .controller('CatalogueCreateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', '$element', function ($scope, $rootScope, EVENTS, Catalogue, $element) {
        var initialInfo = {};

        $scope.createCatalogue = function createCatalogue() {
            Catalogue.create($scope.catalogueInfo, function ($catalogueCreated) {
                $element.modal('hide');
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The catalogue <strong>{{ name }}</strong> was created successfully.', $catalogueCreated);
            });
        };

        $scope.resetCreateForm = function resetCreateForm() {
            $scope.catalogueInfo = angular.copy(initialInfo);
        };

        $scope.$on(EVENTS.CATALOGUE_CREATEFORM_SHOW, function ($event) {
            $scope.resetCreateForm();
            $element.modal('show');
        });

        $scope.resetCreateForm();
    }])
    .controller('CatalogueUpdateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', '$element', function ($scope, $rootScope, EVENTS, Catalogue, $element) {

        $scope.$catalogue = {};

        $scope.tabs = [
            {name: 'General'}
        ];

        $scope.updateCatalogue = function updateCatalogue() {
            Catalogue.update($scope.$catalogue, function ($catalogueUpdated) {
                $element.modal('hide');
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The catalogue <strong>{{ name }}</strong> was updated successfully.', $catalogueUpdated);
            });
        };

        $scope.showTab = function showTab($index) {
            $scope.tabs.forEach(function (tab) {
                tab.active = false;
            });
            $scope.tabs[$index].active = true;
        };

        $scope.$on(EVENTS.CATALOGUE_UPDATEFORM_SHOW, function ($event, $catalogue) {
            $scope.$catalogue = $catalogue;
            $scope.showTab(0);
            $element.modal('show');
        });
    }])
    .controller('CatalogueView', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', function ($scope, $rootScope, EVENTS, Catalogue) {
        Catalogue.list(function ($catalogueList) {
            $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, $catalogueList.length ? $catalogueList[0] : null);
        });
    }]);
