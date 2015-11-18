/**
 * 
 */

angular.module('app.controllers')
    .controller('CatalogueListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', 'LOGGED_USER', function ($scope, $rootScope, EVENTS, Catalogue, LOGGED_USER) {

        $scope.$catalogueList = Catalogue.$collection;
        $scope.$catalogueItem = null;

        $scope.select = function select($catalogue) {
            $scope.$catalogueItem = $catalogue;
            $rootScope.$broadcast(EVENTS.CATALOGUE_SHOW, $catalogue);
        };

        var hasRole = function hasRole($catalogue, partyRole, partyId) {
            return $catalogue.relatedParty.some(function (party) {
                return party.id == partyId && party.role == partyRole;
            });
        };

        $scope.isSelected = function isSelected($catalogue) {
            return $scope.$catalogueItem != null && angular.equals($scope.$catalogueItem, $catalogue);
        };

        $scope.hasRoleAsOwner = function hasRoleAsOwner($catalogue) {
            return $catalogue != null && hasRole($catalogue, Catalogue.ROLES.OWNER, LOGGED_USER.ID);
        };

        $scope.hasRoleAsSeller = function hasRoleAsSeller($catalogue) {
            return $catalogue != null && hasRole($catalogue, Catalogue.ROLES.SELLER, LOGGED_USER.ID);
        };

        $scope.filterByRoleOwner = function filterByRoleOwner() {
            return $scope.$catalogueList.filter(function ($catalogue) {
                return hasRole($catalogue, Catalogue.ROLES.OWNER, LOGGED_USER.ID);
            });
        };

        $scope.filterByRoleSeller = function filterByRoleSeller() {
            return $scope.$catalogueList.filter(function ($catalogue) {
                return hasRole($catalogue, Catalogue.ROLES.SELLER, LOGGED_USER.ID);
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

        $scope.update = function update() {
            Catalogue.update($scope.$catalogue, function ($catalogueUpdated) {
                $element.modal('hide');
            });
        };

        $scope.$on(EVENTS.CATALOGUE_UPDATEFORM_SHOW, function ($event, $catalogue) {
            $scope.$catalogue = $catalogue;
            $element.modal('show');
        });
    }])
    .controller('CatalogueView', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', 'User', function ($scope, $rootScope, EVENTS, Catalogue, User) {
        Catalogue.list(User.ROLES.SELLER, function ($catalogueList) {
            $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, $catalogueList.length ? $catalogueList[0] : null);
        });
    }]);
