/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Offering', ProductOfferingService);

    function ProductOfferingService($q, $resource, URLS, LIFECYCLE_STATUS, User, ProductSpec, Category) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogue/:catalogueId/productOffering/:offeringId', {
            offeringId: '@id'
        }, {
            update: {method: 'PATCH'}
        });

        resource.prototype.getCategories = getCategories;
        resource.prototype.getCheapestPricePlan = getCheapestPricePlan;
        resource.prototype.getPicture = getPicture;
        resource.prototype.serialize = serialize;
        resource.prototype.appendPricePlan = appendPricePlan;
        resource.prototype.removePricePlan = removePricePlan;

        var PATCHABLE_ATTRS = ['description', 'lifecycleStatus', 'name', 'version'];

        var EVENTS = {
            PRICEPLAN_UPDATE: '$pricePlanUpdate',
            PRICEPLAN_UPDATED: '$pricePlanUpdated'
        };

        var TYPES = {
            CHARGE_PERIOD: {
                MONTHLY: 'monthly',
                WEEKLY: 'weekly',
                YEARLY: 'yearly'
            },
            CURRENCY_CODE: {
                CAD: 'canadian dollar',
                EUR: 'euro',
                USD: 'us dollar'
            },
            PRICE: {
                ONE_TIME: 'one time',
                RECURRING: 'recurring',
                USAGE: 'usage'
            }
        };

        var TEMPLATES = {
            PRICE: {
                currencyCode: 'EUR',
                dutyFreeAmount: 0,
                percentage: 0,
                taxIncludedAmount: 0,
                taxRate: 20
            },
            PRICEPLAN: {
                description: '',
                name: '',
                price: {},
                priceType: TYPES.PRICE.ONE_TIME,
                recurringChargePeriod: '',
                unitOfMeasure: ''
            },
            RESOURCE: {
                bundledProductOffering: [],
                category: [],
                description: '',
                isBundle: false,
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                name: '',
                place: [],
                productOfferingPrice: [],
                validFor: {},
                version: '0.1'
            }
        };

        var Price = function Price(data) {
            angular.extend(this, TEMPLATES.PRICE, data);
            parseNumber(this, ['dutyFreeAmount', 'percentage', 'taxIncludedAmount', 'taxRate']);
        };
        Price.prototype.setCurrencyCode = function setCurrencyCode(codeName) {

            if (codeName in TYPES.CURRENCY_CODE) {
                this.currencyCode = codeName;
            }

            return this;
        };
        Price.prototype.toJSON = function toJSON() {
            return {
                currencyCode: this.currencyCode,
                dutyFreeAmount: this.taxIncludedAmount / ((100 + this.taxRate) / 100),
                percentage: this.percentage,
                taxIncludedAmount: this.taxIncludedAmount,
                taxRate: this.taxRate
            };
        };
        Price.prototype.toString = function toString() {
            return this.taxIncludedAmount + ' ' + angular.uppercase(this.currencyCode);
        };

        var PricePlan = function PricePlan(data) {
            angular.extend(this, TEMPLATES.PRICEPLAN, data);
            this.price = new Price(this.price);
        };
        PricePlan.prototype.setType = function setType(typeName) {

            if (typeName in TYPES.PRICE && !angular.equals(this.priceType, typeName)) {
                this.priceType = TYPES.PRICE[typeName];
                this.unitOfMeasure = '';
                this.recurringChargePeriod = '';

                switch (angular.lowercase(this.priceType)) {
                case TYPES.PRICE.RECURRING:
                    this.recurringChargePeriod = TYPES.CHARGE_PERIOD.WEEKLY;
                    break;
                }
            }

            return this;
        };
        PricePlan.prototype.toString = function toString() {
            var result = '' + this.price.toString();

            switch (angular.lowercase(this.priceType)) {
            case TYPES.PRICE.ONE_TIME:
                break;
            case TYPES.PRICE.RECURRING:
                result += ' / ' + angular.uppercase(this.recurringChargePeriod);
                break;
            case TYPES.PRICE.USAGE:
                result += ' / ' + angular.uppercase(this.unitOfMeasure);
                break;
            }

            return result;
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            PATCHABLE_ATTRS: PATCHABLE_ATTRS,
            PricePlan: PricePlan,
            search: search,
            exists: exists,
            create: create,
            detail: detail,
            update: update
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
                                extendPricePlans(offering);
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
                            extendPricePlans(offering);
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

        function parseNumber(context, names) {
            names.forEach(function (name) {
                if (angular.isString(context[name])) {
                    context[name] = parseInt(context[name]);
                }
            });
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };

            resource.query(params, function (collection) {

                if (collection.length) {
                    var productOffering = collection[0];

                    extendPricePlans(productOffering);
                    ProductSpec.detail(productOffering.productSpecification.id).then(function (productRetrieved) {
                        productOffering.productSpecification = productRetrieved;
                        extendBundledProductOffering(productOffering);
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

        function extendPricePlans(productOffering) {
            if (!angular.isArray(productOffering.productOfferingPrice)) {
                productOffering.productOfferingPrice = [];
            } else {
                productOffering.productOfferingPrice = productOffering.productOfferingPrice.map(function (pricePlan) {
                    return new PricePlan(pricePlan);
                });
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

        function getCheapestPricePlan() {
            /* jshint validthis: true */
            var pricePlan = null;

            for (var i = 0; i < this.productOfferingPrice.length; i++) {
                if (angular.lowercase(this.productOfferingPrice[i].priceType) === TYPES.PRICE.ONE_TIME) {
                    if (pricePlan == null || Number(pricePlan.price.taxIncludedAmount) > Number(this.productOfferingPrice[i].price.taxIncludedAmount)) {
                        pricePlan = this.productOfferingPrice[i];
                    }
                }
            }

            return pricePlan;
        }

        function appendPricePlan(pricePlan) {
            /* jshint validthis: true */
            this.productOfferingPrice.push(pricePlan);
            return this;
        }

        function removePricePlan(index) {
            /* jshint validthis: true */
            this.productOfferingPrice.splice(index, 1);
            return this;
        }
    }

})();
