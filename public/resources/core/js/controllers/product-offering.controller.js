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

    function OfferingSearchController($state, $rootScope, EVENTS, Offering, LIFECYCLE_STATUS, Utils) {
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
            vm.error = Utils.parseError(response, 'It was impossible to load the list of offerings');
            vm.list.status = ERROR;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }
    }

    function OfferingCreateController($state, $rootScope, EVENTS, Offering, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var stepList = [
            {
                title: 'General',
                templateUrl: 'stock/product-offering/create/general'
            },
            {
                title: 'Bundled Offering',
                templateUrl: 'stock/product-offering/create/bundle'
            },
            {
                title: 'Product Spec.',
                templateUrl: 'stock/product-offering/create/product'
            },
            {
                title: 'Catalogue',
                templateUrl: 'stock/product-offering/create/catalogue'
            },
            {
                title: 'Category',
                templateUrl: 'stock/product-offering/create/categories'
            },
            {
                title: 'Price Plans',
                templateUrl: 'stock/product-offering/create/priceplan'
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

        vm.toggleBundle = toggleBundle;
        vm.hasOffering = hasOffering;
        vm.toggleOffering = toggleOffering;

        vm.categories = {};
        vm.setCategory = setCategory;
        vm.categoryIsDisabled = categoryIsDisabled;
        vm.hasCategories = hasCategories;

        /* PRICE PLANS MEMBERS */

        var pricePlan = Offering.createPricePlan();

        vm.PRICE_TYPES = Offering.PRICE_TYPES;
        vm.PRICE_CURRENCIES = Offering.PRICE_CURRENCIES;
        vm.PRICE_PERIODS = Offering.PRICE_PERIODS;

        vm.pricePlan = angular.copy(pricePlan);
        vm.pricePlans = [];
        vm.priceplanEnabled = false;

        vm.selectPriceType = selectPriceType;
        vm.selectCurrencyCode = selectCurrencyCode;

        vm.createPricePlan = createPricePlan;
        vm.removePricePlan = removePricePlan;

        vm.place = "";
        vm.places = [];

        vm.createPlace = createPlace;
        vm.removePlace = removePlace;

        function formatPlaces() {
            return vm.places.map(function (name) {
                return {
                    name: name
                };
            });
        }

        function createPlace() {
            var index = vm.places.indexOf(vm.place);
            if (index === -1) {
                vm.places.push(vm.place);
            }
            vm.place = "";
        }

        function removePlace(index) {
            vm.places.splice(index, 1);
        }

        function create() {
            vm.data.category = formatCategory();
            vm.data.productOfferingPrice = vm.pricePlans;
            vm.data.place = formatPlaces();
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
                var error = Utils.parseError(response, defaultMessage);

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

        /* PRICE PLANS METHODS */

        function createPricePlan() {

            extendDutyFreeAmount();
            vm.pricePlans.push(vm.pricePlan);
            vm.pricePlan = angular.copy(pricePlan);
            vm.priceplanEnabled = false;

            return true;
        }

        function removePricePlan(index) {
            vm.pricePlans.splice(index, 1);
        }

        function extendDutyFreeAmount() {
            var taxIncludedAmount = vm.pricePlan.price.taxIncludedAmount;
            var taxRate = vm.pricePlan.price.taxRate;

            vm.pricePlan.price.dutyFreeAmount = taxIncludedAmount / ((100 + taxRate) / 100);
        }

        function selectPriceType(key) {

            if (key in Offering.PRICE_TYPES) {
                vm.pricePlan.priceType = Offering.PRICE_TYPES[key];
                vm.pricePlan.unitOfMeasure = "";
                vm.pricePlan.recurringChargePeriod = "";

                if (vm.pricePlan.priceType === Offering.PRICE_TYPES.RECURRING) {
                    vm.pricePlan.recurringChargePeriod = Offering.PRICE_PERIODS.WEEKLY;
                }
            }
        }

        function selectCurrencyCode(key) {

            if (key in Offering.PRICE_CURRENCIES) {
                vm.pricePlan.price.currencyCode = key;
            }
        }

        function setProduct(product) {
            vm.product = product;
        }

        function setCatalogue(catalogue) {
            vm.catalogue = catalogue;
        }

        function setCategory(category) {

            if (category.id in vm.categories) {
                delete vm.categories[category.id];
            } else {
                removeChildCategory(category);
                vm.categories[category.id] = category;
            }
        }

        function hasCategories() {
            return Object.keys(vm.categories).length !== 0;
        }

        function categoryIsDisabled(category) {
            return Object.keys(vm.categories).some(function (id) {
                return isIncluded(vm.categories[id], category);
            });
        }

        function removeChildCategory(parentCategory) {
            return parentCategory.getBreadcrumb().some(function (category) {
                if (category.id in vm.categories) {
                    delete vm.categories[category.id];
                    return true;
                }
            });
        }

        function isIncluded(parentCategory, targetCategory) {
            return parentCategory.getBreadcrumb().some(function (category) {
                return targetCategory.id === category.id;
            });
        }

        function formatCategory() {
            var name, category = [];

            for (name in vm.categories) {
                category = category.concat(vm.categories[name].getBreadcrumb(), vm.categories[name]);
            }

            return category;
        }
    }

    function OfferingDetailController($state, Offering, ProductSpec, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};
        vm.$state = $state;
        vm.formatCharacteristicValue = formatCharacteristicValue;

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            vm.item = offeringRetrieved;
            vm.item.status = LOADED;
            vm.categories = vm.item.getCategories();
        }, function (response) {
            vm.error = Utils.parseError(response, 'The requested offering could not be retrieved');
            vm.item.status = ERROR;
        });

        function formatCharacteristicValue(characteristic, characteristicValue) {
            var result;

            switch (characteristic.valueType) {
            case ProductSpec.VALUE_TYPES.STRING.toLowerCase():
                result = characteristicValue.value;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER.toLowerCase():
                if (characteristicValue.value && characteristicValue.value.length) {
                    result = characteristicValue.value;
                } else {
                    result = characteristicValue.valueFrom + " - " + characteristicValue.valueTo;
                }
                result += " " + characteristicValue.unitOfMeasure;
                break;
            }

            return result;
        }
    }

    function OfferingUpdateController($state, $rootScope, EVENTS, Offering, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var initialData = {};
        var pachable = ['name', 'version', 'description', 'lifecycleStatus'];

        vm.update = update;
        vm.updateStatus = updateStatus;
        vm.hasCategory = hasCategory;

        vm.item = {};

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            initialData = angular.copy(offeringRetrieved);
            vm.data = angular.copy(offeringRetrieved);
            vm.item = offeringRetrieved;
            vm.item.status = LOADED;
            vm.categories = vm.item.getCategories();
        }, function (reason) {
            vm.error = Utils.parseError(reason, 'The requested offering could not be retrieved');
            vm.item.status = ERROR;
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function hasCategory(category) {
            return vm.categories.some(function (c) {
                return c.id === category.id;
            });
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
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

})();
