/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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
        .controller('OfferingSearchCtrl', ['$scope', '$state', '$rootScope', '$timeout', 'EVENTS', 'Offering',
            'LIFECYCLE_STATUS', 'Utils', ProductOfferingSearchController])

        .controller('OfferingCreateCtrl', ['$q', '$scope', '$state', '$rootScope', '$controller', 'EVENTS',
            'LIFECYCLE_STATUS', 'PROMISE_STATUS', 'Offering', 'Catalogue', 'ProductSpec', 'Utils', ProductOfferingCreateController])

        .controller('OfferingDetailCtrl', ['$state', 'Offering', 'ProductSpec', 'Utils', ProductOfferingDetailController])
        .controller('OfferingUpdateCtrl', ['$state', '$scope', '$rootScope', '$controller', 'EVENTS', 'PROMISE_STATUS',
            'Offering', 'Utils', ProductOfferingUpdateController]);

    function ProductOfferingSearchController($scope, $state, $rootScope, $timeout, EVENTS, Offering, LIFECYCLE_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var formMode = false;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;
        vm.offset = -1;
        vm.size = -1;
        vm.showFilters = showFilters;
        vm.getElementsLength = getElementsLength;
        vm.setFormMode = setFormMode;
        vm.launchSearch = launchSearch;
        vm.searchInput = "";

        function setFormMode(mode) {
            formMode = mode;
        }

        // Initialize the search input content
        vm.initializeInput = initializeInput;
        function initializeInput() {
            if($state.params.body !== undefined)
                vm.searchInput = $state.params.body;
        }

        // Returns the input content
        vm.getSearchInputContent = getSearchInputContent;
        function getSearchInputContent() {
            // Returns the content of the search input
            return vm.searchInput;
        }

        // Handle enter press event
        vm.handleEnterKeyUp = handleEnterKeyUp;
        function handleEnterKeyUp(event) {
            if (event.keyCode == 13) {
                var selector = formMode ? "#formSearch" : "#searchbutton";
                $timeout(function () {
                    $(selector).click();
                });
            }
        }

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }

        function getElementsLength() {
            var params = getParams();
            return Offering.count(params);
        }

        function getParams() {
            var params = {};

            if (!formMode) {
                angular.copy($state.params, params);
            } else {
                params.status = 'Active,Launched';
                params.owner = true;
                params.type = 'Single';
                // When the searchProduct controller is used in a form (Product Spec Bundle or Offering Product)
                // the search text is not retrieved from the URL page
                if (vm.searchInput.length) {
                    params.body = vm.searchInput;
                }
            }
            return params;
        }

        function launchSearch() {
            vm.offset = -1;
            vm.reloadPager();
        }

        function offeringSearch() {
            vm.list.status = LOADING;

            if (vm.offset >= 0) {
                var params = getParams();

                params.offset = vm.offset;
                params.size = vm.size;

                Offering.search(params).then(function (offeringList) {
                    angular.copy(offeringList, vm.list);
                    vm.list.status = LOADED;
                }, function (response) {
                    vm.error = Utils.parseError(response, 'It was impossible to load the list of offerings');
                    vm.list.status = ERROR;
                });
            }
        }

        $scope.$watch(function () {
            return vm.offset;
        }, offeringSearch);
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
            /*{
                title: 'Bundle',
                templateUrl: 'stock/product-offering/create/bundle'
            },
            {
                title: 'Data source spec.',
                templateUrl: 'stock/product-offering/create/product'
            },*/
            {
                title: 'Data source spec.',
                templateUrl: 'stock/product-offering/create/product-bundle'
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
                title: 'License',
                templateUrl: 'stock/product-offering/create/terms'
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

        vm.exclusivities = Offering.exclusivities;
        vm.sectors = Offering.sectors;
        vm.regions = Offering.regions;
        vm.timeframes = Offering.timeframes;
        vm.purposes = Offering.purposes;
        vm.transferabilities = Offering.transferabilities;
        vm.standards = Offering.standards;
        vm.terms = {type:'Standard', isFullCustom:false};

        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;
        vm.LICENSES = Offering.TYPES.LICENSE;

        vm.STATUS = PROMISE_STATUS;

        vm.STATUS = PROMISE_STATUS;

        vm.data = angular.copy(Offering.TEMPLATES.RESOURCE);
        vm.stepList = stepList;

        vm.create = create;
        vm.setProduct = setProduct;
        vm.setCatalogue = setCatalogue;

        vm.toggleProduct = toggleProduct;
        vm.hasProduct = hasProduct;

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

        /* LICENSE MEMBERS */

        vm.license = new Offering.License();
        vm.licenseEnabled = false;

        vm.createLicense = createLicense;

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
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve Data source specifications and catalogues.');
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


//{
//    "bundledProductOffering": [],
//    "category": [],
//    "description": "Description",
//    "isBundle": false,
//    "lifecycleStatus": "Active",
//    "name": "Name",
//    "place": [{
//        "name": "Place"
//    }],
//    "productOfferingPrice": [],
//    "validFor": {
//        "startDateTime": "2018-03-09T15:23:21+00:00"
//    },
//    "version": "0.1",
//    "serviceCandidate": {
//        "id": "defaultRevenue",
//        "name": "Revenue Sharing Service"
//    },
//    "productOfferingTerm": [{
//        "name": "My custom license",
//        "description": "description",
//        "type": "Custom",
//        "isFullCustom": false,
//        "exclusivity": "Exclusive",
//        "sector": "All sectors",
//        "region": "All regions",
//        "purpose": "All purposes",
//        "duration": "12",
//        "transferability": "Sublicensing right",
//        "validFor": {
//                "startDateTime": "2018-04-19T16:42:23-04:00",
//                "endDateTime": "2019-04-18T16:42:23-04:00"
//        }
//    }],
//    "productSpecification": {
//        "id": "1",
//        "href": "http://127.0.0.1:8000/DSProductCatalog/api/catalogManagement/v2/productSpecification/4:(0.1)"
//    }
//}
        function create() {
            var data = angular.copy(vm.data);

            data.category = formatCategory();
            data.place = formatPlaces();
            var createPromise = [];
            if(vm.data.isBundle){
                vm.product = vm.bundledProductSpecification;
                vm.bundledProductSpecification.forEach(function (prod, index) {
                    var tmpdata = JSON.parse(JSON.stringify(data));
                    tmpdata.isBundle = false;
                    tmpdata.name = data.name+index.toString();
                    createPromise.push(Offering.create(tmpdata, prod, vm.catalogue));

                    createPromise[index].then(function (offeringCreated) {
                        $state.go('stock.offering.update', {
                            offeringId: offeringCreated.id
                        });
                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                            resource: 'offering',
                            name: offeringCreated.name
                        });
                        vm.data.bundledProductOffering.push(offeringCreated);
                    }, function (response) {

                        var defaultMessage = 'There was an unexpected error that prevented the ' +
                            'system from creating a new offering';
                        var error = Utils.parseError(response, defaultMessage);

                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                            error: error
                        });
                    });
                });
            }
            
            Promise.all(createPromise).then(function(){
                //var data = angular.copy(vm.data);
                vm.data.category = formatCategory();
                vm.data.place = formatPlaces();
                var terms = []; 
                terms[0] = vm.license.toJSON();
                var offerPromise = Offering.create(vm.data, vm.product, vm.catalogue, terms);
                offerPromise.then(function (offeringCreated) {
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

            })

            
        }

        Object.defineProperty(create, 'status', {
            get: function () { return createPromise != null ? createPromise.$$state.status : -1; }
        });

        function filterOffering(offering) {
            var i = -1;
            vm.data.bundledProductOffering.forEach(function (off, index) {
                if (off.id == offering.id) {
                    i = index;
                }
            });
            return i;
        }

        vm.bundleControl = {
            valid: false,
            used: false
        };
        function toggleOffering(offering) {
            var index = filterOffering(offering);

            if (index !== -1) {
                vm.data.bundledProductOffering.splice(index, 1);
            } else {
                vm.data.bundledProductOffering.push(offering);
                vm.bundleControl.used = true;
            }

            vm.bundleControl.valid = vm.data.bundledProductOffering.length >= 2;
        }

        function toggleProduct(product) {
                    var index = filterProduct(product);

                    if (index !== -1) {
                        vm.bundledProductSpecification.splice(index, 1);
                        //vm.data.bundledProductOffering.splice(index, 1);
                    } else {
                        vm.bundledProductSpecification.push(product);
                        //vm.data.bundledProductOffering.push(product);
                    }

                    stepList[1].form.$valid = vm.bundledProductSpecification.length >= 2;
                }

        function filterProduct(product) {
                    var i = -1;
                    vm.bundledProductSpecification.forEach(function (bundledProduct, index) {
                        if (bundledProduct.id == product.id) {
                            i = index;
                        }
                    });
                    return i;
                }
        function hasProduct(product) {
            return filterProduct(product) > -1;
        }



        function toggleBundle() {
            if (!vm.data.isBundle) {
                vm.bundledProductSpecification.length = 0;
                //vm.data.bundledProductOffering.length = 0;
                vm.bundleControl.valid = true;
            } else {
                vm.bundledProductSpecification = [];
                //vm.data.bundledProductOffering = [];
                vm.bundleControl.valid = false;
                vm.product = undefined;
            }
            vm.bundleControl.used = false;
        }

        function hasOffering(offering) {
            return filterOffering(offering) > -1;
        }

        /* LICENSE METHODS */

        function createLicense() {
            //vm.license = new Offering.License();
            vm.licenseEnabled = false;
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

        $scope.$watch(function (scope) {
            return vm.pricePlan.name;
        }, function() {
            var conflict = false;
            vm.data.productOfferingPrice.forEach(function (plan) {
                if (plan.name.toLowerCase() == vm.pricePlan.name.toLowerCase()) {
                    conflict = true;
                    vm.pricePlanCreateForm.name.$invalid = true;
                    vm.pricePlanCreateForm.name.$error.conflictName = true;
                }
            });

            if (!conflict && vm.pricePlanCreateForm && vm.pricePlanCreateForm.name.$invalid && vm.pricePlan.name && vm.pricePlan.name.length < 30) {
                vm.pricePlanCreateForm.name.$invalid = false;

                if (vm.pricePlanCreateForm.name.$error.conflictName) {
                    vm.pricePlanCreateForm.name.$error.conflictName = false;
                }
            }
        });
    }

    function ProductOfferingDetailController($state, Offering, ProductSpec, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};
        vm.$state = $state;
        vm.hasCharacteristics = hasCharacteristics;
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

        function hasCharacteristics() {
            var hasChars = vm.item.productSpecification.productSpecCharacteristic &&
                vm.item.productSpecification.productSpecCharacteristic.length;

            for (var i = 0; i < vm.item.productSpecification.bundledProductSpecification.length && !hasChars; i++) {
                var bundledProduct = vm.item.productSpecification.bundledProductSpecification[i];

                hasChars = bundledProduct.productSpecCharacteristic && bundledProduct.productSpecCharacteristic.length;
            }
            return hasChars;
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

        vm.$state = $state;

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
