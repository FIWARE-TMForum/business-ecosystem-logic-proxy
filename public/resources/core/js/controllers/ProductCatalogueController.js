/**
 * 
 */

angular.module('app.controllers')
    .controller('CatalogueListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', 'User', function ($scope, $rootScope, EVENTS, Catalogue, User) {

        $scope.$catalogueList = Catalogue.$collection;
        $scope.$catalogueActive = null;

        $scope.refreshList = function refreshList() {
            $scope.$categoryActive = null;
            Catalogue.list();
            $rootScope.$broadcast(EVENTS.CATALOGUE_SHOW, null);
        };

        $scope.showCatalogue = function showCatalogue($catalogue) {
            $scope.$catalogueActive = $catalogue;
            $rootScope.$broadcast(EVENTS.CATALOGUE_SHOW, $catalogue);
        };

        $scope.isActive = function isActive($catalogue) {
            return angular.equals($scope.$catalogueActive, $catalogue);
        };

        $scope.filterByRoleOwner = function filterByRoleOwner() {
            return $scope.$catalogueList.filter(function ($catalogue) {
                return Catalogue.hasRoleAs($catalogue, User.ROLES.OWNER);
            });
        };

        $scope.filterByRoleSeller = function filterByRoleSeller() {
            return $scope.$catalogueList.filter(function ($catalogue) {
                return Catalogue.hasRoleAs($catalogue, User.ROLES.SELLER);
            });
        };

        $scope.showCreateForm = function showCreateForm() {
            $rootScope.$broadcast(EVENTS.CATALOGUE_CREATEFORM_SHOW);
        };

        $scope.$on(EVENTS.CATALOGUE_SELECT, function ($event, $catalogue) {
            $scope.showCatalogue($catalogue);
        });
    }])
    .controller('CatalogueDetailCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', 'Offering', function ($scope, $rootScope, EVENTS, Catalogue, Offering) {

        $scope.$catalogue = null;
        $scope.activeView = 'OfferingView';
        $scope.$catalogueOfferingList = Offering.$collection;

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
            Offering.list($catalogue);
        });
    }])
    .controller('CatalogueCreateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', '$element', function ($scope, $rootScope, EVENTS, Catalogue, $element) {
        var initialInfo = {};

        $scope.createCatalogue = function createCatalogue() {
            Catalogue.create($scope.catalogueInfo, function ($catalogueCreated) {
                $element.modal('hide');
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
            });
        };

        $scope.showTab = function showTab($index) {
            $scope.tabs.forEach(function (tab) {
                tab.active = false;
            });
            $scope.tabs[$index].active = true;
        };

        $scope.$on(EVENTS.CATALOGUE_UPDATEFORM_SHOW, function ($event, $catalogue) {
            angular.copy($catalogue, $scope.$catalogue);
            $scope.showTab(0);
            $element.modal('show');
        });
    }])
    .controller('CatalogueView', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', function ($scope, $rootScope, EVENTS, Catalogue) {
        Catalogue.list(function ($catalogueList) {
            $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, $catalogueList.length ? $catalogueList[0] : null);
        });
    }]);
