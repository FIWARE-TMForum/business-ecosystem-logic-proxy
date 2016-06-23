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

    angular
        .module('app')
        .factory('Offering', ProductOfferingService);

    function ProductOfferingService($q, $resource, URLS, LIFECYCLE_STATUS, User, ProductSpec, Category) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogue/:catalogueId/productOffering/:offeringId', {
            offeringId: '@id'
        }, {
            update: {method: 'PATCH'}
        });

        resource.prototype.formatCheapestPricePlan = formatCheapestPricePlan;
        resource.prototype.getCategories = getCategories;
        resource.prototype.getPicture = getPicture;
        resource.prototype.serialize = serialize;
        resource.prototype.appendPricePlan = appendPricePlan;
        resource.prototype.updatePricePlan = updatePricePlan;
        resource.prototype.removePricePlan = removePricePlan;
        resource.prototype.relationshipOf = relationshipOf;
        resource.prototype.relationships = relationships;

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
                    context[name] = Number(context[name]);
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
                        detailRelationship(productOffering);
                    });
                } else {
                    deferred.reject(404);
                }
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function detailRelationship(productOffering) {
                if (productOffering.productSpecification.productSpecificationRelationship.length) {
                    var params = {
                        'productSpecification.id': productOffering.productSpecification.productSpecificationRelationship.map(function (relationship) {
                            relationship.productOffering = [];
                            return relationship.productSpec.id;
                        }).join()
                    };

                    resource.query(params, function (collection) {
                        if (collection.length) {
                            collection.forEach(function (productOfferingRelated) {
                                extendPricePlans(productOfferingRelated);
                                productOffering.productSpecification.productSpecificationRelationship.forEach(function (relationship) {
                                    if (productOfferingRelated.productSpecification.id === relationship.productSpec.id) {
                                        productOfferingRelated.productSpecification = relationship.productSpec;
                                        relationship.productOffering.push(productOfferingRelated);
                                    }
                                });
                            });
                        }
                        extendBundledProductOffering(productOffering);
                    }, function (response) {
                        deferred.reject(response);
                    });
                } else {
                    extendBundledProductOffering(productOffering);
                }
            }

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

        function formatCheapestPricePlan() {
            /* jshint validthis: true */
            var result = "", pricePlan = null, pricePlans = [];

            if (this.productOfferingPrice.length) {
                pricePlans = this.productOfferingPrice.filter(function (pricePlan) {
                    return angular.lowercase(pricePlan.priceType) === TYPES.PRICE.ONE_TIME;
                });

                if (pricePlans.length) {
                    for (var i = 0; i < pricePlans.length; i++) {
                        if (pricePlan == null || Number(pricePlan.price.taxIncludedAmount) > Number(pricePlans[i].price.taxIncludedAmount)) {
                            pricePlan = this.productOfferingPrice[i];
                        }
                    }
                    result = 'From ' + pricePlan.toString();
                } else {
                    pricePlans = this.productOfferingPrice.filter(function (pricePlan) {
                        return [TYPES.PRICE.RECURRING, TYPES.PRICE.USAGE].indexOf(angular.lowercase(pricePlan.priceType)) !== -1;
                    });
                    result = 'From ' + pricePlans[0].toString();
                }
            } else {
                result = 'Free';
            }

            return result;
        }

        function appendPricePlan(pricePlan) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                productOfferingPrice: this.productOfferingPrice.concat(pricePlan)
            };

            update(this, dataUpdated).then(function () {
                this.productOfferingPrice.push(pricePlan);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function updatePricePlan(index, pricePlan) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                productOfferingPrice: this.productOfferingPrice.slice(0)
            };

            dataUpdated.productOfferingPrice[index] = pricePlan;

            update(this, dataUpdated).then(function () {
                angular.merge(this.productOfferingPrice[index], pricePlan);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function removePricePlan(index) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                productOfferingPrice: this.productOfferingPrice.slice(0)
            };

            dataUpdated.productOfferingPrice.splice(index, 1);

            update(this, dataUpdated).then(function () {
                this.productOfferingPrice.splice(index, 1);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function relationshipOf(productOffering) {
            /* jshint validthis: true */
            var i, relationship;

            for (var i = 0; i < this.productSpecification.productSpecificationRelationship.length; i++) {
                relationship = this.productSpecification.productSpecificationRelationship[i];
                if (relationship.productOffering.indexOf(productOffering) !== -1) {
                    return relationship;
                }
            }

            return null;
        }

        function relationships() {
            /* jshint validthis: true */
            var results = [];

            this.productSpecification.productSpecificationRelationship.forEach(function (relationship) {
                results = results.concat(relationship.productOffering);
            });

            return results;
        }
    }

})();
