/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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
        .factory('Offering', ['$q', '$resource', 'URLS', 'CHARGE_PERIODS', 'CURRENCY_CODES', 'TAX_RATE', 'LIFECYCLE_STATUS', 'User', 'ProductSpec', 'Category', ProductOfferingService]);

    function ProductOfferingService($q, $resource, URLS, CHARGE_PERIODS, CURRENCY_CODES, TAX_RATE, LIFECYCLE_STATUS, User, ProductSpec, Category) {
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

        var CHARGE_PERIOD = {};

        CHARGE_PERIODS.forEach(function (period) {
            CHARGE_PERIOD[period.title.toUpperCase()] = period.title.toLowerCase();
        });

        var CURRENCY_CODE = {};

        CURRENCY_CODES.forEach(function (code) {
            CURRENCY_CODE[code.value] = code.title;
        });

        var TYPES = {
            CHARGE_PERIOD: CHARGE_PERIOD,
            CURRENCY_CODE: CURRENCY_CODE,
            PRICE: {
                ONE_TIME: 'one time',
                RECURRING: 'recurring',
                USAGE: 'usage'
            },
            PRICE_ALTERATION: {
                DISCOUNT: {code: 'discount', name: 'Discount'},
                FEE: {code: 'fee', name: 'Fee'}
            },
            PRICE_ALTERATION_SUPPORTED: {
                PRICE_COMPONENT: 'Price component',
                DISCOUNT_OR_FEE: 'Discount or fee',
                NOTHING: 'None'
            },
            PRICE_CONDITION: {
                EQ: {code: 'eq', name: 'Equal'},
                LT: {code: 'lt', name: 'Less than'},
                LE: {code: 'le', name: 'Less than or equal'},
                GT: {code: 'gt', name: 'Greater than'},
                GE: {code: 'ge', name: 'Greater than or equal'}
            }
        };

        var TEMPLATES = {
            PRICE: {
                currencyCode: CURRENCY_CODES[0].value,
                dutyFreeAmount: 0,
                percentage: 0,
                taxIncludedAmount: 0,
                taxRate: TAX_RATE,
            },
            PRICE_ALTERATION: {
                description: '',
                isPercentage: true,
                name: TYPES.PRICE_ALTERATION.FEE.code,
                price: {},
                priceAlterationType: TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_COMPONENT,
                priceCondition: 0,
                priceConditionOperator: TYPES.PRICE_CONDITION.GE.code,
                priceType: TYPES.PRICE.ONE_TIME,
                recurringChargePeriod: '',
                unitOfMeasure: ''
            },
            PRICE_PLAN: {
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

        const serializeAlteration = function(priceAlteration) {
            var result = '';

            switch (priceAlteration.priceAlterationType) {
            case TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_CONDITION:
                result += '+ ' + PricePlan.prototype.toString.call(priceAlteration);
                break;
            case TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE:
                result += (priceAlteration.name === TYPES.PRICE_ALTERATION.FEE.code ? '+' : '-');
                result += '' + (priceAlteration.isPercentage ? priceAlteration.price.percentage + '%' : priceAlteration.price.taxIncludedAmount + ' ' + priceAlteration.price.currencyCode);
                break;
            }

            return result;
        }

        const builtAterationJSON = function(priceAlteration) {
            var data = {
                description: priceAlteration.description,
                name: priceAlteration.name,
                price: priceAlteration.price,
                priceType: priceAlteration.priceType,
                recurringChargePeriod: priceAlteration.recurringChargePeriod,
                unitOfMeasure: priceAlteration.unitOfMeasure
            };

            switch (priceAlteration.priceAlterationType) {
            case TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_CONDITION:
                data.priceCondition = '';
                break;
            case TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE:
                data.priceCondition = priceAlteration.priceConditionOperator + ' ' + priceAlteration.priceCondition;
                break;
            }

            return data;
        }

        const formatCondition = function(priceAlteration) {
            return 'if ' + angular.lowercase(TYPES.PRICE_CONDITION[angular.uppercase(priceAlteration.priceConditionOperator)].name)
                + ' ' + priceAlteration.priceCondition + ' ' + priceAlteration.price.currencyCode;
        }

        const formatAlteration = function(priceAlteration, extended) {
            let result = '';

            if (typeof extended !== 'boolean') {
                extended = true;
            }

            if (priceAlteration.priceAlterationType === TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE) {
                result += ' ' + (extended ? formatCondition(priceAlteration) : '*');
            }

            return serializeAlteration(priceAlteration) + result;
        }

        const buildPriceJSON = function(price) {
            var data = {
                currencyCode: price.currencyCode,
                dutyFreeAmount: price.taxIncludedAmount / ((100 + price.taxRate) / 100),
                percentage: price.percentage,
                taxIncludedAmount: price.taxIncludedAmount,
                taxRate: price.taxRate
            };

            if (typeof price.arrayExcluded !== "undefined") {
                price.arrayExcluded.forEach(function (name) {
                    if (name in data) {
                        delete data[name];
                    }
                });
            }

            return data;
        }

        var Price = function Price(data, arrayExcluded) {
            angular.extend(this, angular.copy(TEMPLATES.PRICE), angular.copy(data));
            parseNumber(this, ['dutyFreeAmount', 'percentage', 'taxIncludedAmount', 'taxRate']);
            this.arrayExcluded = angular.isArray(arrayExcluded) ? arrayExcluded : [];
        };

        Price.prototype.toJSON = function toJSON() {
            return buildPriceJSON(this);
        };

        Price.prototype.toString = function toString() {
            return this.taxIncludedAmount + ' ' + this.currencyCode;
        };

        var PriceAlteration = function PriceAlteration(data) {
            angular.extend(this, angular.copy(TEMPLATES.PRICE_ALTERATION), angular.copy(data));
            this.price = new Price(this.price, ['currencyCode']);
        };

        PriceAlteration.prototype.setIsPercentage = function setIsPercentage(value) {
            this.isPercentage = value;
            this.price.percentage = 0;
            this.price.taxIncludedAmount = 0;
        };

        PriceAlteration.prototype.setType = function setType(priceType) {
            return PricePlan.prototype.setType.call(this, priceType);
        };

        PriceAlteration.prototype.format = function format(extended) {
            return formatAlteration(this, extended);
        };

        PriceAlteration.prototype.formatPriceCondition = function formatPriceCondition() {
            return formatCondition(this);
        };

        PriceAlteration.prototype.toString = function toString() {
            return serializeAlteration(this);
        };

        PriceAlteration.prototype.toJSON = function toJSON() {
            return builtAterationJSON(this);
        };

        var PricePlan = function PricePlan(data) {
            angular.extend(this, angular.copy(TEMPLATES.PRICE_PLAN), angular.copy(data));
            this.price = new Price(this.price);

            if (angular.isObject(this.productOfferPriceAlteration)) {
                extendPriceAlteration(this, this.productOfferPriceAlteration);
                this.productOfferPriceAlteration = new PriceAlteration(this.productOfferPriceAlteration);
            } else {
                delete this.productOfferPriceAlteration;
            }
        };
        PricePlan.prototype.setCurrencyCode = function setCurrencyCode(currencyCode) {

            if (this.productOfferPriceAlteration) {
                this.productOfferPriceAlteration.price.currencyCode = currencyCode;
            }

            this.price.currencyCode = currencyCode;

            return this;
        };
        PricePlan.prototype.setType = function setType(priceType) {

            if (!angular.equals(this.priceType, priceType)) {
                this.priceType = TYPES.PRICE[priceType];
                this.unitOfMeasure = '';
                this.recurringChargePeriod = '';

                switch (this.priceType) {
                case TYPES.PRICE.RECURRING:
                    this.recurringChargePeriod = TYPES.CHARGE_PERIOD.WEEKLY;
                    break;
                }
            }

            return this;
        };
        PricePlan.prototype.toString = function toString() {
            var result = '';

            switch (this.priceType) {
            case TYPES.PRICE.RECURRING:
                result = ' / ' + this.recurringChargePeriod;
                break;
            case TYPES.PRICE.USAGE:
                result = ' / ' + this.unitOfMeasure;
                break;
            }

            return this.price + result;
        };

        PricePlan.prototype.toJSON = function toJSON() {
            let plan = angular.copy(this);

            if (angular.isObject(this.productOfferPriceAlteration)) {
                plan.productOfferPriceAlteration = builtAterationJSON(this.productOfferPriceAlteration);
                plan.productOfferPriceAlteration.price = buildPriceJSON(this.productOfferPriceAlteration.price)
            }
            return plan;
        };

        PricePlan.prototype.formatPriceAlteration = function formatPriceAlteration(extended) {
            return this.productOfferPriceAlteration ? formatAlteration(this.productOfferPriceAlteration, extended) : '';
        };
        PricePlan.prototype.resetPriceAlteration = function resetPriceAlteration(priceAlterationType) {

            switch (priceAlterationType) {
            case TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_COMPONENT:
            case TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE:
                this.productOfferPriceAlteration = new PriceAlteration({
                    priceAlterationType: priceAlterationType,
                    price: {
                        currencyCode: this.price.currencyCode
                    }
                });
                break;
            default:
                delete this.productOfferPriceAlteration;
            }

            return this;
        };
        PricePlan.prototype.priceAlteration = function priceAlteration() {
            return this.productOfferPriceAlteration;
        };
        PricePlan.prototype.formatCurrencyCode = function formatCurrencyCode() {
            return '(' + this.price.currencyCode + ') ' + TYPES.CURRENCY_CODE[this.price.currencyCode];
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            PATCHABLE_ATTRS: PATCHABLE_ATTRS,
            PricePlan: PricePlan,
            PriceAlteration: PriceAlteration,
            search: search,
            count: count,
            exists: exists,
            create: create,
            detail: detail,
            update: update
        };

        function query(deferred, filters, method, callback) {
            var params = {};

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

            if (filters.type  !== undefined) {
                params['isBundle'] = filters.type == 'Bundle';
            }

            if (filters.categoryId) {
                params['category.id'] = filters.categoryId;
            }

            if (filters.action) {
                params['action'] = filters.action;
            }

            if (filters.owner) {
                params['relatedParty'] = User.loggedUser.currentUser.id;
            } else {
                params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;
            }

            if (filters.sort) {
                params['sort'] = filters.sort;
            }

            if (filters.offset !== undefined) {
                params['offset'] = filters.offset;
                params['size'] = filters.size;
            }

            if (filters.body !== undefined) {
                params['body'] = filters.body.replace(/\s/g, ',');
            }

            if (filters.productSpecId !== undefined) {
                params['productSpecification.id'] = filters.productSpecId;
            }

            method(params, function (offeringList) {
                callback(offeringList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function search(filters) {
            var deferred = $q.defer();

            function searchOfferingProducts(productFilters, offeringList) {
                ProductSpec.search(productFilters).then(function (productList) {
                    offeringList.forEach(function(offering) {
                        productList.some(function(product) {
                            if (offering.productSpecification && offering.productSpecification.id == product.id) {
                                offering.productSpecification = product;
                                return true;
                            }
                        });
                    });
                    deferred.resolve(offeringList);
                });
            }

            return query(deferred, filters, resource.query, function(offeringList) {
                if (offeringList.length) {
                    var bundleOfferings = [];
                    var productFilters = {
                        id: offeringList.map(function (offering) {
                            var offId = '';
                            extendPricePlans(offering);

                            if (!offering.isBundle) {
                                offId = offering.productSpecification.id;
                            } else {
                                bundleOfferings.push(offering);
                            }
                            return offId;
                        }).join()
                    };

                    if (!bundleOfferings.length) {
                        searchOfferingProducts(productFilters, offeringList);
                    } else {
                        var processed = 0;
                        bundleOfferings.forEach(function(offering) {
                            attachOfferingBundleProducts(offering, function(res) {
                                processed += 1;

                                if (res) {
                                    deferred.reject(res);
                                } else if (processed == bundleOfferings.length) {
                                    searchOfferingProducts(productFilters, offeringList);
                                }
                            });
                        });
                    }

                } else {
                    deferred.resolve(offeringList);
                }
            });
        }

        function count(filters) {
            var deferred = $q.defer();
            filters.action = 'count';

            return query(deferred, filters, resource.get, function (countRes) {
                deferred.resolve(countRes);
            });
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
                bundledProductOffering: data.bundledProductOffering.map(function (offering) {
                    return offering.serialize();
                })
            });

            if(!data.isBundle) {
                angular.extend(data, {
                    productSpecification: product.serialize()
                });
            }

            data.validFor = {
                startDateTime: moment().format()
            };

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

        function attachOfferingBundleProducts(offering, callback) {
            if (!angular.isArray(offering.bundledProductOffering)) {
                offering.bundledProductOffering = [];
            }

            var params = {
                id: offering.bundledProductOffering.map(function (data) {
                    return data.id;
                }).join()
            };

            resource.query(params, function (offeringList) {
                offering.bundledProductOffering = offeringList;
                var bundleIndexes = {};
                var productParams = {
                    id: offeringList.map(function (data, index) {
                        extendPricePlans(data);
                        bundleIndexes[data.productSpecification.id] = index;
                        return data.productSpecification.id
                    }).join()
                };

                ProductSpec.search(productParams).then(function (productList) {
                    // Include product spec info in bundled offering
                    productList.forEach(function (product) {
                        offering.bundledProductOffering[bundleIndexes[product.id]].productSpecification = product;
                    });
                    callback();
                }, function (response) {
                    callback(response);
                });
            }, function (response) {
                callback(response);
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
                    if (productOffering.productSpecification) {
                        ProductSpec.detail(productOffering.productSpecification.id).then(function (productRetrieved) {
                            productOffering.productSpecification = productRetrieved;
                            detailRelationship(productOffering);
                        });
                    } else {
                        extendBundledProductOffering(productOffering);
                    }
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
                        extendCategory(productOffering);
                    }, function (response) {
                        deferred.reject(response);
                    });
                } else {
                    extendCategory(productOffering);
                }
            }

            function extendBundledProductOffering(offering) {

                if (offering.isBundle) {
                    attachOfferingBundleProducts(offering, function(res) {
                        if (res) {
                            deferred.reject(res);
                        } else {
                            extendCategory(offering);
                        }
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
            var picture = null;
            if (this.productSpecification) {
                picture = this.productSpecification.getPicture();
            } else {
                // The offering is a bundle, get a random image from its bundled offerings
                var imageIndex = Math.floor(Math.random() * (this.bundledProductOffering.length));
                picture = this.bundledProductOffering[imageIndex].productSpecification.getPicture();
            }
            return picture;
        }

        function formatCheapestPricePlan(extended) {
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
                    result = 'From ' + pricePlan.toString() + '\n' + pricePlan.formatPriceAlteration(extended);
                } else {
                    pricePlans = this.productOfferingPrice.filter(function (pricePlan) {
                        return [TYPES.PRICE.RECURRING, TYPES.PRICE.USAGE].indexOf(angular.lowercase(pricePlan.priceType)) !== -1;
                    });
                    result = 'From ' + pricePlans[0].toString() + '\n' + pricePlans[0].formatPriceAlteration(extended);
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

        function extendPriceAlteration(pricePlan, priceAlteration) {

            if (angular.isString(priceAlteration.priceCondition) && priceAlteration.priceCondition.length) {
                var priceCondition = getPriceCondition(priceAlteration);
                priceAlteration.priceCondition = priceCondition.value;
                priceAlteration.priceConditionOperator = priceCondition.operator;
                priceAlteration.isPercentage = !!priceAlteration.price.percentage;
                priceAlteration.priceAlterationType = TYPES.PRICE_ALTERATION_SUPPORTED.DISCOUNT_OR_FEE;
            } else {
                priceAlteration.priceAlterationType = TYPES.PRICE_ALTERATION_SUPPORTED.PRICE_COMPONENT;
            }

            priceAlteration.price.currencyCode = pricePlan.price.currencyCode;

            return priceAlteration;
        }

        function getPriceCondition(priceAlteration) {
            return {
                operator: priceAlteration.priceCondition.split(" ")[0],
                value: Number(priceAlteration.priceCondition.split(" ")[1])
            };
        }
    }

})();
