/**
 *
 */

angular.module('app.controllers')
    .controller('OfferingListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Offering', function ($scope, $rootScope, EVENTS, Offering) {

        $scope.$offeringList = Offering.$collection;

        $scope.$offeringTypeList = Offering.TYPES;
        $scope.$offeringStatusList = Offering.STATUS;

        $scope.filters = {
            type: "",
            status: ""
        };

        $scope.getPicture = function getPicture($offering) {
            var i, src = "";

            if ('attachment' in $offering.productSpecification) {
                for (i = 0; i < $offering.productSpecification.attachment.length && !src.length; i++) {
                    if ($offering.productSpecification.attachment[i].type == 'Picture') {
                        src = $offering.productSpecification.attachment[i].url;
                    }
                }
            }

            return src;
        };

        $scope.filterList = function filterList() {
            Offering.filter($scope.filters, function ($offeringList) {});
        };
    }])
    .controller('OfferingCreateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Offering', '$element', 'Product', 'Catalogue', 'User', 'LOGGED_USER', function ($scope, $rootScope, EVENTS, Offering, $element, Product, Catalogue, User, LOGGED_USER) {
        var initialInfo = {version: '0.1', productSpecification: null};

        $scope.selectProduct = function selectProduct($product) {
            $scope.offeringInfo.productSpecification = $product;
        };

        $scope.isProductSelected = function isProductSelected($product) {
            return angular.equals($product, $scope.offeringInfo.productSpecification);
        };

        $scope.selectCatalogue = function selectCatalogue($catalogue) {
            $scope.catalogueInfo = $catalogue;
        };

        $scope.isCatalogueSelected = function isCatalogueSelected($catalogue) {
            return angular.equals($catalogue, $scope.catalogueInfo);
        };

        var catalogueInfo = null;

        $scope.createOffering = function createOffering() {
            Offering.create($scope.offeringInfo, $scope.catalogueInfo, function ($offeringCreated) {
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The offering <strong>{{ name }}</strong> was created successfully.', $offeringCreated);
                $rootScope.$broadcast(EVENTS.OFFERING_CREATE, $offeringCreated);
            });
        };

        $scope.stepList = [
            {name: 'General'},
            {name: 'Product'},
            {name: 'Catalogue'},
            {name: 'Finish'}
        ];

        $scope.setStepDisabled = function setStepDisabled($index) {
            return $index != $scope.stepActive && $index > $scope.stepValid;
        };

        $scope.nextStep = function nextStep($index) {
            $scope.stepActive = $index;
            $scope.stepValid = $index;
        };

        $scope.stepActive = 0;
        $scope.stepValid = 0;

        $scope.showStep = function showStep($index) {
            $scope.stepActive = $index;
        };

        $scope.resetCreateForm = function resetCreateForm() {
            $scope.offeringInfo = angular.copy(initialInfo);
        };

        var hasRole = function hasRole($catalogue, partyRole, partyId) {
            return $catalogue.relatedParty.some(function (party) {
                return party.id == partyId && party.role == partyRole;
            });
        };

        $scope.hasRoleAsOwner = function hasRoleAsOwner($catalogue) {
            return $catalogue != null && hasRole($catalogue, Catalogue.ROLES.OWNER, LOGGED_USER.ID);
        };

        $scope.hasRoleAsSeller = function hasRoleAsSeller($catalogue) {
            return $catalogue != null && hasRole($catalogue, Catalogue.ROLES.SELLER, LOGGED_USER.ID);
        };

        $scope.resetCreateForm();

        $scope.$productList = Product.$collection;
        Product.list();

        $scope.$catalogueList = Catalogue.$collection;
        Catalogue.list(User.ROLES.SELLER);
    }])
    .controller('OfferingView', ['$scope', '$rootScope', 'Offering', 'User', 'EVENTS', function ($scope, $rootScope, Offering, User, EVENTS) {

        $scope.createFormHidden = true;

        $scope.changeView = function changeView() {
            $scope.createFormHidden = !$scope.createFormHidden;
        };

        $scope.$on(EVENTS.OFFERING_CREATE, function ($event, $offering) {
            $scope.changeView();
        });

        Offering.list(User.ROLES.SELLER, function ($offeringList) {});
    }]);
