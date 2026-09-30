/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2025 Future Internet Consulting and Development Solutions S.L.
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

const AccountingService = require('./../../db/schemas/accountingService');
const async = require('async');
const url = require('url');
const storeClient = require('./../../lib/store').storeClient;
const utils = require('./../../lib/utils');
const tmfUtils = require('./../../lib/tmfUtils');
const config = require('./../../config');
const axios = require('axios');


const usageManagement = (function() {
    const RETIRED_STATE = 'retired';
    const OBSOLETE_STATE = 'obsolete';
    const LAUNCHED_STATE = 'launched';
    const CATALOG_QUERY_PAGE_SIZE = 100;
    const USAGE_SPEC_IN_ACTIVE_OFFER_ERROR = 'The usage spec cannot be deleted because it is being used by active or launched product offers';

    const checkFilters = function(req, callback) {
        // If retrieving the usage of a particular product
        // refresh the accounting info
        if (!!req.query && !!req.query['usageCharacteristic.orderId'] && !!req.query['usageCharacteristic.productId']) {
            return storeClient.refreshUsage(
                req.query['usageCharacteristic.orderId'],
                req.query['usageCharacteristic.productId'],
                callback
            );
        }

        // if (!!req.query && req.query['usageCharacteristic.value']) {
        //     // By default productId value
        //     req.query['usageCharacteristic.productId'] = req.query['usageCharacteristic.value'];
        //     delete req.query['usageCharacteristic.value'];
        // }

        return callback(null);
    };

    const retrieveAsset = function(path, callback) {
        const resPath = path.replace(`/${config.endpoints.usage.path}/`, '')
        
        const url = utils.getAPIURL(
            config.endpoints.usage.appSsl,
            config.endpoints.usage.host,
            config.endpoints.usage.port,
            `${config.endpoints.usage.apiPath}/${resPath}`
        );

        axios.get(url).then((response) => {
            if (response.status >= 400) {
                callback({
                    status: response.status
                });
            } else {
                callback(null, {
                    status: response.status,
                    body: response.data
                });
            }
        }).catch((err) => {
            let errCb = {
                status: err.status
            }

            if (err.response) {
                errCb = {
                    status: err.response.status
                }
            }
            callback(errCb);
        })
    };

    const retrieveCatalogAsset = function(path) {
        const reqPath = path.startsWith('/') ? path : `/${path}`;
        const assetUrl = utils.getAPIURL(
            config.endpoints.catalog.appSsl,
            config.endpoints.catalog.host,
            config.endpoints.catalog.port,
            `${config.endpoints.catalog.apiPath}${reqPath}`
        );

        return axios.get(assetUrl).then((response) => {
            if (response.status >= 400) {
                throw {
                    status: response.status
                };
            }

            return {
                status: response.status,
                body: response.data
            };
        }).catch((err) => {
            if (err.response) {
                throw {
                    status: err.response.status
                };
            }

            throw {
                status: err.status
            };
        });
    }

    const asArray = function(value) {
        if (Array.isArray(value)) {
            return value;
        }

        return value ? [value] : [];
    }

    const addPagination = function(path, offset) {
        const separator = path.indexOf('?') >= 0 ? '&' : '?';

        return `${path}${separator}limit=${CATALOG_QUERY_PAGE_SIZE}&offset=${offset}`;
    }

    const retrieveAllCatalogAssets = async function(path) {
        const assets = [];
        let offset = 0;
        let page;

        do {
            const result = await retrieveCatalogAsset(addPagination(path, offset));
            page = asArray(result.body);
            assets.push(...page);
            offset += page.length;
        } while (page.length === CATALOG_QUERY_PAGE_SIZE);

        return assets;
    }

    const isLaunchedToRetiredUpdate = function(prevBody, body) {
        return !!prevBody.lifecycleStatus &&
            !!body.lifecycleStatus &&
            prevBody.lifecycleStatus.toLowerCase() === LAUNCHED_STATE &&
            body.lifecycleStatus.toLowerCase() === RETIRED_STATE;
    }

    const getUsageSpecPricePlans = async function(usageSpecId) {
        const usagePrices = await retrieveAllCatalogAssets(
            `/productOfferingPrice?usageSpecId=${encodeURIComponent(usageSpecId)}`
        );
        const pricePlanIds = new Set();

        for (const usagePrice of usagePrices) {
            if (usagePrice.isBundle === true) {
                pricePlanIds.add(usagePrice.id);
            } else {
                const pricePlans = await retrieveAllCatalogAssets(
                    `/productOfferingPrice?bundledPopRelationship.id=${encodeURIComponent(usagePrice.id)}`
                );
                pricePlans
                    .filter((pricePlan) => pricePlan.isBundle === true)
                    .forEach((pricePlan) => pricePlanIds.add(pricePlan.id));
            }
        }

        return Array.from(pricePlanIds);
    }

    const getOfferingsForPricePlans = async function(pricePlanIds) {
        if (pricePlanIds.length === 0) {
            return [];
        }

        return retrieveAllCatalogAssets(
            `/productOffering?productOfferingPrice.id=${pricePlanIds.map(encodeURIComponent).join(',')}`
        );
    }

    const validateUsageSpecRetirement = async function(prevBody) {
        const pricePlanIds = await getUsageSpecPricePlans(prevBody.id);
        const offerings = await getOfferingsForPricePlans(pricePlanIds);

        const hasActiveOffering = offerings.some((offering) => {
            const status = String(offering.lifecycleStatus || '').toLowerCase();

            return status !== RETIRED_STATE && status !== OBSOLETE_STATE;
        });

        if (hasActiveOffering) {
            return {
                status: 409,
                message: USAGE_SPEC_IN_ACTIVE_OFFER_ERROR
            };
        }

        return null;
    }

    const checkRelatedParty = function(req, callback){
        if (!req.query['relatedParty.id'] || req.user.partyId != req.query['relatedParty.id']){
            return callback({ status: 403, message: 'invalid request'})
        }

        return callback(null)
    }

    const parseBody = function (req, callback) {
        try {
            req.parsedBody = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });

            return; // EXIT
        }
        callback(null)
    }

    const validateOwner = function(req, body, callback) {
        if (!tmfUtils.hasPartyRole(req, body.relatedParty, config.roles.seller)) {
            callback({
                status: 403,
                message: 'Unauthorized to create/update non-owned usage specs'
            });
        } else {
            callback(null)
        }
    };

    const validateOwnerCreate = function(req, callback) {
        return validateOwner(req, req.parsedBody, callback);
    }

    const validateOwnerUpdate = function(req, callback) {
        return validateOwner(req, req.prevBody, callback);
    }

    const validateUpdate = function(req, callback) {
        const body = req.parsedBody;
        const prevBody = req.prevBody;

        if (!isUsageSpecificationRequest(req)) {
            return callback(null);
        }

        if (body.lifecycleStatus != null && !tmfUtils.isValidStatusTransition(prevBody.lifecycleStatus, body.lifecycleStatus)) {
            return callback({
                status: 400,
                message: `Cannot transition from lifecycle status ${prevBody.lifecycleStatus} to ${body.lifecycleStatus}`
            });
        }

        if (!isLaunchedToRetiredUpdate(prevBody, body)) {
            return callback(null);
        }

        validateUsageSpecRetirement(prevBody).then((err) => {
            callback(err);
        }).catch(() => {
            callback({
                status: 500,
                message: 'The product offers using the usage spec cannot be retrieved'
            });
        });
    }

    const isUsageSpecificationRequest = function(req) {
        return /\/usageSpecification(?:\/|\?|$)/.test(req.apiUrl || req.url || '');
    }

    const setUsageSpecLastUpdate = function(req, callback) {
        if (isUsageSpecificationRequest(req)) {
            req.parsedBody.lastUpdate = new Date().toISOString();
            utils.updateBody(req, req.parsedBody);
        }

        callback(null);
    }

    const getPrevVersion = function(req, callback) {
        retrieveAsset(req.apiUrl, (err, response) => {
            if (err) {
                if (err.status === 404) {
                    callback({
                        status: 404,
                        message: 'The required usage spec does not exist'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'The required usage spec cannot be created/updated'
                    });
                }
            } else {
                req.prevBody = response.body
                callback(null)
            }
        });
    }

    // If the usage notification to the usage management API is successful,
    // it will notify the the Store with the API response
    const executePostValidation = function(req, callback) {
        // const body = req.body;
        // const expr = /usage($|\/)/;

        // if (req.method === 'POST' && req.status === 201 && expr.test(req.apiUrl)) {
        //     storeClient.validateUsage(body, callback);
        // } else {
        //     return callback(null);
        // }
        return callback(null);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validators = {
        GET: [utils.validateLoggedIn, tmfUtils.filterRelatedPartyFields, checkRelatedParty],
        POST: [utils.validateLoggedIn, parseBody, validateOwnerCreate, setUsageSpecLastUpdate],
        PATCH: [utils.validateLoggedIn, parseBody, getPrevVersion, validateUpdate, validateOwnerUpdate, setUsageSpecLastUpdate],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.methodNotAllowed]
    };

    const checkPermissions = function(req, callback) {
        let reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.usageManagement = usageManagement;
