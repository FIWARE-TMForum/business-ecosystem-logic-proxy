/**
 *
 */

angular.module('app')
    .controller('OfferingSearchCtrl', function ($scope, $rootScope, $state, EVENTS, Offering, userRole, offeringFilters) {
        var isList = false;

        $scope.isListView = function isListView() {
            return isList;
        };

        $scope.setListView = function setListView(state) {
            isList = state;
        };

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

        var initPricing = function initPricing() {
            $scope.currentPricing = {
                priceType: 'one time',
                price: {
                    taxRate: 20,
                    currencyCode: 'EUR',
                    percentage: 0
                },
                recurringChargePeriod: 'weekly'
            };
        };

        $scope.savePricing = function savePricing() {
            // Clean pricing fields
            if ($scope.currentPricing.priceType === 'one time') {
                $scope.currentPricing.unitOfMeasure = '';
                $scope.currentPricing.recurringChargePeriod = '';
            } else if ($scope.currentPricing.priceType === 'recurring') {
                $scope.currentPricing.unitOfMeasure = '';
            } else {
                $scope.currentPricing.recurringChargePeriod = '';
            }

            // Calculate duty free amount
            var taxInc = $scope.currentPricing.price.taxIncludedAmount;
            var taxRate = $scope.currentPricing.price.taxRate;

            $scope.currentPricing.price.dutyFreeAmount = taxInc - ((taxInc*taxRate) / 100);
            $scope.offeringInfo.productOfferingPrice.push($scope.currentPricing);
            initPricing();
        };

        $scope.removePricing = function removePricing(pricing) {
            var index = $scope.offeringInfo.productOfferingPrice.indexOf(pricing);

            if (index > -1) {
                $scope.offeringInfo.productOfferingPrice.splice(index, 1);
            }
        };

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
            version: '0.1',
            productOfferingPrice: []
        };
        initPricing();
    })
    .controller('OfferingUpdateCtrl', function ($scope, $state, Offering) {

        $scope.loading = true;

        Offering.get($state.params.offeringId).then(function (offering) {
            $scope.loading = false;
            $scope.offering = offering;
        });
    });
