/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
(function() {
    'use strict';

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    angular
        .module('app')
        .controller('OfferingSearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            '$timeout',
            'EVENTS',
            'Offering',
            'LIFECYCLE_STATUS',
            'Utils',
            'Download',
            '$window',
            ProductOfferingSearchController
        ])

        .controller('OfferingCreateCtrl', [
            '$q',
            '$scope',
            '$state',
            '$rootScope',
            '$controller',
            'EVENTS',
            'LIFECYCLE_STATUS',
            'PROMISE_STATUS',
            'Offering',
            'Catalogue',
            'ProductSpec',
            'Utils',
            ProductOfferingCreateController
        ])

        .controller('OfferingDetailCtrl', [
            '$state',
            'Offering',
            'ProductSpec',
            'Utils',
            'Download',
            '$window',
            ProductOfferingDetailController
        ])
        .controller('OfferingUpdateCtrl', [
            '$state',
            '$scope',
            '$rootScope',
            '$controller',
            'EVENTS',
            'PROMISE_STATUS',
            'Offering',
            'Utils',
            ProductOfferingUpdateController
        ]);

    function ProductOfferingSearchController(
        $scope,
        $state,
        $rootScope,
        $timeout,
        EVENTS,
        Offering,
        LIFECYCLE_STATUS,
        Utils,
        Download,
        $window
    ) {
        /* jshint validthis: true */
        var vm = this;
        var formMode = false;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;
        vm.offset = -1;
        vm.limit = -1;
        vm.showFilters = showFilters;
        vm.getElementsLength = getElementsLength;
        vm.setFormMode = setFormMode;
        vm.launchSearch = launchSearch;
        vm.searchInput = '';
        vm.downloadAsset = downloadAsset;

        function getProductLocation(productSpec) {
            let location;

            productSpec.productSpecCharacteristic.forEach((charact) => {
                if (charact.name.toLowerCase() == 'location') {
                    location = charact.productSpecCharacteristicValue[0].value;
                }
            })
            return location;
        }
        function downloadAsset(offering) {
            let locations = []

            if (offering.isBundle) {
                offering.bundledProductOffering.forEach((bundledOffering) => {
                    locations.push(getProductLocation(bundledOffering.productSpecification));
                });
            } else {
                locations.push(getProductLocation(offering.productSpecification));
            }

            // Download all the locations
            locations.forEach((location) => {
                $window.open(location, '_blank');
            });
        }

        function setFormMode(mode) {
            formMode = mode;
        }

        // Initialize the search input content
        vm.initializeInput = initializeInput;
        function initializeInput() {
            if ($state.params.body !== undefined) vm.searchInput = $state.params.body;
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
                var selector = formMode ? '#formSearch' : '#searchbutton';
                $timeout(function() {
                    $(selector).click();
                });
            }
        }

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }

        function getElementsLength() {
            //var params = getParams();
            //return Offering.count(params);
            return Promise.resolve(10)
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
                params.limit = vm.limit;

                Offering.search(params).then(function (offeringList) {
                    angular.copy(offeringList, vm.list);
                    getOverallReputation();
                    //vm.list.status = LOADED;
                }, function (response) {
                    vm.error = Utils.parseError(response, 'It was impossible to load the list of offerings');
                    vm.list.status = ERROR;
                });
                
            }
        }

        function getOverallReputation(){
            Offering.getOverallReputation().then(function (reputationList) {
                const maxScore = 5;
                for (let i=0; i < vm.list.length; i++){
                    vm.list[i].repAvg = 0;
                    vm.list[i].repCount = 0;
                    vm.list[i].repAvgStars = [];
                    let currentScore = 0;
                    for (let j=0; j < reputationList.length; j++){
                        if(vm.list[i].id === reputationList[j]._id){
                            currentScore = reputationList[j].avg;
                            vm.list[i].repCount = reputationList[j].count;
                        }
                    }
                    for(let k=0; k < maxScore; k++){
                        vm.list[i].repAvgStars[k] = {};
                        vm.list[i].repAvgStars[k].value = currentScore > k;
                        vm.list[i].repAvgStars[k].index = k+1;
                    }
                }
                vm.list.status = LOADED;
            }, function (response) {
                vm.error = Utils.parseError(response, 'It was impossible to load the reputation score');
                vm.list.status = ERROR;
            });            
        }

        $scope.$watch(function () {
            return vm.offset;
        }, offeringSearch);
    }

    function categoryHandler(vm) {
        vm.setCategory = setCategory;
        vm.categoryIsDisabled = categoryIsDisabled;
        vm.removeChildCategory = removeChildCategory;
        vm.isIncluded = isIncluded;

        function setCategory(category) {
            if (category.id in vm.categories) {
                delete vm.categories[category.id];
            } else {
                removeChildCategory(category);
                vm.categories[category.id] = category;
            }
        }

        function categoryIsDisabled(category) {
            return Object.keys(vm.categories).some(function(id) {
                return isIncluded(vm.categories[id], category);
            });
        }

        function removeChildCategory(parentCategory) {
            return parentCategory.getBreadcrumb().some(function(category) {
                if (category.id in vm.categories) {
                    delete vm.categories[category.id];
                    return true;
                }
            });
        }

        function isIncluded(parentCategory, targetCategory) {
            return parentCategory.getBreadcrumb().some(function(category) {
                return targetCategory.id === category.id;
            });
        }
    }

    function ProductOfferingCreateController(
        $q,
        $scope,
        $state,
        $rootScope,
        $controller,
        EVENTS,
        LIFECYCLE_STATUS,
        PROMISE_STATUS,
        Offering,
        Catalogue,
        ProductSpec,
        Utils
    ) {
        /* jshint validthis: true */
        var vm = this;

        var sharingModel;

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
                title: 'License',
                templateUrl: 'stock/product-offering/create/terms'
            },
            {
                title: 'SLA',
                templateUrl: 'stock/product-offering/create/sla'
            },
            {
                title: 'Price Plans',
                templateUrl: 'stock/product-offering/create/priceplan'
            },
            /*{
                title: 'RS Model',
                templateUrl: 'stock/product-offering/create/sharing'
            },*/
            {
                title: 'Finish',
                templateUrl: 'stock/product-offering/create/finish'
            }
        ];

        angular.extend(vm, $controller('FormMixinCtrl', { $scope: $scope }));

        vm.exclusivities = Offering.exclusivities;
        vm.sectors = Offering.sectors;
        vm.regions = Offering.regions;
        vm.timeframes = Offering.timeframes;
        vm.purposes = Offering.purposes;
        vm.transferabilities = Offering.transferabilities;
        vm.standards = Offering.standards;
        vm.terms = {type:'Standard', isFullCustom:false};
        //vm.sla = {type:'None'};

        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;
        vm.LICENSES = Offering.TYPES.LICENSE;
        vm.SLA = Offering.TYPES.SLA;
        vm.METRICS = Offering.TYPES.METRICS;
        vm.UNITS = Offering.TYPES.UNITS;
        vm.TIMERANGE = Offering.TYPES.TIMERANGE;
        vm.MEASURESDESC = Offering.TYPES.MEASURESDESC

        vm.STATUS = PROMISE_STATUS;
        vm.PRICE_ALTERATIONS = Offering.TYPES.PRICE_ALTERATION;
        vm.PRICE_ALTERATIONS_SUPPORTED = Offering.TYPES.PRICE_ALTERATION_SUPPORTED;
        vm.PRICE_CONDITIONS = Offering.TYPES.PRICE_CONDITION;

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

        // Load category management methods
        categoryHandler(vm);

        vm.hasCategories = hasCategories;

        /* PRICE PLANS MEMBERS */
        vm.pricingModels = []
        vm.pricePlan = new Offering.PricePlan();
        vm.isOpen = false;
        vm.pricePlanEnabled = false;
        vm.priceAlterationType = vm.PRICE_ALTERATIONS_SUPPORTED.NOTHING;

        vm.createPricePlan = createPricePlan;
        vm.updatePricePlan = updatePricePlan;
        vm.removePricePlan = removePricePlan;
        vm.isFreeOffering = isFreeOffering;
        vm.isOpenOffering = isOpenOffering;

        vm.setAlteration = setAlteration;

        /* LICENSE MEMBERS */

        vm.license = new Offering.License();
        vm.licenseEnabled = false;

        vm.createLicense = createLicense;

        /* SLA MEMBERS */
        vm.metrics = []
        vm.metric = new Offering.Metric();
        vm.metric.type = vm.METRICS.UPDATES;
        vm.metric.description = vm.MEASURESDESC.UPDATES;
        vm.createMetric = createMetric;
        vm.updateMetric = updateMetric;
        vm.removeMetric = removeMetric;
        vm.metricsUsed = [];

        vm.sla = new Offering.Sla();
        vm.slaEnabled = false;
        vm.createSla = createSla;

        vm.place = "";
        vm.places = [];

        vm.createPlace = createPlace;
        vm.removePlace = removePlace;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATED, function(event, index, pricePlan) {
            angular.merge(vm.pricingModels[index], pricePlan);
        });

        var searchParams = {
            owner: true,
            status: [LIFECYCLE_STATUS.ACTIVE, LIFECYCLE_STATUS.LAUNCHED].join(',')
        };

        var searchPromise = Catalogue.search(searchParams)
            .then(function(collection) {
                if (collection.length) {
                    return ProductSpec.search(searchParams);
                } else {
                    return $q.reject(
                        'Sorry! In order to create a product offering, you must first create at least one product catalogue.'
                    );
                }
            })
            .then(function(collection) {
                if (!collection.length) {
                    return $q.reject(
                        'Sorry! In order to create a product offering, you must first create at least one product specification.'
                    );
                }
            });

        searchPromise.catch(function(response) {
            vm.errorMessage = Utils.parseError(
                response,
                'Unexpected error trying to retrieve product specifications and catalogues.'
            );
        });

        Object.defineProperty(vm, 'status', {
            get: function() {
                return searchPromise != null ? searchPromise.$$state.status : -1;
            }
        });

        function formatPlaces() {
            return vm.places.map(function(name) {
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
            vm.place = '';
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
        async function create() {
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
                    var terms = []; 
                    terms[0] = vm.license.toJSON();
                    createPromise.push(Offering.create(tmpdata, prod, vm.catalogue, terms));

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

            if (vm.pricingModels.length > 0) {
                 vm.data.productOfferingPrice = await Promise.all(vm.pricingModels.map(async (model) => {
                    let priceObj = await Offering.createPricing(model)
                    let offModel = Offering.buildTMFPricing(model)

                    offModel.id = priceObj.id
                    offModel.href = priceObj.href

                    return offModel
                }))
            }

            Promise.all(createPromise).then(function(){
                //var data = angular.copy(vm.data);
                vm.data.category = formatCategory();
                vm.data.place = formatPlaces();

                // Check if the offering is a free one
                if ((vm.data.productOfferingPrice == null || vm.data.productOfferingPrice == undefined || vm.data.productOfferingPrice.length == 0) && vm.isOpen) {
                    // The offering is free, so a free plan needs to be included
                    vm.data.productOfferingPrice = [{
                        'name': 'Open',
                        'description': 'The offering is open, so it can be directly accessed'
                    }]
                }

                var terms = []; 
                terms[0] = vm.license.toJSON();
                var offerPromise = Offering.create(vm.data, vm.product, vm.catalogue, terms);
                offerPromise.then(function (offeringCreated) {
                    //Create SLA
                    var sla = vm.sla.toJSON();
                    sla.offerId = offeringCreated.id;
                    var slaPromise = Offering.setSla(sla);
                    //Finalise Offering
                    slaPromise.then(function (slaCreated) {
                        $state.go('stock.offering.update', {
                            offeringId: slaCreated.offerId
                        });
                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                            resource: 'offering',
                            name: offeringCreated.name
                        });
                    }, function (response) {
                        var defaultMessage = 'There was an unexpected error that prevented the ' +
                            'system from creating a new SLA';
                        var error = Utils.parseError(response, defaultMessage);

                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                            error: error
                    });
                }, function (response) {
                        var defaultMessage = 'There was an unexpected error that prevented the ' +
                            'system from creating a new offering';
                        var error = Utils.parseError(response, defaultMessage);

                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                            error: error
                        });
                    });
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
            get: function() {
                return createPromise != null ? createPromise.$$state.status : -1;
            }
        });

        function filterOffering(offering) {
            var i = -1;
            vm.data.bundledProductOffering.forEach(function(off, index) {
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


        /* SLA METHODS */

        function createMetric() {
            //vm.metrics.push(vm.sla);
            //vm.metric = new Offering.Metric();
            vm.slaEnabled = false;
            vm.sla.metrics.push(vm.metric);
            vm.metricsUsed.push(vm.metric.type);
            vm.metric = new Offering.Metric();
        }
        
        function createSla() {
            //vm.metrics.push(vm.sla);
            vm.sla = new Offering.Sla();
            vm.sla.metrics = [];
            vm.slaEnabled = false;
            //vm.sla.metrics.push(vm.metric);
        }

        function updateMetric(index) {
            $rootScope.$broadcast(Offering.EVENTS.METRIC_UPDATE, index, vm.sla.metrics[index]);
        }

        function removeMetric(index) {
            var value = vm.sla.metrics[index].type;
 
            var idx = vm.metricsUsed.indexOf(value);
            if (idx > -1) {
                vm.metricsUsed.splice(idx, 1);
            }
            vm.sla.metrics.splice(index, 1);
        }

        /* PRICE PLANS METHODS */

        function isOpenOffering() {
            return vm.data.productOfferingPrice.length == 1 &&
                vm.data.productOfferingPrice[0].name.toLowerCase() == 'open';
        }

        function isFreeOffering() {
            // Return true if the offering is free or open
            return !vm.pricingModels.length || isOpenOffering();
        }

        function createPricePlan() {
            vm.pricingModels.push(vm.pricePlan);

            vm.pricePlan = new Offering.PricePlan();
            vm.pricePlanEnabled = false;
            vm.priceAlterationType = vm.PRICE_ALTERATIONS_SUPPORTED.NOTHING;
        }

        function updatePricePlan(index) {
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATE, index, vm.pricingModels[index]);
        }

        function removePricePlan(index) {
            vm.pricingModels.splice(index, 1);
        }

        function setAlteration(alterationType) {
            vm.priceAlterationType = alterationType;
            vm.pricePlan.resetPriceAlteration(alterationType);
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
            };
        }

        function getSharingModel() {
            return sharingModel;
        }

        function hasCategories() {
            return Object.keys(vm.categories).length !== 0;
        }

        function formatCategory() {
            var name,
                category = [];

            for (name in vm.categories) {
                category = category.concat(vm.categories[name].getBreadcrumb(), vm.categories[name]);
            }

            return category;
        }

        $scope.$watch(
            function(scope) {
                return vm.pricePlan.name;
            },
            function() {
                var conflict = false;
                vm.data.productOfferingPrice.forEach(function(plan) {
                    if (plan.name.toLowerCase() == vm.pricePlan.name.toLowerCase()) {
                        conflict = true;
                        vm.pricePlanCreateForm.name.$invalid = true;
                        vm.pricePlanCreateForm.name.$error.conflictName = true;
                    }
                });

                if (
                    !conflict &&
                    vm.pricePlanCreateForm &&
                    vm.pricePlanCreateForm.name.$invalid &&
                    vm.pricePlan.name &&
                    vm.pricePlan.name.length < 30
                ) {
                    vm.pricePlanCreateForm.name.$invalid = false;

                    if (vm.pricePlanCreateForm.name.$error.conflictName) {
                        vm.pricePlanCreateForm.name.$error.conflictName = false;
                    }
                }
            }
        );
    }

    function ProductOfferingDetailController($state, Offering, ProductSpec, Utils, Download, $window) {
        /* jshint validthis: true */
        var vm = this;
        vm.sla = {};
        vm.item = {};
        vm.pricingModels = []
        vm.$state = $state;
        vm.hasCharacteristics = hasCharacteristics;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.downloadAsset = downloadAsset;

        Offering.detail($state.params.offeringId).then(function (offeringRetrieved) {
            vm.item = offeringRetrieved;
            vm.categories = vm.item.getCategories();
            if (!vm.item.isBundle) {
                vm.attachments = vm.item.productSpecification.getExtraFiles().map((att) => {
                    if (att.name == null) {
                        let sp = att.href.split('/');
                        att.name = sp[sp.length - 1];
                    }
                    return att
                });
            }
            vm.item.status = LOADED;

            Promise.all(vm.item.productOfferingPrice.map((pricing) => {
                return Offering.getPricing(pricing.id)
            })).then((pricingModels) => {
                vm.pricingModels = pricingModels
            })

        }, function (response) {
            vm.error = Utils.parseError(response, 'The requested offering could not be retrieved');
            vm.item.status = ERROR;
        });

        Offering.getSla($state.params.offeringId).then(function (slaRetrieved) {
            vm.sla = slaRetrieved;
        }, function (response){
            vm.error = Utils.parseError(response, 'The requested SLA could not be retrieved');
            vm.item.status = ERROR;
        });

        function getProductLocation(productSpec) {
            let location;

            productSpec.productSpecCharacteristic.forEach((charact) => {
                if (charact.name.toLowerCase() == 'location') {
                    location = charact.productSpecCharacteristicValue[0].value;
                }
            })
            return location;
        }

        function downloadAsset() {
            let locations = []
            let offering = vm.item;

            if (offering.isBundle) {
                offering.bundledProductOffering.forEach((bundledOffering) => {
                    locations.push(getProductLocation(bundledOffering.productSpecification));
                });
            } else {
                locations.push(getProductLocation(offering.productSpecification));
            }

            // Download all the locations
            locations.forEach((location) => {
                $window.open(location, '_blank');
            });
        }

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
                        result = characteristicValue.valueFrom + ' - ' + characteristicValue.valueTo;
                    }
                    result += ' ' + characteristicValue.unitOfMeasure;
                    break;
            }

            return result;
        }

        function hasCharacteristics() {
            var hasChars =
                vm.item.productSpecification.productSpecCharacteristic &&
                vm.item.productSpecification.productSpecCharacteristic.length;

            for (var i = 0; i < vm.item.productSpecification.bundledProductSpecification.length && !hasChars; i++) {
                var bundledProduct = vm.item.productSpecification.bundledProductSpecification[i];

                hasChars = bundledProduct.productSpecCharacteristic && bundledProduct.productSpecCharacteristic.length;
            }
            return hasChars;
        }
    }

    function ProductOfferingUpdateController(
        $state,
        $scope,
        $rootScope,
        $controller,
        EVENTS,
        PROMISE_STATUS,
        Offering,
        Utils
    ) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', { $scope: $scope }));

        vm.STATUS = PROMISE_STATUS;
        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;

        vm.$state = $state;
        vm.PRICE_ALTERATIONS = Offering.TYPES.PRICE_ALTERATION;
        vm.PRICE_ALTERATIONS_SUPPORTED = Offering.TYPES.PRICE_ALTERATION_SUPPORTED;
        vm.PRICE_CONDITIONS = Offering.TYPES.PRICE_CONDITION;

        vm.update = update;
        vm.updateStatus = updateStatus;

        vm.categories = {};

        // Load category management methods
        categoryHandler(vm);

        vm.updateCategories = updateCategories;

        vm.pricePlan = new Offering.PricePlan();
        vm.pricingModels = []
        vm.pricePlanEnabled = false;
        vm.priceAlterationType = vm.PRICE_ALTERATIONS_SUPPORTED.NOTHING;

        vm.createPricePlan = createPricePlan;
        vm.updatePricePlan = updatePricePlan;
        vm.removePricePlan = removePricePlan;
        vm.setAlteration = setAlteration;

        vm.isFreeOffering = isFreeOffering;
        vm.isOpenOffering = isOpenOffering;
        vm.switchOpenStatus = switchOpenStatus;

        vm.sla = {};

        var updatePricePlanPromise = null;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATED, function(event, index, pricePlan) {
            updatePricePlanPromise = vm.item.updatePricePlan(index, pricePlan);
            updatePricePlanPromise.then(
                function() {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                        message: 'The offering price plan was updated.'
                    });
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to update the offering price plan.')
                    });
                }
            );
        });

        var detailPromise = Offering.detail($state.params.offeringId);
        detailPromise.then(
            function(productOffering) {
                vm.item = productOffering;
                vm.data = angular.copy(productOffering);

                vm.categories = {};
                vm.data.category.forEach((category) => {
                    vm.categories[category.id] = category;
                });
                vm.isOpen = isOpenOffering();

                Promise.all(productOffering.productOfferingPrice.map((priceRef) => {
                    return Offering.getPricing(priceRef.id)
                })).then((pricings) => {
                    vm.pricingModels = pricings
                })
            },
            function(response) {
                vm.error = Utils.parseError(response, 'Unexpected error trying to retrieve the offering.');
            }
        );

        var slaPromise = Offering.getSla($state.params.offeringId);
        slaPromise.then(function (slaRetrieved) {
            vm.sla = slaRetrieved;
        }, function (response){
            vm.error = Utils.parseError(response, 'The requested SLA could not be retrieved');
            vm.item.status = ERROR;
        });

        Object.defineProperty(vm, 'status', {
            get: function() {
                return detailPromise != null ? detailPromise.$$state.status : -1;
            }
        });

        var createPricePlanPromise = null;

        function switchOpenStatus() {
            // Change between free and open offering when no price plan
            // has been provided
            if (!isFreeOffering()) {
                return;
            }

            if (isOpenOffering()) {
                // Make the offering free
                removePricePlan(0);
            } else {
                // Make the offering open
                appendPricePlan({
                    'name': 'Open',
                    'description': 'The offering is open, so it can be directly accessed'
                })
            }
        }

        function isOpenOffering() {
            return vm.item.productOfferingPrice.length == 1 &&
                vm.item.productOfferingPrice[0].name.toLowerCase() == 'open';
        }

        function isFreeOffering() {
            // Return true if the offering is free or open
            return !vm.pricingModels.length || isOpenOffering();
        }

        function appendPricePlan(plan) {
            createPricePlanPromise = vm.item.appendPricePlan(plan);
            createPricePlanPromise.then(
                function() {
                    vm.pricePlan = new Offering.PricePlan();
                    vm.pricePlanEnabled = false;
                    vm.priceAlterationType = vm.PRICE_ALTERATIONS_SUPPORTED.NOTHING;
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                        message: 'The offering price plan was created.'
                    });
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to create the offering price plan.')
                    });
                }
            );
        }

        function createPricePlan() {
            // Check if the offering was open
            if (isOpenOffering()) {
                vm.item.productOfferingPrice = [];
                vm.isOpen = false;
            }
            appendPricePlan(vm.pricePlan);
        }

        Object.defineProperty(createPricePlan, 'status', {
            get: function() {
                return createPricePlanPromise != null ? createPricePlanPromise.$$state.status : -1;
            }
        });

        function updatePricePlan(index) {
            var pricePlan = angular.copy(vm.item.productOfferingPrice[index]);
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATE, index, pricePlan);
        }

        Object.defineProperty(updatePricePlan, 'status', {
            get: function() {
                return updatePricePlanPromise != null ? updatePricePlanPromise.$$state.status : -1;
            }
        });

        var removePricePlanPromise = null;

        function removePricePlan(index) {
            removePricePlanPromise = vm.item.removePricePlan(index);
            removePricePlanPromise.then(
                function() {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                        message: 'The offering price plan was removed.'
                    });
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to remove the offering price plan.')
                    });
                }
            );
        }

        function setAlteration(alterationType) {
            vm.priceAlterationType = alterationType;
            vm.pricePlan.resetPriceAlteration(alterationType);
        }

        Object.defineProperty(removePricePlan, 'status', {
            get: function() {
                return removePricePlanPromise != null ? removePricePlanPromise.$$state.status : -1;
            }
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function updateCategories() {
            let name, category = [];
            let updatedData = {
                category: []
            }

            // Add parent categories to update list
            for (name in vm.categories) {
                category = category.concat(vm.categories[name].getBreadcrumb(), vm.categories[name]);
            }

            category.forEach((cat) => {
                updatedData.category.push({
                    id: cat.id,
                    href: cat.href
                })
            });

            vm.catStatus = vm.STATUS.PENDING;
            Offering.update(vm.item, updatedData).then((offering) => {
                vm.catStatus = vm.STATUS.LOADED;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'offering',
                    name: offering.name
                });
            }, (response) => {
                vm.catStatus = vm.STATUS.LOADED;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the offering.')
                });
            });
        }

        var updatePromise = null;

        function update() {
            var dataUpdated = {};

            Offering.PATCHABLE_ATTRS.forEach(function(attr) {
                if (!angular.equals(vm.item[attr], vm.data[attr])) {
                    dataUpdated[attr] = vm.data[attr];
                }
            });

            // Check what info has been modified
            updatePromise = Offering.update(vm.item, dataUpdated);
            updatePromise.then(
                function(offeringUpdated) {
                    $state.go(
                        'stock.offering.update',
                        {
                            offeringId: offeringUpdated.id
                        },
                        {
                            reload: true
                        }
                    );
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                        resource: 'offering',
                        name: offeringUpdated.name
                    });
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to update the offering.')
                    });
                }
            );
        }

        Object.defineProperty(update, 'status', {
            get: function() {
                return updatePromise != null ? updatePromise.$$state.status : -1;
            }
        });
    }
})();
