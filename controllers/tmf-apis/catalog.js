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

const async = require('async')
const axios = require('axios')
const config = require('./../../config')
const { X509Certificate } = require('crypto')
const deepcopy = require('deepcopy')
const equal = require('deep-equal')
const { indexes } = require('./../../lib/indexes')
const jwt = require('jsonwebtoken')
const logger = require('./../../lib/logger').logger.getLogger('TMF')
const partyClient = require('./../../lib/party').partyClient
const rssClient = require('./../../lib/rss').rssClient
const storeClient = require('./../../lib/store').storeClient
const tmfUtils = require('./../../lib/tmfUtils')
const url = require('url')
const utils = require('./../../lib/utils')
const { parse } = require('path')
const searchEngine = require('../../lib/search').searchEngine

var LIFE_CYCLE = 'lifecycleStatus';

var ACTIVE_STATE = 'active';
var LAUNCHED_STATE = 'launched';
var RETIRED_STATE = 'retired';
var OBSOLETE_STATE = 'obsolete';
const PRICE_COMPONENT_QUERY_BATCH_SIZE = 10;
const PRICE_PLAN_QUERY_PAGE_SIZE = 100;
const CONSTRAINT_PRICE_TYPE = 'constraint';

// Validator to check user permissions for accessing TMForum resources
const catalog = (function() {
    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const offeringsPattern = new RegExp('/productOffering/?$');
    const catalogOfferingsPattern = new RegExp('/catalog/[^/]+/productOffering/?');
    const catalogOfferingPattern = new RegExp('/catalog/[^/]+/productOffering/[^/]+/?');
    const offeringPattern = new RegExp('/productOffering/[^/]+/?$');
    const pricePattern = new RegExp('/productOfferingPrice/?$');
    const productsPattern = new RegExp('/productSpecification/?$');
    const productPattern = new RegExp('/productSpecification/[^/]+/?$');
    const categoryPattern = new RegExp('/category/[^/]+/?$');
    const categoriesPattern = new RegExp('/category/?$');
    const catalogsPattern = new RegExp('/catalog/?$');
    const allowedComplianceLabels = ['BL', 'P', 'PP'];
    const complianceIssuerPrefix = 'did:elsi:';

    const retrieveAsset = function(assetPath, callback) {
        if (!assetPath.startsWith('/')) {
            assetPath = `/${assetPath}`;
        }

        const uri = utils.getAPIURL(
            config.endpoints.catalog.appSsl,
            config.endpoints.catalog.host,
            config.endpoints.catalog.port,
            `${config.endpoints.catalog.apiPath}${assetPath}`
        );

        axios.get(uri).then((response) => {
            callback(null, {
                status: response.status,
                body: response.data
            });

        }).catch((err) => {
            console.log(err)
            let status = 400;
            if (err.response && err.response.status) {
                status = err.response.status;
            }
            callback({
                status: status
            });
        })
    };

    const retrieveAssetAsync = function(assetPath) {
        return new Promise((resolve, reject) => {
            retrieveAsset(assetPath, function(err, result) {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    };

    const getDependencySpecs = function (endpoint, path, refs, fields, callback){

        const specPath = `/${path}?id=${tmfUtils.refsToQuery(refs)}&fields=${fields}`
        const uri = utils.getAPIURL(
            endpoint.appSsl,
            endpoint.host,
            endpoint.port,
            `${endpoint.apiPath}${specPath}`
        );
        axios.get(uri).then((response) => {
            callback(null, {
                status: response.status,
                body: response.data
            });

        }).catch((err) => {
            callback({
                status: err.status
            });
        })
    }

    const retrieveCatalog = function(catalogId, callback) {
        const catalogPath = `/catalog/${catalogId}`

        retrieveAsset(catalogPath, (err, response) => {
            if (err) {
                callback({
                    status: 422,
                    message: 'The attached catalog cannot be read or does not exist'
                });
            } else {
                callback(err, response);
            }
        });
    }

    const getCatalogOfferingPathInfo = function(req) {
        if (!req.apiUrl && !req.path) {
            return null
        }

        const requestPath = req.path || req.apiUrl.split('?')[0]
        const pathParts = requestPath.split('/')

        if (
            pathParts.length >= 5 &&
            pathParts[1] === config.endpoints.catalog.path &&
            pathParts[2] === 'catalog' &&
            pathParts[4] === 'productOffering'
        ) {
            return {
                catalogId: pathParts[3],
                resourcePath: '/' + pathParts.slice(4).join('/')
            }
        }

        return null
    }

    const getCategoryIds = function(catalog) {
        if (!catalog.category) {
            return []
        }

        return catalog.category.map((category) => {
            return category.id
        })
    }

    const getQueryString = function(apiUrl) {
        const queryStart = apiUrl.indexOf('?')

        if (queryStart < 0) {
            return ''
        }

        return apiUrl.substring(queryStart + 1)
    }

    const addCategoryFilter = function(queryString, categoryIds) {
        if (categoryIds.length === 0) {
            return queryString
        }

        const categoryFilter = categoryIds.join(',')

        if (!queryString) {
            return 'category=' + categoryFilter
        }

        const queryParts = queryString.split('&').filter((part) => {
            return part.length > 0
        })
        const remainingParts = []
        let categoryPart = null

        queryParts.forEach((part) => {
            const keyValue = part.split('=')

            if (keyValue[0] === 'category') {
                categoryPart = part
            } else {
                remainingParts.push(part)
            }
        })

        if (categoryPart == null) {
            return queryString + '&category=' + categoryFilter
        }

        const requestedCategories = categoryPart.split('=')[1].split(',')
        const categoryIntersection = requestedCategories.filter((categoryId) => {
            return categoryIds.indexOf(categoryId) >= 0
        })

        return ['category=' + categoryIntersection.join(',')].concat(remainingParts).join('&')
    }

    const rewriteCatalogOfferingQuery = function(req, callback) {
        const pathInfo = getCatalogOfferingPathInfo(req)

        if (pathInfo == null) {
            return callback(null)
        }

        retrieveCatalog(pathInfo.catalogId, (err, response) => {
            if (err) {
                return callback(err)
            }

            const queryString = addCategoryFilter(getQueryString(req.apiUrl), getCategoryIds(response.body))
            req.apiUrl = '/catalog' + pathInfo.resourcePath + (queryString ? '?' + queryString : '')
            callback(null)
        })
    }

    const isCatalogListRequest = function(req) {
        return catalogsPattern.test(req.path) || catalogsPattern.test(req.apiUrl)
    }

    const hasRelatedPartyFilter = function(req) {
        const query = req.query || {}

        for (const key of Object.keys(query)) {
            if (key.indexOf('relatedParty') === 0) {
                return true
            }
        }

        return false
    }

    const isLaunchedCatalogQuery = function(req) {
        const query = req.query || {}
        const lifecycleStatus = query[LIFE_CYCLE]

        return lifecycleStatus != null && String(lifecycleStatus).toLowerCase() === LAUNCHED_STATE
    }

    const hasCatalogOffers = function(catalog) {
        const categoryIds = getCategoryIds(catalog)
        const catalogId = catalog.id || catalog.href || 'unknown'

        if (categoryIds.length === 0) {
            logger.debug('Catalog launched-offer filter rejected catalog ' + catalogId + ': no categories')
            return Promise.resolve(false)
        }

        const offersPath = '/productOffering?category=' + categoryIds.join(',') + '&lifecycleStatus=Launched&limit=1'
        logger.debug('Catalog launched-offer filter checking catalog ' + catalogId + ' with URL ' + offersPath)

        return new Promise((resolve, reject) => {
            retrieveAsset(offersPath, (err, result) => {
                if (err) {
                    logger.warn('Catalog launched-offer filter failed checking catalog ' + catalogId + ': status=' + (err.status || 'unknown'))
                    reject(err)
                } else {
                    const hasOffers = Array.isArray(result.body) && result.body.length > 0
                    logger.debug('Catalog launched-offer filter ' + (hasOffers ? 'accepted' : 'rejected') + ' catalog ' + catalogId + ': launchedOffers=' + (Array.isArray(result.body) ? result.body.length : 'non-list'))
                    resolve(hasOffers)
                }
            })
        })
    }

    // Retrieves the product belonging to a given offering
    const retrieveProduct = function(productId, callback) {

        const productPath = `/productSpecification/${productId}`

        retrieveAsset(productPath, function(err, response) {
            if (err) {
                callback({
                    status: 422,
                    message: 'The attached product cannot be read or does not exist'
                });
            } else {
                callback(err, response);
            }
        });
    };

    const createAsset = function(assetPath, body, callback) {
        const uri = utils.getAPIURL(
            config.endpoints.catalog.appSsl,
            config.endpoints.catalog.host,
            config.endpoints.catalog.port,
            `${config.endpoints.catalog.apiPath}${assetPath}`
        );
        axios.post(uri, body).then((response) => {
            callback(null, {
                status: response.status,
                body: response.data
            });

        }).catch((err) => {
            console.log(err)
            let status = 400;
            if (err.response && err.response.status) {
                status = err.response.status;
            }

            callback({
                status: status
            });
        })
    };

    const updateAsset = function(assetPath, body, callback) {
        const uri = utils.getAPIURL(
            config.endpoints.catalog.appSsl,
            config.endpoints.catalog.host,
            config.endpoints.catalog.port,
            `${config.endpoints.catalog.apiPath}${assetPath}`
        );

        axios.patch(uri, body).then((response) => {
            callback(null, {
                status: response.status,
                body: response.data
            });

        }).catch((err) => {
            let status = 400;
            if (err.response && err.response.status) {
                status = err.response.status;
            }

            callback({
                status: status
            });
        })
    };

    const checkAssetStatus = function(assetBody, validStates) {
        return LIFE_CYCLE in assetBody && validStates.indexOf(assetBody[LIFE_CYCLE].toLowerCase()) >= 0;
    };

    // The request is directly allowed without extra validation required
    var validateAllowed = function(req, callback) {
        callback(null);
    };

    const catalogPathFromOfferingUrl = function(offeringUrl) {
        const result = offeringUrl.split('/')
        return `/catalog/${result[3]}`
    };

    const validateOfferingFields = function(previousBody, newBody) {
        var fixedFields = ['isBundle', 'productSpecification', 'bundledProductOffering'];
        var modified = null;

        for (var i = 0; i < fixedFields.length && modified == null; i++) {
            var field = fixedFields[i];
            if (newBody[field] && !equal(newBody[field], previousBody[field])) {
                modified = field;
            }
        }
        return modified;
    };

    const validateOfferingCatalog = function(
        req,
        offeringPath,
        validStates,
        newBody,
        errorMessageStateCatalog,
        callback
    ) {
        // Retrieve the catalog
        var catalogPath = catalogPathFromOfferingUrl(offeringPath);

        retrieveAsset(catalogPath, function(err, result) {
            if (err) {
                callback({
                    status: 500,
                    message: 'The catalog attached to the offering cannot be read'
                });
            } else {
                const catalog = result.body;

                // Check that tht catalog is in an appropriate state
                if (checkAssetStatus(catalog, validStates)) {
                    callback(null);
                } else {
                    callback({
                        status: 400,
                        message: errorMessageStateCatalog
                    });
                }
            }
        });
    };

    const validateAssetPermissions = function(
        req,
        asset,
        validStates,
        errorMessageStateProduct,
        userNotAllowedMsg,
        callback
    ) {
        // Check that the user is the owner of the asset
        // Offerings don't include a relatedParty field, so for bundles it is needed to retrieve the product
        const ownerHandler = function(req, asset, hdlrCallback) {
            if (!asset.relatedParty) {
                retrieveProduct(asset.productSpecification.id, function(err, result) {
                    var isOwner = false;
                    if (!err) {
                        const product = result.body;
                        isOwner = tmfUtils.isOwner(req, product);
                    }
                 
                    hdlrCallback(isOwner);
                });
            } else {
                hdlrCallback(tmfUtils.isOwner(req, asset));
            }
        };

        ownerHandler(req, asset, function(isOwner) {
            if (isOwner) {
                // States are only checked when the offering is being created
                // or when the offering is being launched

                if (validStates !== null) {
                    // Check that the product is in an appropriate state
                    if (checkAssetStatus(asset, validStates)) {
                        callback(null);
                    } else {
                        callback({
                            status: 400,
                            message: errorMessageStateProduct
                        });
                    }
                } else {
                    // When the offering is not being created or launched, the states must not be checked
                    // and we can call the callback after checking that the user is the owner of the attached
                    // product
                    callback(null);
                }
            } else {
                callback({
                    status: 403,
                    message: userNotAllowedMsg
                });
            }
        });
    };

    const attachCatalogCategory = function(req, offeringPath, offeringBody, callback) {
        var catalogPath = catalogPathFromOfferingUrl(offeringPath);

        retrieveAsset(catalogPath, function(err, result) {
            if (err) {
                callback({
                    status: 500,
                    message: 'The catalog attached to the offering cannot be read'
                });
            } else {
                const catalog = result.body;
                if (catalog.category && catalog.category.length > 0) {
                    if (offeringBody.category) {
                        offeringBody.category.push(catalog.category[0])
                    } else {
                        offeringBody.category = [catalog.category[0]];
                    }
                    utils.updateBody(req, offeringBody);
                }
                callback(null);
            }
        })
    }

    const hasProductImage = function(productSpec) {
        if (!productSpec || !Array.isArray(productSpec.attachment)) {
            return false;
        }

        return productSpec.attachment.some((attachment) => {
            if (!attachment ||
                typeof attachment.name !== 'string' ||
                typeof attachment.attachmentType !== 'string' ||
                typeof attachment.url !== 'string') {
                return false;
            }

            return attachment.name.trim().toLowerCase() === 'profile picture' &&
                attachment.attachmentType.trim().length > 0 &&
                attachment.url.trim().length > 0;
        });
    };

    const getSellerOrganizationId = function(offering) {
        const relatedParties = offering && Array.isArray(offering.relatedParty)
            ? offering.relatedParty
            : [];
        const sellerRole = String(config.roles.seller || 'seller').toLowerCase();
        const organizationSeller = relatedParties.find((party) => {
            if (!party || !party.id || typeof party.role !== 'string' || party.role.toLowerCase() !== sellerRole) {
                return false;
            }

            const referredType = typeof party['@referredType'] === 'string'
                ? party['@referredType'].toLowerCase()
                : '';
            return referredType === 'organization' || String(party.id).toLowerCase().includes('organization');
        });

        return organizationSeller ? organizationSeller.id : null;
    };

    const getComplianceCredentialToken = function(productSpec) {
        if (!productSpec || !Array.isArray(productSpec.productSpecCharacteristic)) {
            return null;
        }

        const complianceCharacteristics = productSpec.productSpecCharacteristic.filter((characteristic) => {
            return characteristic &&
                typeof characteristic.name === 'string' &&
                characteristic.name.trim().toLowerCase() === 'compliance:vc';
        });
        if (complianceCharacteristics.length !== 1) {
            return null;
        }

        const characteristicValues = complianceCharacteristics[0].productSpecCharacteristicValue;
        if (!Array.isArray(characteristicValues) || characteristicValues.length !== 1) {
            return null;
        }

        const complianceToken = characteristicValues[0] && characteristicValues[0].value;
        return typeof complianceToken === 'string' && complianceToken.trim().length > 0
            ? complianceToken.trim()
            : null;
    };

    const getComplianceCertificate = function(decoded) {
        const certificateChain = decoded && decoded.header && decoded.header.x5c;
        if (!Array.isArray(certificateChain) || typeof certificateChain[0] !== 'string') {
            return null;
        }

        const certificate = certificateChain[0].replace(/\s/g, '');
        if (!certificate) {
            return null;
        }

        return '-----BEGIN CERTIFICATE-----\n' +
            certificate.match(/.{1,64}/g).join('\n') +
            '\n-----END CERTIFICATE-----';
    };

    const getCertificateOrganizationIdentifier = function(certificate) {
        const legacyCertificate = certificate.toLegacyObject();
        const subject = legacyCertificate && legacyCertificate.subject;
        if (!subject || typeof subject !== 'object') {
            return null;
        }

        const organizationIdentifier = subject.organizationIdentifier ||
            subject['2.5.4.97'] ||
            subject['OID.2.5.4.97'];
        const values = Array.isArray(organizationIdentifier)
            ? organizationIdentifier
            : [organizationIdentifier];
        if (values.length !== 1 || typeof values[0] !== 'string') {
            return null;
        }

        const normalizedIdentifier = values[0].trim();
        return normalizedIdentifier || null;
    };

    const hasMatchingComplianceIssuer = function(payload, certificate) {
        if (!payload || typeof payload.iss !== 'string') {
            return false;
        }

        const parsedCertificate = new X509Certificate(certificate);
        const organizationIdentifier = getCertificateOrganizationIdentifier(parsedCertificate);
        return organizationIdentifier !== null &&
            payload.iss === complianceIssuerPrefix + organizationIdentifier;
    };

    const hasValidComplianceCredential = async function(productSpec) {
        const complianceToken = getComplianceCredentialToken(productSpec);
        if (!complianceToken || !productSpec.id) {
            return false;
        }

        try {
            const decoded = jwt.decode(complianceToken, { complete: true });
            const certificate = getComplianceCertificate(decoded);
            if (!certificate) {
                return false;
            }

            const payload = jwt.verify(complianceToken, certificate, {
                algorithms: ['RS256']
            });
            if (!hasMatchingComplianceIssuer(payload, certificate)) {
                return false;
            }

            const credential = payload && (payload.verifiableCredential || payload.vc);
            if (!credential || !credential.credentialSubject) {
                return false;
            }

            const credentialTypes = Array.isArray(credential.type)
                ? credential.type
                : [credential.type];
            if (!credentialTypes.includes('gx:LabelCredential')) {
                return false;
            }

            const credentialSubject = credential.credentialSubject;
            if (credentialSubject.id !== productSpec.id) {
                return false;
            }

            const labelLevel = credentialSubject['gx:labelLevel'];
            return typeof labelLevel === 'string' &&
                allowedComplianceLabels.includes(labelLevel.trim().toUpperCase());
        } catch (err) {
            return false;
        }
    };

    const canOfferingBeLaunched = async function(offering, productSpec = null) {
        try {
            if (!offering || offering.isBundle) {
                return false;
            }

            const productSpecId = offering && offering.productSpecification && offering.productSpecification.id;
            let resolvedProductSpec = productSpec;
            if (!resolvedProductSpec) {
                if (!productSpecId) {
                    return false;
                }

                resolvedProductSpec = await new Promise((resolve, reject) => {
                    retrieveProduct(productSpecId, function(err, result) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result.body);
                        }
                    });
                });
            }
            if (!hasProductImage(resolvedProductSpec)) {
                return false;
            }

            const organizationId = getSellerOrganizationId(offering);
            if (!organizationId) {
                return false;
            }

            const organizationResult = await partyClient.getOrganization(organizationId);
            const organization = organizationResult && organizationResult.body;
            if (!tmfUtils.hasOrganizationCountry(organization)) {
                return false;
            }

            const organizationStatus = organization.status == null
                ? ''
                : String(organization.status).trim().toLowerCase();
            if (organizationStatus === 'initialized') {
                return false;
            }

            return await hasValidComplianceCredential(resolvedProductSpec);
        } catch (err) {
            logger.warn('The offering launch requirements could not be evaluated');
            return false;
        }
    };

    const validateOffering = async function(req, offeringPath, previousBody, newBody, callback) {
        if(newBody && newBody.name !== null && newBody.name !== undefined){ // newBody.name === '' should enter here
            const errorMessage = tmfUtils.validateNameField(newBody.name, 'Product offering');
            if (errorMessage) {
                return callback({
                    status: 422,
                    message: errorMessage
                });
            }
        }else if(newBody && !previousBody){ // newBody.name is null or undefined and it is a POST request
            return callback({
                status: 422,
                message: 'Product offering name is mandatory'
            });
        }
        // Check that the offering description
        if (newBody && newBody.description) {
            const errorMessage = tmfUtils.validateDescriptionField(newBody.description, 'Product offering');
            if (errorMessage) {
                return callback({
                    status: 422,
                    message: errorMessage
                });
            }
        }

        let validStates = null;
        let errorMessageStateProduct = null;
        let errorMessageStateCatalog = null;
        if (previousBody === null) {
            // Offering creation
            validStates = [ACTIVE_STATE, LAUNCHED_STATE];
            errorMessageStateProduct = 'Offerings can only be attached to active or launched products';
            errorMessageStateCatalog = 'Offerings can only be created in a catalog that is active or launched';

            if (config.launchValidationEnabled && newBody && newBody[LIFE_CYCLE] && newBody[LIFE_CYCLE].toLowerCase() === LAUNCHED_STATE && !(await canOfferingBeLaunched(newBody))) {
                return callback({
                    status: 403,
                    message: 'The product offering does not meet the requirements to be launched'
                });
            }
        } else if (
            previousBody !== null &&
            newBody &&
            LIFE_CYCLE in newBody &&
            newBody[LIFE_CYCLE].toLowerCase() === LAUNCHED_STATE
        ) {
            // Launching an existing offering
            validStates = [LAUNCHED_STATE];
            errorMessageStateProduct = 'Offerings can only be launched when the attached product is also launched';
            errorMessageStateCatalog = 'Offerings can only be launched when the attached catalog is also launched';

            if (config.launchValidationEnabled && !(await canOfferingBeLaunched(previousBody))) {
                return callback({
                    status: 403,
                    message: 'The product offering does not meet the requirements to be launched'
                });
            }
        }

        if (newBody && previousBody) {
            const modifiedField = validateOfferingFields(previousBody, newBody);

            if (modifiedField !== null) {
                return callback({
                    status: 403,
                    message: 'Field ' + modifiedField + ' cannot be modified'
                });
            }
            newBody["@schemaLocation"] = config.offeringSchema
        }

        if(newBody && newBody['category']){
            const dict = {}
            newBody['category'] = newBody['category'].filter((category) => {
                if(dict[category.id]) return false
                else{
                    dict[category.id] = 1
                    return true
                }
            })
        }
        if (newBody){
            utils.updateBody(req, newBody)
        }

        async.series(
            [],
                function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        // Check if the offering is a bundle.
                        var offeringBody = previousBody || newBody;

                    var lifecycleHandler = function(err) {
                        if (err) {
                            callback(err);
                        } else if (validStates != null && catalogOfferingsPattern.test(req.apiUrl)) {
                            // This validation only need to be executed once
                            validateOfferingCatalog(
                                req,
                                offeringPath,
                                validStates,
                                newBody,
                                errorMessageStateCatalog,
                                callback
                            );
                        } else {
                            callback(null);
                        }
                    };

                    if (offeringBody.isBundle) {
                        // Bundle offerings cannot contain a productSpecification
                        if (offeringBody.productSpecification) {
                            return callback({
                                status: 422,
                                message: 'Product offering bundles cannot contain a product specification'
                            });
                        }

                        // Validate that at least two offerings have been included
                        if (!offeringBody.bundledProductOffering || offeringBody.bundledProductOffering.length < 2) {
                            return callback({
                                status: 422,
                                message: 'Product offering bundles must contain at least two bundled offerings'
                            });
                        }

                        // Validate that the bundled offerings exists
                        async.each(
                            offeringBody.bundledProductOffering,
                            function(offering, taskCallback) {
                                try{
                                    if (!offering.href) {
                                        return taskCallback({
                                            status: 422,
                                            message: 'Missing required field href in bundled offering'
                                        });
                                    }

                                    const offeringPath = `/productOffering/${offering.id}`
                                    retrieveAsset(offeringPath, function(err, result) {
                                        if (err) {
                                            var id = offering.id ? offering.id : '';
                                            return taskCallback({
                                                status: 422,
                                                message:
                                                    'The bundled offering ' + id + ' cannot be accessed or does not exists'
                                            });
                                        }

                                        // Check that the included offering is not also a bundle
                                        var bundledOffering = result.body;
                                        if (bundledOffering.isBundle) {
                                            return taskCallback({
                                                status: 422,
                                                message: 'Product offering bundles cannot include another bundle'
                                            });
                                        }

                                        var userNotAllowedMsg = 'You are not allowed to bundle offerings you do not own';
                                        validateAssetPermissions(
                                            req,
                                            bundledOffering,
                                            validStates,
                                            errorMessageStateProduct,
                                            userNotAllowedMsg,
                                            taskCallback
                                        );
                                    });

                                } catch(err){
                                    return taskCallback({
                                        status: 500,
                                        message: 'An unexpected error occurred, contact the support team.'
                                    })
                                }
                            },
                            lifecycleHandler
                        );
                    } else {
                        // Non bundles cannot contain a bundleProductOffering
                        if (offeringBody.bundledProductOffering && offeringBody.bundledProductOffering.length > 0) {
                            return callback({
                                status: 422,
                                message:
                                    'Product offerings which are not a bundle cannot contain a bundled product offering'
                            });
                        }

                        // Check that a productSpecification has been included
                        if (
                            !offeringBody.productSpecification ||
                            utils.emptyObject(offeringBody.productSpecification)
                        ) {
                            return callback({
                                status: 422,
                                message: 'Product offerings must contain a productSpecification'
                            });
                        }

                        /*if (!offeringBody.productSpecification.href) {
                            return callback({
                                status: 422,
                                message: 'Missing required field href in product specification'
                            });
                        }*/

                        // Check that the product attached to the offering is owned by the same user
                        retrieveProduct(offeringBody.productSpecification.id, function(err, result) {
                            if (err) {
                                callback(err);
                            } else {
                                var operation = previousBody != null ? 'update' : 'create';
                                var userNotAllowedMsg =
                                    'You are not allowed to ' + operation + ' offerings for products you do not own';
                                var product = result.body;

                                validateAssetPermissions(
                                    req,
                                    product,
                                    validStates,
                                    errorMessageStateProduct,
                                    userNotAllowedMsg,
                                    lifecycleHandler
                                );
                            }
                        });
                    }
                }
            }
        );
    };

    const checkExistingCategoryById = function(categoryId, callback) {
        const categoryPath = '/category';
        retrieveAsset(`${categoryPath}/${categoryId}`, function(err, result) {
            if (err) {
                if (err.status == 404) {
                    callback({
                        status: 400,
                        message: 'Invalid category with id: ' + categoryId
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'It was impossible to check if the category with id: ' + categoryId + ' already exists'
                    });
                }
            } else {
                callback(null);
            }
        });
    };

    const checkExistingCategory = function(categoryName, isRoot, parentId, callback) {
        const categoryPath = '/category';
        let queryParams = '?lifecycleStatus=Launched&name=' + categoryName;

        if (isRoot) {
            queryParams += '&isRoot=true';
        } else {
            queryParams += '&parentId=' + parentId;
        }

        retrieveAsset(categoryPath + queryParams, function(err, result) {
            if (err) {
                callback({
                    status: 500,
                    message: 'It was impossible to check if the provided category already exists'
                });
            } else {
                const existingCategories = result.body;

                if (!existingCategories.length) {
                    callback(null);
                } else {
                    callback({
                        status: 409,
                        message: 'This category already exists'
                    });
                }
            }
        });
    };

    const validateCategory = function(req, updatedCategory, oldCategory, action, callback) {
        // Categories can only be created by administrators
        if (!utils.hasRole(req.user, config.roles.admin)) {
            callback({
                status: 403,
                message: 'Only administrators can ' + action + ' categories'
            });
        } else {
            if (updatedCategory && ['POST', 'PATCH', 'PUT'].indexOf(req.method.toUpperCase()) >= 0) {
                // Categories are created as root when isRoot is not included
                const isRoot =
                    'isRoot' in updatedCategory ? updatedCategory.isRoot : oldCategory ? oldCategory.isRoot : true;
                const parentId =
                    'parentId' in updatedCategory
                        ? updatedCategory.parentId
                        : oldCategory
                            ? oldCategory.parentId
                            : null;

                if (isRoot && parentId) {
                    callback({
                        status: 400,
                        message: 'Parent ID cannot be included when the category is root'
                    });
                } else if (!isRoot && !parentId) {
                    callback({
                        status: 400,
                        message: 'Non-root categories must contain a parent category'
                    });
                } else {
                    const categoryName =
                        'name' in updatedCategory ? updatedCategory.name : oldCategory ? oldCategory.name : null;

                    if (!categoryName) {
                        callback({
                            status: 400,
                            message: 'Category name is mandatory'
                        });
                    } else {
                        const fieldUpdated = (oldCategory, updatedCategory, field) => {
                            return (
                                oldCategory && updatedCategory[field] && updatedCategory[field] != oldCategory[field]
                            );
                        };

                        const newCategory = updatedCategory && !oldCategory;
                        const nameUpdated = fieldUpdated(oldCategory, updatedCategory, 'name');
                        const isRootUpdated = fieldUpdated(oldCategory, updatedCategory, 'isRoot');
                        const parentIdUpdated = fieldUpdated(oldCategory, updatedCategory, 'parentId');

                        // We should check for other categories with the same properties (name, isRoot, parentId) when:
                        //   1.- The category is new (updatedCategory is not null && oldCategory is null)
                        //   2.- The name of the category is updated
                        //   3.- The parent ID of the category is updated
                        //   4.- The root status of the category is changed
                        if (newCategory || nameUpdated || isRootUpdated || parentIdUpdated) {
                            async.series(
                                [
                                    function(callback) {
                                        if (!isRoot) {
                                            // Check parent category
                                            checkExistingCategoryById(parentId, callback);
                                        } else {
                                            callback(null);
                                        }
                                    },
                                    function(callback) {
                                        checkExistingCategory(categoryName, isRoot, parentId, callback);
                                    }
                                ],
                                callback
                            );
                        } else {
                            callback(null);
                        }
                    }
                }
            } else {
                callback(null);
            }
        }
    };

    const checkDependencySpecs = function(prevBody, newBody, callback){
        if (!!prevBody.lifecycleStatus && prevBody.lifecycleStatus.toLowerCase() !== 'launched' &&
            !!newBody.lifecycleStatus && newBody.lifecycleStatus.toLowerCase() === 'launched'
        ){
            async.series([
                function(callback){
                    servSpecCheck = (newBody.serviceSpecification)? newBody.serviceSpecification : prevBody.serviceSpecification
                    if (!!servSpecCheck && servSpecCheck.length > 0){
                        getDependencySpecs(config.endpoints.service , 'serviceSpecification', servSpecCheck, 'lifecycleStatus',
                            function (err, response){
                                if (err){
                                    return callback({
                                        status: 400,
                                        message: 'Error getting service specification through the API'
                                    })
                                }
                                else {
                                    const serviceSpecification = response.body
                                    if(!tmfUtils.haveSameStatus('launched', serviceSpecification)){
                                        return callback({
                                            status: 409,
                                            message: 'It is not allowed to launch a product spec without launching service spec previously'
                                        })
                                    }
                                    callback(null)
                                }
                            }
                        )
                    }
                    else {
                        callback(null)
                    }
                },
                function(callback){
                    resSpecCheck = (newBody.resourceSpecification)? newBody.resourceSpecification : prevBody.resourceSpecification
                    if(!!resSpecCheck && resSpecCheck.length >0){
                        getDependencySpecs(config.endpoints.resource, 'resourceSpecification', resSpecCheck, 'lifecycleStatus',
                            function (err, response){
                                if (err){
                                    return callback({
                                        status: 400,
                                        message: 'Error getting resource specification through the API'
                                    })
                                }
                                else {
                                    const resourceSpecification = response.body
                                    if(!tmfUtils.haveSameStatus('launched', resourceSpecification)){
                                        return callback({
                                            status: 409,
                                            message: 'It is not allowed to launch a product spec without launching resource spec previously'
                                        })
                                    }
                                    callback(null)
                                }
                            }
                        )
                    }
                    else {
                        callback(null)
                    }
                }
            ], callback)
        }
        else{
            callback(null)
        }
    }

    const validateProductUpdate = function(req, prevBody, newBody, callback) {
        if (
            (!!newBody.isBundle || !!newBody.bundledProductSpecification) &&
            prevBody.lifecycleStatus.toLowerCase() != 'active'
        ) {
            return callback({
                status: 422,
                message:
                    'It is not allowed to update bundle related attributes (isBundle, bundledProductSpecification) in launched products'
            });
        }
        async.series([
            function(callback){
                checkDependencySpecs(prevBody, newBody, callback)
            },
            function(callback){
                // Check upgrade problems if the product is a digital one
                if (tmfUtils.isDigitalProduct(prevBody.productSpecCharacteristic)) {
                    if (
                        !!newBody.version &&
                        !tmfUtils.isDigitalProduct(newBody.productSpecCharacteristic) &&
                        newBody.version != prevBody.version
                    ) {
                        // Trying to upgrade the product without providing new asset info
                        return callback({
                            status: 422,
                            message: 'To upgrade product specifications it is required to provide new asset info'
                        });
                    }

                    if (
                        (!!newBody.version && newBody.version == prevBody.version) ||
                        (typeof newBody.version === 'undefined' &&
                            !!newBody.productSpecCharacteristic &&
                            !equal(newBody.productSpecCharacteristic, prevBody.productSpecCharacteristic))
                    ) {
                        return callback({
                            status: 422,
                            message: 'Product specification characteristics only can be updated for upgrading digital products'
                        });
                    }

                    if (
                        !!newBody.version &&
                        newBody.version != prevBody.version &&
                        tmfUtils.isDigitalProduct(newBody.productSpecCharacteristic) &&
                        !tmfUtils.equalCustomCharacteristics(
                            newBody.productSpecCharacteristic,
                            prevBody.productSpecCharacteristic
                        )
                    ) {
                        return callback({
                            status: 422,
                            message: 'It is not allowed to update custom characteristics during a product upgrade'
                        });
                    }

                    if (!!newBody.version && newBody.version != prevBody.version && !!newBody.productSpecCharacteristic) {
                        return storeClient.upgradeProduct(
                            {
                                id: prevBody.id,
                                version: newBody.version,
                                productSpecCharacteristic: newBody.productSpecCharacteristic
                            },
                            req.user,
                            callback
                        );
                    }
                } /*else if (
                    !!newBody.productSpecCharacteristic &&
                    !equal(newBody.productSpecCharacteristic, prevBody.productSpecCharacteristic)
                ) {
                    return callback({
                        status: 422,
                        message: 'Product spec characteristics cannot be updated'
                    });
                }*/

                return callback(null);
            },
        ], callback)
    };

    const validateProduct = function(req, productSpec, callback) {

        if(productSpec && productSpec.name!==null && productSpec.name!==undefined){ // productSpec.name === '' should enter here
            const errorMessage = tmfUtils.validateNameField(productSpec.name, 'Product spec');
            if (errorMessage) {
                return callback({
                    status: 422,
                    message: errorMessage
                });
            }
        } else if(productSpec && req.method === 'POST'){ // productSpec.name is null or undefined and it is a POST request
            return callback({
                status: 422,
                message: 'Product spec name is mandatory'
            });
        }
        if (productSpec && productSpec.description) {
            const errorMessage = tmfUtils.validateDescriptionField(productSpec.description, 'Product spec');
            if (errorMessage) {
                return callback({
                    status: 422,
                    message: errorMessage
                });
            }
        }

        if (productSpec && productSpec.productSpecCharacteristic && !tmfUtils.validateCharacteristics(productSpec.productSpecCharacteristic)){
            return callback({
                    status: 422,
                    message: "Invalid product spec characteristics"
                });
        }

        // Check if the product is a bundle
        if (!productSpec.isBundle) {
            return callback(null);
        }

        // Check that al least two products have been included
        if (!productSpec.bundledProductSpecification || productSpec.bundledProductSpecification.length < 2) {
            return callback({
                status: 422,
                message: 'Product spec bundles must contain at least two bundled product specs'
            });
        }

        async.each(
            productSpec.bundledProductSpecification,
            function(spec, taskCallback) {
                try{
                    // Validate that the bundled products exists
                    if (!spec.href) {
                        return taskCallback({
                            status: 422,
                            message: 'Missing required field href in bundleProductSpecification'
                        });
                    }
    
                    retrieveProduct(spec.id, function(err, result) {
                        if (err) {
                            taskCallback(err);
                        } else {
                            const product = result.body;
    
                            // Validate that the bundle products belong to the same owner
                            if (!tmfUtils.isOwner(req, product)) {
                                return taskCallback({
                                    status: 403,
                                    message:
                                        'You are not authorized to include the product spec ' +
                                        product.id +
                                        ' in a product spec bundle'
                                });
                            }

                            // Validate that the bundle products are not also bundles
                            if (product.isBundle) {
                                return taskCallback({
                                    status: 422,
                                    message:
                                        'It is not possible to include a product spec bundle in another product spec bundle'
                                });
                            }

                            // Validate that the bundled products are in a valid life cycle state (Active or launched)
                            if (product.lifecycleStatus && [ACTIVE_STATE, LAUNCHED_STATE].indexOf(product.lifecycleStatus.toLowerCase()) < 0) {
                                return taskCallback({
                                    status: 422,
                                    message: 'Only Active or Launched product specs can be included in a bundle'
                                });
                            }

                            taskCallback(null);
                        }
                    });

                }
                catch(err){
                    return taskCallback({
                        status: 500,
                        message: 'An unexpected error occurred, contact the support team.'
                    })
                }
            },
            function(err) {
                callback(err);
            }
        );
    };

    const checkExistingCatalog = function(catalogName, callback) {
        const catalogPath = '/catalog';
        const queryParams = '?name=' + encodeURIComponent(catalogName);
        const invalidChars = /[<>%"\|]/;
        if(invalidChars.test(catalogName)){
            return callback({
                status: 400,
                message: 'Invalid format, these characters have been temporarily disabled'
            })
        }
        retrieveAsset(catalogPath + queryParams, function(err, result) {
            if (err) {
                    callback({
                        status: 500,
                        message: 'It was impossible to check if there is another catalog with the same name'
                    });
            } else {
                const existingCatalog = result.body;

                if (!existingCatalog.length) {
                    callback();
                } else {
                    callback({
                        status: 409,
                        message: 'This catalog name is already taken'
                    });
                }
            }
        });
    };

    const createCatalogCategories = function(req, catalogBody, callback) {
        logger.info('Attaching a category to the new catalog');
        createAsset('/category', {isRoot: true, name: catalogBody.name, lifecycleStatus: 'Launched'}, function(err, result) {
            if (err){
                console.log(err)
                logger.error('Error creating the associated category');
                callback({
                    status: 500,
                    message: 'Error creating the associated category'
                })
            } else {
                logger.info('Updating the created catalog');
                const category = result.body
                catalogBody.category = [{
                    id: category.id,
                    href: category.href,
                    name: category.name
                }]
                utils.updateBody(req, catalogBody);
                callback(null)
            }
        })
    }

    const validateCatalog = function(req, prevCatalog, catalog, callback) {
        if(catalog && catalog.name !== null && catalog.name !== undefined){ // catalog.name === '' should enter here
            const errorMessage = tmfUtils.validateNameField(catalog.name, 'Catalog');
            if (errorMessage) {
                logger.error('Invalid catalog name');
                return callback({
                    status: 422,
                    message: errorMessage
                });
            }
        }
        else if(catalog && !prevCatalog){
            return callback({
                status: 422,
                message: 'Catalog name is mandatory'
            });
        }
        // Check that the catalog description
        if (catalog && catalog.description) {
            const errorMessage = tmfUtils.validateDescriptionField(catalog.description, 'Catalog');
            if (errorMessage) {
                return callback({
                    status: 422,
                    message: errorMessage
                });
            }
        }
        // Check that the catalog name is not already taken
        if (catalog && (!prevCatalog || catalog.name)) {
            checkExistingCatalog(catalog.name, callback);
        } else {
            callback(null);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////// CREATION //////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const createHandler = function(req, resp, callback) {
        if (tmfUtils.isOwner(req, resp)) {
            callback(null);
        } else {
            callback({
                status: 403,
                message: 'The user making the request and the specified owner are not the same user'
            });
        }
    };

    // Validate the creation of a resource
    const validateCreation = function(req, callback) {
        let body;
        // The request body may not be well formed
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });

            return; // EXIT
        }

        // Catalog stuff should include a validFor field
        if (!body.validFor) {
            body.validFor = {
                startDateTime: new Date().toISOString()
            };
            utils.updateBody(req, body);
        }

        if (categoriesPattern.test(req.apiUrl)) {
            validateCategory(req, body, null, 'create', callback);
        } else {
            // Check that the user has the seller role or is an admin
            if (!utils.hasRole(req.user, config.roles.seller)) {
                callback({
                    status: 403,
                    message: 'You are not authorized to create resources'
                });

                return; // EXIT
            }

            if (offeringsPattern.test(req.apiUrl)) {
                logger.info('Validating offering creation');
                validateOffering(req, req.apiUrl, null, body, function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        const storeCall = () => {
                            storeClient.validateOffering(body, req.user, function(err) {
                                if (err) {
                                    callback(err);
                                } else {
                                    // The current implementation of the APIs does not support the
                                    // catalog ID in offering URL
                                    req.apiUrl = '/catalog/productOffering'
                                    callback(null);
                                }
                            });
                        }

                        if (catalogOfferingsPattern.test(req.apiUrl)) {
                            logger.info('Validating offering creation using a catalog ID URL');
                            attachCatalogCategory(req, req.apiUrl, body, (err) => {
                                if (err) {
                                    return callback(err);
                                }
                                storeCall();
                            })
                        } else {
                            storeCall();
                        }
                    }
                });
            } else if (productsPattern.test(req.apiUrl)) {
                createHandler(req, body, function(err) {
                    if (err) {
                        return callback(err);
                    }

                    validateProduct(req, body, function(err) {
                        if (err) {
                            callback(err);
                        } else {
                            // Check that the product specification contains a valid product
                            // according to the charging backend
                            storeClient.validateProduct(body, req.user, callback);
                        }
                    });
                });
            } else if (catalogsPattern.test(req.apiUrl)) {
                validateCatalog(req, null, body, function(result) {
                    if (result) {
                        callback(result);
                    } else {
                        createHandler(req, body, (err) => {
                            if (err) {
                                return callback(err);
                            }
                            createCatalogCategories(req, body, callback)
                        });
                    }
                });
            }
            else if(pricePattern.test(req.apiUrl)){
                validateOfferingPrice(req, null, callback);
            }
            else {
                callback(null);
                //createHandler(req, body, callback);
            }
        }
    };

    const getEffectiveField = function(body, previousBody, field) {
        return body[field] !== undefined ? body[field] : previousBody && previousBody[field];
    }

    const getUniqueConstraintRef = function(pricePlan, previousBody) {
        const relationships = getEffectiveField(pricePlan, previousBody, 'popRelationship');
        const constraintRefs = (Array.isArray(relationships) ? relationships : []).filter((relationship) =>
            relationship && String(relationship.relationshipType || '').toLowerCase() === CONSTRAINT_PRICE_TYPE
        );

        if (constraintRefs.length > 1) {
            return {
                error: {
                    status: 422,
                    message: 'The price plan can only reference one constraint price'
                }
            };
        }

        if (constraintRefs.length === 1 && !constraintRefs[0].id) {
            return {
                error: {
                    status: 422,
                    message: 'The price plan contains a constraint reference without an id'
                }
            };
        }

        return { result: constraintRefs[0] || null };
    }

    const retrievePricesTMF = async function(ids, errorMessage) {
        const pricesMap = new Map();
        const uniqueIds = Array.from(new Set(ids));

        for (let i = 0; i < uniqueIds.length; i += PRICE_COMPONENT_QUERY_BATCH_SIZE) {
            const batch = uniqueIds.slice(i, i + PRICE_COMPONENT_QUERY_BATCH_SIZE);
            let response;
            try {
                response = await retrieveAssetAsync(
                    `/productOfferingPrice?id=${batch.join(',')}&limit=${batch.length}`
                );
            } catch (err) {
                return {
                    error: {
                        status: 422,
                        message: errorMessage
                    }
                };
            }

            const prices = Array.isArray(response.body) ? response.body : [];
            for (const price of prices) {
                pricesMap.set(price.id, price);
            }
        }

        return { result: pricesMap };
    }

    const getCharValueUseNames = function(price) {
        const characteristicNames = new Set();
        const characteristics = Array.isArray(price && price.prodSpecCharValueUse)
            ? price.prodSpecCharValueUse
            : [];

        for (const characteristic of characteristics) {
            if (characteristic && characteristic.name) {
                characteristicNames.add(characteristic.name);
            }
        }

        return characteristicNames;
    }

    const getPPConstraintNames = async function(pricePlan, previousBody) {
        const constraintRef = getUniqueConstraintRef(pricePlan, previousBody);
        if (constraintRef.error) {
            return constraintRef;
        }
        if (!constraintRef.result) {
            return { constraintCharNames: new Set() };
        }

        const constraintPriceId = constraintRef.result.id;

        const constraintMap = await retrievePricesTMF(
            [constraintPriceId],
            'The constraint referenced by the price plan cannot be retrieved'
        );
        if (constraintMap.error) {
            return constraintMap;
        }

        const constraintPrice = constraintMap.result.get(constraintPriceId);
        if (!constraintPrice) {
            return {
                error: {
                    status: 422,
                    message: `The constraint ${constraintPriceId} referenced by the price plan cannot be accessed or does not exist`
                }
            };
        }

        if (constraintPrice.isBundle !== false ||
            String(constraintPrice.priceType || '').toLowerCase() !== CONSTRAINT_PRICE_TYPE) {
            return {
                error: {
                    status: 422,
                    message: 'The constraint relationship must reference a non-bundled ProductOfferingPrice with priceType constraint'
                }
            };
        }

        return { constraintCharNames: getCharValueUseNames(constraintPrice) };
    }

    const validatePricePlanComponents = async function(priceComponentRefs, forbiddenCharacteristicNames) {
        if (!Array.isArray(priceComponentRefs) || priceComponentRefs.length === 0) {
            return null;
        }

        const priceComponentIds = [];
        for (const priceComponentRef of priceComponentRefs) {
            if (!priceComponentRef || !priceComponentRef.id) {
                return {
                    status: 422,
                    message: 'The price plan contains a price component reference without an id'
                };
            }
            priceComponentIds.push(priceComponentRef.id);
        }

        const priceComponentMap = await retrievePricesTMF(
            priceComponentIds,
            'The price components referenced by the price plan cannot be retrieved'
        );
        if (priceComponentMap.error) {
            return priceComponentMap.error;
        }

        for (const priceComponentRef of priceComponentRefs) {
            const priceComponent = priceComponentMap.result.get(priceComponentRef.id);
            if (!priceComponent) {
                return {
                    status: 422,
                    message: `The price component ${priceComponentRef.id} referenced by the price plan cannot be accessed or does not exist`
                };
            }

            if (priceComponent.isBundle !== false) {
                return {
                    status: 422,
                    message: 'The price plan can only contain price components with isBundle set to false'
                };
            }

            if (String(priceComponent.priceType || '').toLowerCase() === CONSTRAINT_PRICE_TYPE) {
                return {
                    status: 422,
                    message: 'A constraint price cannot be included as a price component of a price plan'
                };
            }

            for (const characteristicName of getCharValueUseNames(priceComponent)) {
                if (forbiddenCharacteristicNames.has(characteristicName)) {
                    return {
                        status: 422,
                        message: 'The price plan contains a price component that uses a forbidden characteristic'
                    };
                }
            }
        }

        return null;
    }

    const validatePricePlan = async function(offerPrice, previousBody) {
        if (!previousBody || offerPrice.bundledPopRelationship !== undefined || offerPrice.popRelationship !== undefined) {
            const constraintResult = await getPPConstraintNames(offerPrice, previousBody);
            if (constraintResult.error) {
                return constraintResult.error;
            }

            const priceComponentRefs = getEffectiveField(offerPrice, previousBody, 'bundledPopRelationship');
            const validationError = await validatePricePlanComponents(priceComponentRefs, constraintResult.constraintCharNames);
            if (validationError) {
                return validationError;
            }
        }

        return null;
    }

    const validatePriceComponent = async function(offerPrice, previousBody) {
        if (!previousBody || offerPrice.prodSpecCharValueUse === undefined) {
            return null;
        }

        const compnCharValueUseNames = getCharValueUseNames(offerPrice);
        if (compnCharValueUseNames.size === 0) {
            return null;
        }

        let offset = 0;
        let pricePlans;
        do {
            let result;
            try {
                result = await retrieveAssetAsync(
                    `/productOfferingPrice?bundledPopRelationship.id=${encodeURIComponent(previousBody.id)}` +
                    `&limit=${PRICE_PLAN_QUERY_PAGE_SIZE}&offset=${offset}`
                );
            } catch (err) {
                return {
                    status: 422,
                    message: 'The price plans referencing the price component cannot be retrieved'
                };
            }

            pricePlans = Array.isArray(result.body) ? result.body : [];
            const constraintPriceRefs = [];
            const constraintPriceIds = [];
            for (const pricePlan of pricePlans) {
                const constraintRef = getUniqueConstraintRef(pricePlan);
                if (constraintRef.error) {
                    return constraintRef.error;
                }
                if (constraintRef.result) {
                    constraintPriceRefs.push(constraintRef.result);
                    constraintPriceIds.push(constraintRef.result.id);
                }
            }

            const constraintMap = await retrievePricesTMF(
                constraintPriceIds,
                'The constraints referenced by the price plans cannot be retrieved'
            );
            if (constraintMap.error) {
                return constraintMap.error;
            }

            for (const constraintPriceRef of constraintPriceRefs) {
                const constraintPrice = constraintMap.result.get(constraintPriceRef.id);
                if (!constraintPrice || constraintPrice.isBundle !== false || String(constraintPrice.priceType || '').toLowerCase() !== CONSTRAINT_PRICE_TYPE) {
                    return {
                        status: 422,
                        message: 'A price plan references an invalid constraint price'
                    };
                }

                for (const forbiddenCharValueUseName of getCharValueUseNames(constraintPrice)) {
                    if (compnCharValueUseNames.has(forbiddenCharValueUseName)) {
                        return {
                            status: 422,
                            message: 'The price component uses a characteristic forbidden by one of its price plans'
                        };
                    }
                }
            }

            offset += pricePlans.length;
        } while (pricePlans.length === PRICE_PLAN_QUERY_PAGE_SIZE);

        return null;
    }

    const validateConstraintPrice = async function(offerPrice, previousBody) {
        if (!previousBody) {
            return null;
        }

        const forbiddenCharacteristicNames = getCharValueUseNames(offerPrice);
        if (forbiddenCharacteristicNames.size === 0) {
            return null;
        }

        let offset = 0;
        let referencedPricePlans;
        do {
            let result;
            try {
                result = await retrieveAssetAsync(
                    `/productOfferingPrice?popRelationship.id=${encodeURIComponent(previousBody.id)}` +
                    `&limit=${PRICE_PLAN_QUERY_PAGE_SIZE}&offset=${offset}`
                );
            } catch (err) {
                return {
                    status: 422,
                    message: 'The price plans referencing the constraint cannot be retrieved'
                };
            }

            referencedPricePlans = Array.isArray(result.body) ? result.body : [];
            const priceComponentRefs = [];
            for (const pricePlan of referencedPricePlans) {
                if (pricePlan.isBundle !== true) {
                    continue;
                }
                const constraintRef = getUniqueConstraintRef(pricePlan);
                if (constraintRef.error) {
                    return constraintRef.error;
                }
                if (!constraintRef.result || constraintRef.result.id !== previousBody.id) {
                    continue;
                }

                const planComponentRefs = Array.isArray(pricePlan.bundledPopRelationship)
                    ? pricePlan.bundledPopRelationship
                    : [];
                priceComponentRefs.push(...planComponentRefs);
            }

            const validationError = await validatePricePlanComponents(
                priceComponentRefs,
                forbiddenCharacteristicNames
            );
            if (validationError) {
                return validationError;
            }

            offset += referencedPricePlans.length;
        } while (referencedPricePlans.length === PRICE_PLAN_QUERY_PAGE_SIZE);

        return null;
    }

    const validateOfferingPrice = async function (req, previousBody, callback){
        const offerPrice = JSON.parse(req.body)
        // check if it is a valid percentage
        if (offerPrice && offerPrice.priceType && offerPrice.priceType.toLowerCase() === 'discount' && !tmfUtils.isValidDiscount(offerPrice)) {
            return callback({
                status: 422,
                message: 'Discount must be either a number or a string representing a number, percentage must be between 0 and 100 and fixed amount must be higher than 0'
            })
        }

        if (offerPrice && offerPrice.unitOfMeasure && !tmfUtils.isValidAmount(offerPrice.unitOfMeasure.amount)) {
            return callback({
                status: 422,
                message: 'Amount must be either a number or a string representing a number greater than 0'
            })
        }

        if (offerPrice && offerPrice.price && !tmfUtils.isValidPrice(offerPrice.price.value, offerPrice.price.unit)) {
            return callback({
                status: 422,
                message: 'Price must be either a number or a string representing a number between 0 and 1.000.000.000 and it must follow the ISO 4217 standard'
            })
        }

        if (previousBody && offerPrice.isBundle !== undefined && offerPrice.isBundle !== previousBody.isBundle) {
            return callback({
                status: 403,
                message: 'Field isBundle cannot be modified'
            });
        }

        if (previousBody && !previousBody.isBundle) { // price component or constraint PATCH
            offerPrice["@schemaLocation"] = config.priceCompSchema
            utils.updateBody(req, offerPrice)
        }

        let validationError = null;
        const isPricePlan = previousBody ? previousBody.isBundle : offerPrice.isBundle;
        const effectivePriceTypeValue = offerPrice.priceType !== undefined ? offerPrice.priceType : previousBody ? previousBody.priceType : '';
        if (isPricePlan) {
            validationError = await validatePricePlan(offerPrice, previousBody);
        } else if (String(effectivePriceTypeValue || '').toLowerCase() === CONSTRAINT_PRICE_TYPE) {
            validationError = await validateConstraintPrice(offerPrice, previousBody);
        } else if (previousBody && offerPrice.prodSpecCharValueUse !== undefined) {
            validationError = await validatePriceComponent(offerPrice, previousBody);
        }

        if (validationError) {
            return callback(validationError);
        }
        callback(null)
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// UPDATE ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validateElemOfferings = function(newUrl, newLifeCycle, validatedStates, callback) {
        retrieveAsset(newUrl, function(err, result) {
            if (err) {
                callback({
                    status: 500,
                    message: 'Attached offerings cannot be retrieved'
                });
            } else {
                const offerings = result.body;
                let offeringsValid = true;

                for (let i = 0; i < offerings.length && offeringsValid; i++) {
                    offeringsValid =
                        validatedStates[newLifeCycle]['offeringsValidStates'].indexOf(
                            offerings[i][LIFE_CYCLE].toLowerCase()
                        ) >= 0;
                }

                if (offeringsValid) {
                    callback(null);
                } else {
                    callback({
                        status: 400,
                        message: validatedStates[newLifeCycle]['errorMsg']
                    });
                }
            }
        });
    }

    const validateInvolvedOfferingsState = function(assertType, assetBody, offeringsPath, callback) {
        // For each state to be validated, this map contains the list of valid states of the offerings
        // attached to the asset whose state is going to be changed and the message to be returned
        // in case the asset cannot be updated
        let validatedStates = {};

        validatedStates[RETIRED_STATE] = {
            offeringsValidStates: [RETIRED_STATE, OBSOLETE_STATE],
            errorMsg: 'All the attached offerings must be retired or obsolete to retire a ' + assertType
        };

        validatedStates[OBSOLETE_STATE] = {
            offeringsValidStates: [OBSOLETE_STATE],
            errorMsg: 'All the attached offerings must be obsolete to make a ' + assertType + ' obsolete'
        };

        let newLifeCycle = assetBody && LIFE_CYCLE in assetBody ? assetBody[LIFE_CYCLE].toLowerCase() : null;

        if (newLifeCycle in validatedStates && assertType == 'catalog') {
            // Get catalog offerings from the database

            const catalogId = offeringsPath.split('/')[3]
            const query = {
                catalog: catalogId
            }

            indexes.search('offering', query)
                .then((result) => {
                    let newUrl = '/productOffering?href='

                    if (result.length == 0) {
                        return callback(null)
                    }
                    let ids = result.map((hit) => {
                        return hit.id
                    })

                    newUrl += ids.join(',')
                    validateElemOfferings(newUrl, newLifeCycle, validatedStates, callback)
                })

        } else if (newLifeCycle in validatedStates && assertType == 'product') {
            let newUrl = offeringsPath.replace('/catalog/', '')

            validateElemOfferings(newUrl, newLifeCycle, validatedStates, callback)
        } else {
            callback(null);
        }
    };

    // Validate the modification of a resource
    const validateUpdate = function(req, callback) {
        const catalogsPattern = new RegExp('/catalog/[^/]+/?$');
        //const offeringsPattern = new RegExp('/catalog/[^/]+/productOffering/[^/]+/?$');
        const offeringsPattern = new RegExp('/productOffering/[^/]+/?$');
        const productsPattern = new RegExp('/productSpecification/[^/]+/?$');
        const pricePattern = new RegExp('/productOfferingPrice/[^/]+/?$');

        try {
            const parsedBody = utils.emptyObject(req.body) ? null : JSON.parse(req.body);

            // Retrieve the resource to be updated or removed
            let url = req.apiUrl.replace(`/${config.endpoints.catalog.path}`, '')
            // THE URL for Offersa include a catalog
            if (offeringsPattern.test(req.apiUrl)) {
                let parts = req.apiUrl.split('/')
                url = `/productOffering/${parts[parts.length - 1]}`
            }

            retrieveAsset(url, function(err, result) {
                if (err) {
                    if (err.status === 404) {
                        callback({
                            status: 404,
                            message: 'The required resource does not exist'
                        });
                    } else {
                        callback({
                            status: 500,
                            message: 'The TMForum APIs fails to retrieve the object you are trying to update/delete'
                        });
                    }
                } else {
                    const previousBody = result.body;
                    // The related party field is sorted, since the order is not important
                    const sortParty = (p1, p2) => {
                        return p1.id > p2.id ? 1 : p2.id > p1.id ? -1 : 0;
                    };
                    if ( parsedBody != null && parsedBody.relatedParty && !equal( previousBody.relatedParty.sort(sortParty), parsedBody.relatedParty.sort(sortParty))) {
                        return callback({
                            status: 409,
                            message: 'The field "relatedParty" can not be modified'
                        });
                    }

                    // Catalog stuff should include a validFor field
                    if (parsedBody && !previousBody.validFor && !parsedBody.validFor) {
                        parsedBody.validFor = {
                            startDateTime: new Date().toISOString()
                        };
                        utils.updateBody(req, parsedBody);
                    }

                    if (parsedBody && parsedBody.lifecycleStatus != null && !tmfUtils.isValidStatusTransition(previousBody.lifecycleStatus, parsedBody.lifecycleStatus)) {
                        // The status is being updated
                        return callback({
                            status: 400,
                            message: `Cannot transition from lifecycle status ${previousBody.lifecycleStatus} to ${parsedBody.lifecycleStatus}`
                        })
                    }

                    if (categoryPattern.test(req.apiUrl)) {
                        validateCategory(req, parsedBody, previousBody, 'modify', callback);
                    } else if (offeringsPattern.test(req.apiUrl)) {
                        validateOffering(req, req.apiUrl, previousBody, parsedBody, (err) => {
                            if (err) {
                                callback(err)
                            } else {
                                req.apiUrl = `/catalog${url}`
                                callback(null)
                            }
                        });
                    } else if (pricePattern.test(req.apiUrl)) {
                        validateOfferingPrice(req, previousBody, callback);
                    } else {
                        if (tmfUtils.isOwner(req, previousBody)) {
                            if (catalogsPattern.test(req.apiUrl)) {
                                async.series(
                                    [
                                        function(callback) {
                                            // Validate catalog new contents
                                            validateCatalog(req, previousBody, parsedBody, callback);
                                        },
                                        function(callback) {
                                            // Retrieve all the offerings contained in the catalog
                                            var slash = req.apiUrl.endsWith('/') ? '' : '/';
                                            var offeringsInCatalogPath = req.apiUrl + slash + 'productOffering';

                                            validateInvolvedOfferingsState(
                                                'catalog',
                                                parsedBody,
                                                offeringsInCatalogPath,
                                                callback
                                            );
                                        }
                                    ],
                                    callback
                                );
                            } else if (productsPattern.test(req.apiUrl)) {
                                async.series(
                                    [
                                        function(callback) {
                                            var url = req.apiUrl;

                                            if (url.endsWith('/')) {
                                                url = url.slice(0, -1);
                                            }

                                            var urlParts = url.split('/');
                                            var productId = urlParts[urlParts.length - 1];

                                            var productSpecificationPos = req.apiUrl.indexOf(
                                                '/productSpecification'
                                            );
                                            var baseUrl = req.apiUrl.substring(0, productSpecificationPos);

                                            var offeringsContainProductPath =
                                                baseUrl + '/productOffering?productSpecification.id=' + productId;

                                            validateInvolvedOfferingsState(
                                                'product',
                                                parsedBody,
                                                offeringsContainProductPath,
                                                callback
                                            );
                                        },
                                        function(callback) {
                                            if (parsedBody) {
                                                validateProductUpdate(req, previousBody, parsedBody, callback);
                                            } else {
                                                callback(null);
                                            }
                                        },
                                        function(callback) {
                                            if (parsedBody) {
                                                validateProduct(req, parsedBody, callback);
                                            } else {
                                                callback(null);
                                            }
                                        }
                                    ],
                                    callback
                                );
                            } else {
                                callback(null);
                            }

                        } else {
                            callback({
                                status: 403,
                                message: 'The user making the request is not the owner of the accessed resource'
                            });
                        }
                    }
                }
            });
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });
        }
    };

    const isCategory = function(req, callback) {
        if (!categoryPattern.test(req.apiUrl)) {
            return callback({
                status: 405,
                message: 'The HTTP method DELETE is not allowed in the accessed API'
            });
        }
        callback(null);
    };

    const processQuery = async (req, callback) => {
        const query = req.query || {}

        const returnQueryRes = (result) => {
            let newUrl = '/catalog/productOffering?href='

            if (result.length > 0) {
                let ids = result.map((hit) => {
                    return hit.id
                })

                newUrl += ids.join(',')
            } else {
                newUrl += 'null'
            }

            req.apiUrl = newUrl

            // TODO: Check how to avoid the call if the result is 0
            callback(null)
        }

        const hasKeyword = query.keyword != null && String(query.keyword).trim().length > 0
        const hasCategoryFilters = query['category.id'] != null && String(query['category.id']).trim().length > 0

        if (offeringsPattern.test(req.path) && config.searchUrl && (hasKeyword || hasCategoryFilters)) {
            // Query to the external search engine
            let page = {}

            if (query.offset != null) {
                page.offset = query.offset
            }

            if (query.limit != null) {
                page.pageSize = query.limit
            }

            if (query.sort != null) {
                page.sort = query.sort
            }

            searchEngine.search(query.keyword, query['category.id'], page)
                .then(returnQueryRes)
                .catch(() => {
                    callback({
                        status: 400,
                        message: 'Error accessing search indexes'
                    })
                })
        } else {
            callback(null)
        }
    }

    const indexObject = (party, body, catalog) => {
        return indexes.indexDocument('offering', body.id, {
            relatedParty: party,
            catalog: catalog,
            lifecycleStatus: body.lifecycleStatus,
            category: body.category ? body.category.map((cat) => {
                return cat.id
            }) : []
        })
    }

    const updateindex = (body) => {
        return indexes.updateDocument('offering', body.id, {
            lifecycleStatus: body.lifecycleStatus,
            category: body.category ? body.category.map((cat) => {
                return cat.id
            }) : []
        })
    }

    const filterAdhocOffers = (req) => {
        const body = req.body

        if (Array.isArray(body)) {
            req.body = body.filter((offering) => {
                let filter = true;
                if (offering.relatedParty && offering.relatedParty.length > 0) {
                    const userPartyId = req.user ? req.user.partyId : null;
                    const hasBuyer = offering.relatedParty.some((party) => {
                        return party.role && party.role.toLowerCase() === config.roles.customer.toLowerCase();
                    });

                    if (hasBuyer) {
                        const isBuyer = userPartyId != null && offering.relatedParty.some((party) => {
                            return party.id === userPartyId
                                && party.role
                                && party.role.toLowerCase() === config.roles.customer.toLowerCase();
                        });
                        const isSeller = userPartyId != null && offering.relatedParty.some((party) => {
                            return party.id === userPartyId
                                && party.role
                                && party.role.toLowerCase() === config.roles.seller.toLowerCase();
                        });

                        filter = isBuyer || isSeller;
                    }
                }
                return filter
            })
        }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validators = {
        GET: [validateAllowed, processQuery, rewriteCatalogOfferingQuery],
        POST: [utils.validateLoggedIn, validateCreation],
        PATCH: [utils.validateLoggedIn, validateUpdate],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.validateLoggedIn, isCategory, validateUpdate]
    };

    const checkPermissions = function(req, callback) {
        const reqValidators = [];

        for (let i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    const getFilteredPaginationConfig = function(req) {
        const isGet = req.method === 'GET'
        const isCatalogList = isCatalogListRequest(req)
        const isLaunchedQuery = isLaunchedCatalogQuery(req)
        const hasRelatedParty = hasRelatedPartyFilter(req)

        if (
            !isGet ||
            !isCatalogList ||
            !isLaunchedQuery ||
            hasRelatedParty
        ) {
            logger.debug(
                'Catalog launched-offer filtered pagination disabled for URL ' + req.apiUrl +
                ': isGet=' + isGet +
                ', isCatalogList=' + isCatalogList +
                ', isLaunchedQuery=' + isLaunchedQuery +
                ', hasRelatedPartyFilter=' + hasRelatedParty
            )
            return null
        }

        logger.info('Catalog launched-offer filtered pagination enabled for URL ' + req.apiUrl)

        return {
            predicate: hasCatalogOffers
        }
    }

    const handleUpgradePostAction = function(req, body, storeMethod, callback) {
        var getURLId = function(apiUrl) {
            return apiUrl.split('/')[6];
        };

        // Check if the product has been upgraded
        if (!!body.version && !!body.productSpecCharacteristic) {
            var id = !!body.id ? body.id : getURLId(req.apiUrl);

            // Notify the error to the charging backend to downgrade the asset
            return storeMethod(
                {
                    id: id,
                    version: body.version,
                    productSpecCharacteristic: body.productSpecCharacteristic
                },
                req.user,
                () => {
                    callback(null);
                }
            );
        }
        callback(null);
    };

    const executePostValidation = function(req, callback) {
        // Attach product spec info for product creation request
        let body;

        if (req.method == 'GET' && req.apiUrl.indexOf('/productOffering') > -1) {
            // Process sort of responses if needed
            if (req.apiUrl.indexOf('href=') > -1) {
                // Ensure that the response is in the same order as in the query string
                try {
                    const query = req.apiUrl.split('?')[1]
                    const queryParts = query.split('&')

                    let refs = []

                    logger.debug(`Request ids in order: ${query}`);

                    queryParts.forEach((part) => {
                        const keyValue = part.split('=')
                        if (keyValue[0] === 'href') {
                            refs = keyValue[1].split(',')
                        }
                    })

                    let sortedBody = []
                    refs.forEach((itemId) => {
                        let item = req.body.find((it) => it.id === itemId)
                        sortedBody.push(item)
                    })

                    req.body = sortedBody
                } catch (e) {
                    logger.error('Error parsing query string for offering retrieval');
                }
            }

            filterAdhocOffers(req);

            return callback(null)
        } else if (req.method == 'POST' && categoriesPattern.test(req.apiUrl)) {
            body = req.body
            const hasParentId = !!body && Object.prototype.hasOwnProperty.call(body, 'parentId');
            const parentIdEmpty =
                !hasParentId ||
                body.parentId == null ||
                (typeof body.parentId === 'string' && body.parentId.trim() === '');
            const shouldAttachToDefaultCatalog = !!body && body.isRoot === true && parentIdEmpty;

            if (!shouldAttachToDefaultCatalog) {
                return callback(null);
            }

            retrieveAsset(`/catalog/${config.defaultId}`, function(err, result) {
            if (err) {
                if (err.status == 404) {
                    callback({
                        status: 400,
                        message: 'Missing default catalog in the system'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'Error with default catalog in the system'
                    });
                }
            } else {
                let dftCategory = result.body.category
                if (!dftCategory) {
                    dftCategory = []
                }
                dftCategory.push({id: body.id, href: body.href, name: body.name})
                updateAsset(`/catalog/${config.defaultId}`, {category: dftCategory}, function(err, result){
                    if (err){
                        callback({
                            status: 500,
                            message: 'Error adding the category to default catalog'
                        })
                    } else{
                        callback(null)
                    }
                })
            }
        })
        } else if (req.method == 'PATCH' && categoryPattern.test(req.apiUrl)) {
            body = req.body
            const lifecycleStatus =
                !!body && !!body.lifecycleStatus && typeof body.lifecycleStatus === 'string'
                    ? body.lifecycleStatus.toLowerCase()
                    : null;
            const shouldDetachFromDefaultCatalog =
                lifecycleStatus === RETIRED_STATE || lifecycleStatus === OBSOLETE_STATE;
            const categoryId = !!body && !!body.id ? body.id : null;

            if (!shouldDetachFromDefaultCatalog || !categoryId) {
                return callback(null);
            }

            retrieveAsset(`/catalog/${config.defaultId}`, function(err, result) {
                if (err) {
                    if (err.status == 404) {
                        callback({
                            status: 400,
                            message: 'Missing default catalog in the system'
                        });
                    } else {
                        callback({
                            status: 500,
                            message: 'Error with default catalog in the system'
                        });
                    }
                } else {
                    let dftCategory = result.body.category
                    if (!Array.isArray(dftCategory)) {
                        dftCategory = []
                    }
                    const updatedCategory = dftCategory.filter((category) => category.id !== categoryId)
                    if (updatedCategory.length === dftCategory.length) {
                        return callback(null)
                    }
                    updateAsset(`/catalog/${config.defaultId}`, {category: updatedCategory}, function(err){
                        if (err){
                            callback({
                                status: 500,
                                message: 'Error removing the category from default catalog'
                            })
                        } else{
                            callback(null)
                        }
                    })
                }
            })
        } else if (req.method == 'POST' && productsPattern.test(req.apiUrl)) {
            body = req.body;
            storeClient.attachProduct(
                body,
                req.user,
                callback
            );
        } else if (req.method == 'POST' && offeringsPattern.test(req.apiUrl)) {
            let catalog = '';
            body = req.body

            if (req.url.indexOf('/catalog/catalog/') > -1) {
                catalog = req.url.split('/')[3];
            }

            indexObject(req.user.partyId, body, catalog).then(() => {
            }).catch((err)=>{
            }).finally(() => {
                storeClient.attachOffering(
                    body,
                    req.user,
                    callback
                );
            })
        } else if ((req.method == 'PATCH' || req.method == 'PUT') && offeringPattern.test(req.apiUrl)) {
            body = req.body;
            updateindex(body).then(() => {
            }).catch((err) => {
            }).finally(() => {
                storeClient.updateOffering(
                    body,
                    req.user,
                    callback
                );
            })
        } else if (req.method == 'PATCH' && productPattern.test(req.apiUrl)) {
            body = req.reqBody;

            handleUpgradePostAction(
                req,
                body,
                storeClient.attachUpgradedProduct,
                callback
            );
        } else {
            callback(null)
        }
    };

    var handleAPIError = function(req, callback) {
        if (productsPattern.test(req.apiUrl) && req.method == 'POST') {
            var body = JSON.parse(req.reqBody);

            // Notify the error to the charging backend to remove tha asset
            storeClient.rollbackProduct(body, req.user, () => {
                // No matter rollback status, return API message
                callback(null);
            });
        } else if (productPattern.test(req.apiUrl) && req.method == 'PATCH') {
            var body = JSON.parse(req.reqBody);
            handleUpgradePostAction(req, body, storeClient.rollbackProductUpgrade, callback);
        } else {
            callback(null);
        }
    };

    const checkOfferingLaunch = function(req, res) {
        const offeringId = req.params.id;
        retrieveAsset(`/productOffering/${offeringId}`, function(err, result) {
            if (err) {
                res.status(err.status || 500).json({ error: 'The product offering cannot be retrieved' });
            } else {
                canOfferingBeLaunched(result.body).then((canBeLaunched) => {
                    res.json({
                        canBeLaunched: canBeLaunched
                    });
                });
            }
        });
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation,
        getFilteredPaginationConfig: getFilteredPaginationConfig,
        handleAPIError: handleAPIError,
        retrieveCatalog: retrieveCatalog,
        checkOfferingLaunch: checkOfferingLaunch,
    };
})();

exports.catalog = catalog;
