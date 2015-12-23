/**
 *
 */

angular.module('app')
    .controller('OfferingSearchCtrl', function ($scope, $rootScope, $state, EVENTS, Offering, userRole, offeringFilters) {

        $scope.showFilters = function () {
            $rootScope.$broadcast(EVENTS.FILTERS_SHOW, offeringFilters);
        };

        $scope.orderItem = function orderItem(offering) {
            $rootScope.$broadcast(EVENTS.ORDER_ADDITION, offering);
        };

        $scope.loading = true;

        Offering.list(userRole, $state.params).then(function (offeringList) {
            $scope.loading = false;
            $scope.offeringList = offeringList;
        });
    })
    .controller('OfferingCreateCtrl', function ($scope, $state, Offering) {

        $scope.selectProduct = function (product) {
            $scope.productChosen = product;
        };

        $scope.selectCatalogue = function (catalogue) {
            $scope.catalogueChosen = catalogue;
        };

        $scope.createOffering = function () {
            Offering.create($scope.offeringInfo, $scope.productChosen, $scope.catalogueChosen).then(function (offeringCreated) {
                $state.go('app.stock.offering.update', {
                    offeringId: offeringCreated.id
                });
            });
        };

        $scope.offeringInfo = {
            version: '0.1'
        };
    })
    .controller('OfferingUpdateCtrl', function ($scope, $state, Offering) {

        $scope.loading = true;

        Offering.get($state.params.offeringId).then(function (offering) {
            $scope.loading = false;
            $scope.offering = offering;
        });
    });
