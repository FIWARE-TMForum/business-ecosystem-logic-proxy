/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    angular
        .module('app')
        .controller('OfferingSearchCtrl', OfferingSearchController)
        .controller('OfferingCreateCtrl', OfferingCreateController)
        .controller('OfferingDetailCtrl', OfferingDetailController)
        .controller('OfferingUpdateCtrl', OfferingUpdateController);

    function parseError(response, defaultMessage) {
        var data = response['data'];
        return data !== null && 'error' in data ? data['error'] : defaultMessage;
    }

    function OfferingSearchController($state, $rootScope, EVENTS, Offering) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;

        Offering.search($state.params).then(function (offeringList) {
            angular.copy(offeringList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {
            vm.error = parseError(response, 'It was impossible to load the list of offerings');
            vm.list.status = ERROR;
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
                title: 'Bundle',
                templateUrl: 'stock/product-offering/create/bundle'
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
                title: 'Choose categories',
                templateUrl: 'stock/product-offering/create/categories'
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
        vm.categoryBreadcrumbs = [];

        vm.create = create;
        vm.setProduct = setProduct;
        vm.setCatalogue = setCatalogue;

        vm.savePricing = savePricing;
        vm.removePricing = removePricing;

        vm.toggleBundle = toggleBundle;
        vm.hasOffering = hasOffering;
        vm.toggleOffering = toggleOffering;

        vm.appendCategory = appendCategory;
        vm.removeCategory = removeCategory;

        initPricing();

        function create() {
            vm.data.category = getCategorySet();
            Offering.create(vm.data, vm.product, vm.catalogue).then(function (offeringCreated) {
                $state.go('stock.offering.update', {
                    offeringId: offeringCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'offering',
                    name: offeringCreated.name
                });
            }, function (response) {

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from creating a new offering';
                var error = parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }

        function toggleOffering(offering) {
            var index = vm.data.bundledProductOffering.indexOf(offering);

            if (index !== -1) {
                vm.data.bundledProductOffering.splice(index, 1);
            } else {
                vm.data.bundledProductOffering.push(offering);
            }
        }

        function toggleBundle() {
            if (!vm.data.isBundle) {
                vm.data.bundledProductOffering.length = 0;
            }
        }

        function hasOffering(offering) {
            return vm.data.bundledProductOffering.indexOf(offering) !== -1;
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

        function getCategorySet() {
            var set = [];

            vm.categoryBreadcrumbs.forEach(function (breadcrumb) {
                breadcrumb.forEach(function (category) {
                    if (set.indexOf(category) === -1) {
                        set.push(category);
                    }
                });
            });

            return set;
        }

        function appendCategory(categoryBreadcrumb) {
            var i, j, flag = true;

            for (i = 0; i < vm.categoryBreadcrumbs.length && flag; i++) {
                if (vm.categoryBreadcrumbs[i].length < categoryBreadcrumb.length) {
                    flag = false;
                    for (j = 0; j < vm.categoryBreadcrumbs[i][j].length && !flag; j++) {
                        if (categoryBreadcrumb[j].id != vm.categoryBreadcrumbs[i][j].id) {
                            flag = true;
                        }
                    }

                    if (!flag) {
                        vm.categoryBreadcrumbs[i] = categoryBreadcrumb;
                    }
                } else {
                    flag = false;
                    for (j = 0; j < categoryBreadcrumb.length && !flag; j++) {
                        if (categoryBreadcrumb[j].id != vm.categoryBreadcrumbs[i][j].id) {
                            flag = true;
                        }
                    }
                }
            }

            if (flag) {
                vm.categoryBreadcrumbs.push(categoryBreadcrumb);
            }

            return true;
        }

        function removeCategory(index) {
            vm.categoryBreadcrumbs.splice(index, 1);
        }
    }

    function OfferingDetailController($state, Offering) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            vm.item = offeringRetrieved;
            vm.item.status = LOADED;
        }, function (response) {
            vm.error = parseError(response, 'The requested offering could not be retrieved');
            vm.item.status = ERROR;
        });
    }

    function OfferingUpdateController($state, $rootScope, EVENTS, Offering) {
        /* jshint validthis: true */
        var vm = this;
        var initialData = {};
        var pachable = ['name', 'version', 'description', 'lifecycleStatus'];

        vm.update = update;
        vm.updateStatus = updateStatus;

        vm.item = {};

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            initialData = angular.copy(offeringRetrieved);
            vm.data = angular.copy(offeringRetrieved);
            vm.item = offeringRetrieved;
            vm.item.status = LOADED;
        }, function (reason) {
            vm.error = parseError(reason, 'The requested offering could not be retrieved');
            vm.item.status = ERROR;
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function update() {
            var updatedData = {};

            for (var i = 0; i < pachable.length; i++) {
                if (initialData[pachable[i]] !== vm.data[pachable[i]]) {
                    updatedData[pachable[i]] = vm.data[pachable[i]];
                }
            }

            // Check what info has been modified
            Offering.update(initialData, updatedData).then(function (offeringUpdated) {
                $state.go('stock.offering.update', {
                    offeringId: offeringUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'offering',
                    name: offeringUpdated.name
                });
            }, function (response) {

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from updating the given offering';
                var error = parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

})();
