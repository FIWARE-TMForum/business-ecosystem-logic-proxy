/**
 *
 */

angular.module('app.controllers')
    .controller('OfferingListCtrl', ['$scope', '$rootScope', 'EVENTS', 'LIFECYCLE_STATUS', 'Offering', 'Product', function ($scope, $rootScope, EVENTS, LIFECYCLE_STATUS, Offering, Product) {

        $scope.$offeringList = Offering.$collection;

        $scope.$offeringTypeList = Offering.TYPES;
        $scope.$offeringStatusList = LIFECYCLE_STATUS;

        $scope.filters = {
            type: "",
            status: ""
        };

        $scope.getProductPicture = function getProductPicture($offering) {
            return Product.getPictureOf($offering.productSpecification);
        };

        $scope.filterList = function filterList() {
            Offering.filter($scope.filters, function ($offeringList) {});
        };

        $scope.orderItem = function orderItem(offering) {
            $rootScope.$broadcast(EVENTS.ORDER_ADDITION, offering);
        };
    }])
    .controller('OfferingCreateCtrl', ['$scope', '$rootScope', 'EVENTS', 'PARTY_ROLES', 'Offering', '$element', 'Product', 'Catalogue', function ($scope, $rootScope, EVENTS, PARTY_ROLES, Offering, $element, Product, Catalogue) {
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
            return $catalogue != null && Catalogue.hasRoleAs($catalogue, PARTY_ROLES.OWNER);
        };

        $scope.hasRoleAsSeller = function hasRoleAsSeller($catalogue) {
            return $catalogue != null && Catalogue.hasRoleAs($catalogue, PARTY_ROLES.SELLER);
        };

        $scope.resetCreateForm();

        $scope.$productList = Product.$collection;
        Product.list();

        $scope.$catalogueList = Catalogue.$collection;
        Catalogue.list();
    }])
    .controller('OfferingView', ['$scope', '$rootScope', 'Offering', 'EVENTS', function ($scope, $rootScope, Offering, EVENTS) {

        $scope.createFormHidden = true;

        $scope.changeView = function changeView() {
            $scope.createFormHidden = !$scope.createFormHidden;
        };

        $scope.$on(EVENTS.OFFERING_CREATE, function ($event, $offering) {
            $scope.changeView();
        });

        Offering.list();
    }]);
