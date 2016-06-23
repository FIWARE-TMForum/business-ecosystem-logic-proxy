/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
        .controller('OfferingSearchCtrl', ProductOfferingSearchController)
        .controller('OfferingCreateCtrl', ProductOfferingCreateController)
        .controller('OfferingDetailCtrl', ProductOfferingDetailController)
        .controller('OfferingUpdateCtrl', ProductOfferingUpdateController);

    function ProductOfferingSearchController($state, $rootScope, EVENTS, Offering, LIFECYCLE_STATUS, Utils) {
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

    function ProductOfferingCreateController($q, $scope, $state, $rootScope, $controller, EVENTS, LIFECYCLE_STATUS, PROMISE_STATUS, Offering, Catalogue, ProductSpec, Utils) {
        /* jshint validthis: true */
        var vm = this;

        var sharingModel;

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
                title: 'RS Model',
                templateUrl: 'stock/product-offering/create/sharing'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/product-offering/create/finish'
            }
        ];

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;
        vm.STATUS = PROMISE_STATUS;

        vm.STATUS = PROMISE_STATUS;

        vm.data = angular.copy(Offering.TEMPLATES.RESOURCE);
        vm.stepList = stepList;

        vm.create = create;
        vm.setProduct = setProduct;
        vm.setCatalogue = setCatalogue;

        vm.setSharingModel = setSharingModel;
        vm.getSharingModel = getSharingModel;

        vm.toggleBundle = toggleBundle;
        vm.hasOffering = hasOffering;
        vm.toggleOffering = toggleOffering;

        vm.categories = {};
        vm.setCategory = setCategory;
        vm.categoryIsDisabled = categoryIsDisabled;
        vm.hasCategories = hasCategories;

        /* PRICE PLANS MEMBERS */

        vm.pricePlan = new Offering.PricePlan();
        vm.pricePlanEnabled = false;

        vm.createPricePlan = createPricePlan;
        vm.updatePricePlan = updatePricePlan;
        vm.removePricePlan = removePricePlan;

        vm.place = "";
        vm.places = [];

        vm.createPlace = createPlace;
        vm.removePlace = removePlace;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATED, function (event, index, pricePlan) {
            angular.merge(vm.data.productOfferingPrice[index], pricePlan);
        });

        var searchParams = {
            owner: true,
            status: [
                LIFECYCLE_STATUS.ACTIVE,
                LIFECYCLE_STATUS.LAUNCHED
            ].join(',')
        };

        var searchPromise = Catalogue.search(searchParams).then(function (collection) {
            if (collection.length) {
                return ProductSpec.search(searchParams);
            } else {
                return $q.reject('Sorry! In order to create a product offering, you must first create at least one product catalogue.');
            }
        }).then(function (collection) {
            if (!collection.length) {
                return $q.reject('Sorry! In order to create a product offering, you must first create at least one product specification.');
            }
        });

        searchPromise.catch(function (response) {
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve product specifications and catalogues.');
        });

        Object.defineProperty(vm, 'status', {
            get: function () { return searchPromise != null ? searchPromise.$$state.status : -1; }
        });

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

        var createPromise = null;

        function create() {
            vm.data.category = formatCategory();
            vm.data.place = formatPlaces();
            createPromise = Offering.create(vm.data, vm.product, vm.catalogue);

            createPromise.then(function (offeringCreated) {
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

        Object.defineProperty(create, 'status', {
            get: function () { return createPromise != null ? createPromise.$$state.status : -1; }
        });

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
            vm.data.productOfferingPrice.push(vm.pricePlan);
            vm.pricePlan = new Offering.PricePlan();
            vm.pricePlanEnabled = false;
        }

        function updatePricePlan(index) {
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATE, index, vm.data.productOfferingPrice[index]);
        }

        function removePricePlan(index) {
            vm.data.productOfferingPrice.splice(index, 1);
        }

        function setProduct(product) {
            vm.product = product;
        }

        function setCatalogue(catalogue) {
            vm.catalogue = catalogue;
        }

        function setSharingModel(rsModel) {
            sharingModel = rsModel;
            vm.data.serviceCandidate = {
                id: rsModel.productClass,
                name: 'Revenue Sharing Service'
            }
        }

        function getSharingModel() {
            return sharingModel;
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

    function ProductOfferingDetailController($state, Offering, ProductSpec, Utils) {
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

    function ProductOfferingUpdateController($state, $scope, $rootScope, $controller, EVENTS, PROMISE_STATUS, Offering, Utils) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.STATUS = PROMISE_STATUS;
        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;

        vm.update = update;
        vm.updateStatus = updateStatus;
        vm.hasCategory = hasCategory;

        vm.pricePlan = new Offering.PricePlan();
        vm.pricePlanEnabled = false;

        vm.createPricePlan = createPricePlan;
        vm.updatePricePlan = updatePricePlan;
        vm.removePricePlan = removePricePlan;

        var updatePricePlanPromise = null;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATED, function (event, index, pricePlan) {
            updatePricePlanPromise = vm.item.updatePricePlan(index, pricePlan);
            updatePricePlanPromise.then(function (productOffering) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {message: 'The offering price plan was updated.'});
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the offering price plan.')
                });
            });
        });

        var detailPromise = Offering.detail($state.params.offeringId);
        detailPromise.then(function (productOffering) {
            vm.item = productOffering;
            vm.data = angular.copy(productOffering);
            vm.categories = productOffering.getCategories();
        }, function (response) {
            vm.error = Utils.parseError(response, 'Unexpected error trying to retrieve the offering.');
        });

        Object.defineProperty(vm, 'status', {
            get: function () { return detailPromise != null ? detailPromise.$$state.status : -1; }
        });

        var createPricePlanPromise = null;

        function createPricePlan() {
            createPricePlanPromise = vm.item.appendPricePlan(vm.pricePlan);
            createPricePlanPromise.then(function (productOffering) {
                vm.pricePlan = new Offering.PricePlan();
                vm.pricePlanEnabled = false;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {message: 'The offering price plan was created.'});
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the offering price plan.')
                });
            });
        }

        Object.defineProperty(createPricePlan, 'status', {
            get: function () { return createPricePlanPromise != null ? createPricePlanPromise.$$state.status : -1; }
        });

        function updatePricePlan(index) {
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATE, index, vm.item.productOfferingPrice[index]);
        }

        Object.defineProperty(updatePricePlan, 'status', {
            get: function () { return updatePricePlanPromise != null ? updatePricePlanPromise.$$state.status : -1; }
        });

        var removePricePlanPromise = null;

        function removePricePlan(index) {
            removePricePlanPromise = vm.item.removePricePlan(index);
            removePricePlanPromise.then(function (productOffering) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {message: 'The offering price plan was removed.'});
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to remove the offering price plan.')
                });
            });
        }

        Object.defineProperty(removePricePlan, 'status', {
            get: function () { return removePricePlanPromise != null ? removePricePlanPromise.$$state.status : -1; }
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

        var updatePromise = null;

        function update() {
            var dataUpdated = {};

            Offering.PATCHABLE_ATTRS.forEach(function (attr) {
                if (!angular.equals(vm.item[attr], vm.data[attr])) {
                    dataUpdated[attr] = vm.data[attr];
                }
            });

            // Check what info has been modified
            updatePromise = Offering.update(vm.item, dataUpdated);
            updatePromise.then(function (offeringUpdated) {
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
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the offering.')
                });
            });
        }

        Object.defineProperty(update, 'status', {
            get: function () { return updatePromise != null ? updatePromise.$$state.status : -1; }
        });
    }

})();
