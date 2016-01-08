/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('OfferingSearchCtrl', OfferingSearchController)
        .controller('OfferingCreateCtrl', OfferingCreateController)
        .controller('OfferingDetailCtrl', OfferingDetailController)
        .controller('OfferingUpdateCtrl', OfferingUpdateController);

    function OfferingSearchController($state, $rootScope, EVENTS, Offering) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;

        Offering.search($state.params).then(function (offeringList) {
            angular.copy(offeringList, vm.list);
            vm.list.loaded = true;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED);
        }
    }

    function OfferingCreateController($state, $rootScope, EVENTS, Offering) {
        /* jshint validthis: true */
        var vm = this;
        var stepList = [
            {
                title: 'General',
                templateUrl: 'stock/product-offering/create/general'
            },
            {
                title: 'Select product',
                templateUrl: 'stock/product-offering/create/product'
            },
            {
                title: 'Select catalogue',
                templateUrl: 'stock/product-offering/create/catalogue'
            },
            {
                title: 'Pricing models',
                templateUrl: 'stock/product-offering/create/pricing'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/product-offering/create/finish'
            }
        ];

        vm.data = Offering.buildInitialData();
        vm.stepList = stepList;

        vm.create = create;
        vm.setProduct = setProduct;
        vm.setCatalogue = setCatalogue;

        vm.savePricing = savePricing;
        vm.removePricing = removePricing;

        initPricing();

        function create() {
            Offering.create(vm.data, vm.product, vm.catalogue).then(function (offeringCreated) {
                $state.go('stock.offering.update', {
                    offeringId: offeringCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'offering',
                    name: offeringCreated.name
                });
            });
        }

        function initPricing() {
            vm.currentPricing = {
                priceType: 'one time',
                price: {
                    taxRate: 20,
                    currencyCode: 'EUR',
                    percentage: 0
                },
                recurringChargePeriod: 'weekly'
            };
        }

        function savePricing() {
            // Clean pricing fields
            if (vm.currentPricing.priceType === 'one time') {
                vm.currentPricing.unitOfMeasure = '';
                vm.currentPricing.recurringChargePeriod = '';
            } else if (vm.currentPricing.priceType === 'recurring') {
                vm.currentPricing.unitOfMeasure = '';
            } else {
                vm.currentPricing.recurringChargePeriod = '';
            }

            // Calculate duty free amount
            var taxInc = vm.currentPricing.price.taxIncludedAmount;
            var taxRate = vm.currentPricing.price.taxRate;

            vm.currentPricing.price.dutyFreeAmount = taxInc - ((taxInc*taxRate) / 100);
            vm.data.productOfferingPrice.push(vm.currentPricing);
            initPricing();
        }

        function removePricing(pricing) {
            var index = vm.data.productOfferingPrice.indexOf(pricing);

            if (index > -1) {
                vm.data.productOfferingPrice.splice(index, 1);
            }
        }

        function setProduct(product) {
            vm.product = product;
        }

        function setCatalogue(catalogue) {
            vm.catalogue = catalogue;
        }
    }

    function OfferingDetailController($state, Offering) {
        /* jshint validthis: true */
        var vm = this;

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            vm.item = offeringRetrieved;
            vm.item.loaded = true;
        }, function (status) {
            switch (status) {
            case 404:
                $state.go('offering', {
                    reload: true
                });
                break;
            }
        });
    }

    function OfferingUpdateController($state, $rootScope, EVENTS, Offering) {
        /* jshint validthis: true */
        var vm = this;

        vm.update = update;
        vm.updateStatus = updateStatus;

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            vm.data = angular.copy(offeringRetrieved);
            vm.item = offeringRetrieved;
            vm.item.loaded = true;
        }, function (status) {
            switch (status) {
            case 404:
                $state.go('stock.offering', {
                    reload: true
                });
                break;
            }
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function update() {
            Offering.update(vm.data).then(function (offeringUpdated) {
                $state.go('stock.offering.update', {
                    offeringId: offeringUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'offering',
                    name: offeringUpdated.name
                });
            });
        }
    }

})();
