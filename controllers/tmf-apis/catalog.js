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
const deepcopy = require('deepcopy')
const equal = require('deep-equal')
const { indexes } = require('./../../lib/indexes')
const logger = require('./../../lib/logger').logger.getLogger('TMF')
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

    const validateOffering = function(req, offeringPath, previousBody, newBody, callback) {
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
        }

        if (newBody && previousBody) {
            const modifiedField = validateOfferingFields(previousBody, newBody);

            if (modifiedField !== null) {
                return callback({
                    status: 403,
                    message: 'Field ' + modifiedField + ' cannot be modified'
                });
            }
        }

        if(newBody && newBody['category']){
            const dict = {}
            newBody['category'] = newBody
            ['category'].filter((category) => { 
                if(dict[category.id]) return false
                else{
                    dict[category.id] = 1
                    return true
                }
            })
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
                validateOfferingPrice(req, callback);
            }
            else {
                callback(null);
                //createHandler(req, body, callback);
            }
        }
    };

    const validateOfferingPrice = function (req, callback){
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
                        validateOfferingPrice(req, callback);
                    } else {
                        if (tmfUtils.isOwner(req, previousBody)) {
                            // The related party field is sorted, since the order is not important
                            var sortParty = (p1, p2) => {
                                return p1.id > p2.id ? 1 : p2.id > p1.id ? -1 : 0;
                            };

                            if (
                                parsedBody != null &&
                                parsedBody.relatedParty &&
                                !equal(
                                    previousBody.relatedParty.sort(sortParty),
                                    parsedBody.relatedParty.sort(sortParty)
                                )
                            ) {
                                callback({
                                    status: 409,
                                    message: 'The field "relatedParty" can not be modified'
                                });
                            } else {
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

        if (offeringsPattern.test(req.path) && req.query.keyword != null && config.searchUrl) {
            // Query to the external search engine
            let page = {}

            if (req.query.offset != null) {
                page.offset = req.query.offset
            }

            if (req.query.limit != null) {
                page.pageSize = req.query.limit
            }

            searchEngine.search(req.query.keyword, req.query['category.id'], page)
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
                    const extBuyer = offering.relatedParty.find((party) => {
                        return (party.role.toLowerCase() === config.roles.customer.toLowerCase())
                            && (!req.user || party.id !== req.user.partyId)
                    });
                    filter = !extBuyer;
                }
                return filter
            })
        }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validators = {
        GET: [validateAllowed, processQuery],
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

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation,
        handleAPIError: handleAPIError,
        retrieveCatalog: retrieveCatalog,
    };
})();

exports.catalog = catalog;
