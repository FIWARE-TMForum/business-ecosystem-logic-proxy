/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Offering', OfferingService);

    function OfferingService($q, $resource, URLS, LIFECYCLE_STATUS, User, ProductSpec, Category) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogue/:catalogueId/productOffering/:offeringId', {
            offeringId: '@id'
        }, {
            update: {
                method: 'PATCH'
            }
        });

        var PRICE_TYPES = {
            ONE_TIME: 'one time',
            RECURRING: 'recurring',
            USAGE: 'usage'
        };

        var PRICE_CURRENCIES = {
            EUR: 'Euro',
            USD: 'US Dollar',
            CAD: 'Canadian Dollar'
        };

        var PRICE_PERIODS = {
            WEEKLY: 'Weekly',
            MONTHLY: 'Monthly',
            YEARLY: 'Yearly'
        };

        resource.prototype.getCategories = getCategories;
        resource.prototype.getPicture = getPicture;
        resource.prototype.getCheapestPriceplan = getCheapestPriceplan;
        resource.prototype.formatCheapestPriceplan = formatCheapestPriceplan;
        resource.prototype.serialize = serialize;

        return {
            PRICE_TYPES: PRICE_TYPES,
            PRICE_CURRENCIES: PRICE_CURRENCIES,
            PRICE_PERIODS: PRICE_PERIODS,
            search: search,
            exists: exists,
            create: create,
            detail: detail,
            update: update,
            buildInitialData: buildInitialData,
            createPricePlan: createPricePlan
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {}, productFilters = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.catalogueId) {
                params.catalogue = 'catalog';
                params.catalogueId = filters.catalogueId;
            }

            if (filters.id) {
                params['id'] = filters.id;
            }

            if (filters.status) {
                params['lifecycleStatus'] = filters.status;
            }

            if (filters.type) {
                params['isBundle'] = filters.type == 'Bundle';
            }

            if (filters.categoryId) {
                params['category.id'] = filters.categoryId;
            }

            if (filters.owner) {
                productFilters['owner'] = true;

                ProductSpec.search(productFilters).then(function (productList) {
                    var products = {};

                    if (productList.length) {
                        params['productSpecification.id'] = productList.map(function (product) {
                            products[product.id] = product;
                            return product.id;
                        }).join();

                        resource.query(params, function (offeringList) {
                            offeringList.forEach(function (offering) {
                                offering.productSpecification = products[offering.productSpecification.id];
                            });
                            deferred.resolve(offeringList);
                        }, function(response) {
                            deferred.reject(response);
                        });
                    } else {
                        deferred.resolve([]);
                    }
                }, function(response) {
                    deferred.reject(response);
                });
            } else {
                params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;

                resource.query(params, function (offeringList) {

                    if (offeringList.length) {
                        productFilters.id = offeringList.map(function (offering) {
                            return offering.productSpecification.id;
                        }).join();

                        ProductSpec.search(productFilters).then(function (productList) {
                            offeringList.forEach(function(offering) {
                                productList.some(function(product) {
                                    if (offering.productSpecification.id == product.id) {
                                        offering.productSpecification = product;
                                        return true;
                                    }
                                });
                            });
                            deferred.resolve(offeringList);
                        });
                    } else {
                        deferred.resolve(offeringList);
                    }
                }, function (response) {
                    deferred.reject(response);
                });
            }

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function (offeringList) {
                deferred.resolve(!!offeringList.length);
            });

            return deferred.promise;
        }

        function create(data, product, catalogue) {
            var deferred = $q.defer();
            var params = {
                catalogue: 'catalog',
                catalogueId: catalogue.id
            };
            var bundledProductOffering = data.bundledProductOffering;

            angular.extend(data, {
                category: data.category.map(function (category) {
                    return category.serialize();
                }),
                productSpecification: product.serialize(),
                bundledProductOffering: data.bundledProductOffering.map(function (offering) {
                    return offering.serialize();
                })
            });

            resource.save(params, data, function (offeringCreated) {
                offeringCreated.productSpecification = product;
                offeringCreated.bundledProductOffering = bundledProductOffering;
                deferred.resolve(offeringCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(offeringId) {
            var deferred = $q.defer();
            var params = {
                id: offeringId
            };

            resource.query(params, function (offeringList) {

                if (offeringList.length) {
                    var offeringRetrieved = offeringList[0];

                    ProductSpec.detail(offeringRetrieved.productSpecification.id).then(function (productRetrieved) {
                        offeringRetrieved.productSpecification = productRetrieved;
                        extendBundledProductOffering(offeringRetrieved);
                    });
                } else {
                    deferred.reject(404);
                }
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function extendBundledProductOffering(offering) {

                if (!angular.isArray(offering.bundledProductOffering)) {
                    offering.bundledProductOffering = [];
                }

                if (offering.isBundle) {
                    var params = {
                        id: offering.bundledProductOffering.map(function (data) {
                            return data.id;
                        }).join()
                    };

                    resource.query(params, function (offeringList) {
                        offering.bundledProductOffering = offeringList;
                        extendCategory(offering);
                    }, function (response) {
                        deferred.reject(response);
                    });
                } else {
                    extendCategory(offering);
                }
            }

            function extendCategory(offering) {
                var categories = 0;

                if (!angular.isArray(offering.category)) {
                    offering.category = [];
                }

                if (offering.category.length) {
                    offering.category.forEach(function (data, index) {
                        Category.detail(data.id, false).then(function (categoryRetrieved) {
                            offering.category[index] = categoryRetrieved;
                            categories++;

                            if (categories === offering.category.length) {
                                deferred.resolve(offering);
                            }
                        });
                    });
                } else {
                    deferred.resolve(offering);
                }
            }
        }

        function update(offering, data) {
            var deferred = $q.defer();
            var params = {
                catalogue: 'catalog',
                catalogueId: getCatalogueId(offering),
                offeringId: offering.id
            };

            resource.update(params, data, function (offeringUpdated) {
                deferred.resolve(offeringUpdated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function getCatalogueId(offering) {
            var keys = offering.href.split('/');
            return keys[keys.indexOf('catalog') + 1];
        }

        function buildInitialData() {
            return {
                version: '0.1',
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                isBundle: false,
                bundledProductOffering: [],
                productOfferingPrice: [],
                category: [],
                validFor: {},
                description: ''
            };
        }

        function serialize() {
            /* jshint validthis: true */
            return {
                id: this.id,
                href: this.href
            };
        }

        function getCategories() {
            /* jshint validthis: true */
            var ids = this.category.filter(hasParentId).map(getParentId);

            return this.category.filter(function (category) {
                return ids.indexOf(category.id) === -1;
            });

            function hasParentId(category) {
                return !category.isRoot;
            }

            function getParentId(category) {
                return category.parentId;
            }
        }

        function getPicture() {
            /* jshint validthis: true */
            return this.productSpecification.getPicture();
        }

        function getCheapestPriceplan() {
            /* jshint validthis: true */
            var i, priceplan = null;

            // There can be offerings without price plan
            if (this.productOfferingPrice) {
                for (i = 0; i < this.productOfferingPrice.length; i++) {
                    if (this.productOfferingPrice[i].priceType === 'one time') {
                        if (priceplan == null || Number(priceplan.price.taxIncludedAmount) > Number(this.productOfferingPrice[i].price.taxIncludedAmount)) {
                            priceplan = this.productOfferingPrice[i];
                        }
                    }
                }
            }

            return priceplan;
        }

        function formatCheapestPriceplan() {
            /* jshint validthis: true */
            var i, priceplan = "";

            if (angular.isArray(this.productOfferingPrice) && this.productOfferingPrice.length) {

                for (i = 0; i < this.productOfferingPrice.length; i++) {
                    if (this.productOfferingPrice[i].priceType === 'one time') {
                        if (!priceplan || Number(priceplan.price.taxIncludedAmount) > Number(this.productOfferingPrice[i].price.taxIncludedAmount)) {
                            priceplan = this.productOfferingPrice[i];
                        }
                    }
                }

                priceplan = "From " + priceplan.price.taxIncludedAmount + " " + angular.uppercase(priceplan.price.currencyCode);
            } else {
                priceplan = "Free";
            }

            return priceplan;
        }

        function createPricePlan() {
            return {
                name: "",
                description: "",
                priceType: PRICE_TYPES.ONE_TIME,
                recurringChargePeriod: "",
                unitOfMeasure: "",
                price: {
                    taxRate: 20,
                    taxIncludedAmount: 0,
                    dutyFreeAmount: 0,
                    percentage: 0,
                    currencyCode: 'EUR'
                }
            };
        }
    }

})();
