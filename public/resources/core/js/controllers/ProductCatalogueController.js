/**
 * 
 */

angular.module('app.controllers')
    .controller('CatalogueListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', function ($scope, $rootScope, EVENTS, Catalogue) {

        $scope.$catalogueList = Catalogue.$collection;
        $scope.$catalogueActive = null;

        $scope.refreshList = function refreshList() {
            $scope.$catalogueActive = null;
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

        $scope.$on(EVENTS.CATALOGUE_SELECT, function ($event, $catalogue) {
            $scope.showCatalogue($catalogue);
        });
    }])
    .controller('CatalogueSearchCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', function ($scope, $rootScope, EVENTS, Catalogue) {

        $scope.$catalogueList = Catalogue.$collection;
        $scope.params = {};
        $scope.searchFailed = false;

        $scope.search = function search() {
            $scope.searchFailed = false;

            if ($scope.params.status || $scope.params.role) {
                Catalogue.filter($scope.params, function ($catalogueList) {
                    $scope.searchFailed = !$catalogueList.length;
                    $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, $catalogueList.length ? $catalogueList[0] : null);
                });
            } else {
                Catalogue.list(function ($catalogueList) {
                    $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, $catalogueList.length ? $catalogueList[0] : null);
                });
            }
        };

        $scope.showCreateForm = function showCreateForm() {
            $rootScope.$broadcast(EVENTS.CATALOGUE_CREATEFORM_SHOW);
        };
    }])
    .controller('CatalogueDetailCtrl', ['$scope', '$rootScope', 'EVENTS', 'PARTY_ROLES', 'Catalogue', 'Offering', function ($scope, $rootScope, EVENTS, PARTY_ROLES, Catalogue, Offering) {

        $scope.$catalogue = null;
        $scope.$catalogueOfferingList = Offering.$collection;

        $scope.tabs = [
            {title: 'Offerings', icon: 'fa-cube'},
            {title: 'Parties', icon: 'fa-user'}
        ];
        $scope.tabActive = 0;

        $scope.showView = function showView($index) {
            $scope.tabActive = $index;
        };

        $scope.showUpdateForm = function showUpdateForm() {
            $rootScope.$broadcast(EVENTS.CATALOGUE_UPDATEFORM_SHOW, $scope.$catalogue);
        };

        $scope.hasRoleAsOwner = function hasRoleAsOwner() {
            return $scope.$catalogue != null && Catalogue.hasRoleAs($scope.$catalogue, PARTY_ROLES.OWNER);
        };

        $scope.updateStatus = function updateStatus(lifecycleStatus) {
            Catalogue.updateStatus($scope.$catalogue, lifecycleStatus, function ($catalogueUpdated) {
                $scope.$catalogue = $catalogueUpdated;
                Offering.list($scope.$catalogue);
            });
        };

        $scope.$on(EVENTS.CATALOGUE_SHOW, function (event, $catalogue) {

            if (!$scope.$catalogue) {
                $scope.showView(0);
            }

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
