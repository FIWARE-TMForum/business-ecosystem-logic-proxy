/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

var async = require('async'),
    config = require('./../../config'),
    deepcopy = require("deepcopy"),
    equal = require('deep-equal'),
    indexes = require('./../../lib/indexes.js'),
    leftPad = require("left-pad"),
    logger = require('./../../lib/logger').logger.getLogger('TMF'),
    md5 = require("blueimp-md5"),
    Promise = require('promiz'),
    request = require('request'),
    rssClient = require('./../../lib/rss').rssClient,
    storeClient = require('./../../lib/store').storeClient,
    tmfUtils = require('./../../lib/tmfUtils'),
    url = require('url'),
    utils = require('./../../lib/utils');


var LIFE_CYCLE = 'lifecycleStatus';

var ACTIVE_STATE = 'active';
var LAUNCHED_STATE = 'launched';
var RETIRED_STATE = 'retired';
var OBSOLETE_STATE = 'obsolete';


// Validator to check user permissions for accessing TMForum resources
var catalog = (function() {

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var offeringsPattern = new RegExp('/productOffering/?$');
    var catalogOfferingsPattern = new RegExp('/catalog/[^/]+/productOffering/?');
    var offeringPattern = new RegExp('/catalog/[^/]+/productOffering/[^/]+/?$');
    var productsPattern = new RegExp('/productSpecification/?$');
    var productPattern = new RegExp('/productSpecification/[^/]+/?$');
    var categoryPattern = new RegExp('/category/[^/]+/?$');
    var categoriesPattern = new RegExp('/category/?$');
    var catalogsPattern = new RegExp('/catalog/?$');

    var retrieveAsset = function(assetPath, callback) {

        var uri = utils.getAPIURL(config.endpoints.catalog.appSsl, config.endpoints.catalog.host, config.endpoints.catalog.port, assetPath);

        request(uri, function(err, response, body) {
            if (err || response.statusCode >= 400) {
                callback({
                    status: response ? response.statusCode : 500
                });
            } else {
                callback(null, {
                    status: response.statusCode,
                    body: body
                });
            }
        });
    };

    // Retrieves the product belonging to a given offering
    var retrieveProduct = function(productUrl, callback) {

        var productPath = url.parse(productUrl).pathname;

        retrieveAsset(productPath, function(err, response) {
            if (err) {
                callback({
                    status: 422,
                    message: 'The attached product cannot be read or does not exist'
                })
            } else {
                callback(err, response);
            }
        });
    };

    var checkAssetStatus = function(assetBody, validStates) {
        return LIFE_CYCLE in assetBody && validStates.indexOf(assetBody[LIFE_CYCLE].toLowerCase()) >= 0;
    };

    // The request is directly allowed without extra validation required
    var validateAllowed = function(req, callback) {
        callback(null);
    };

    var catalogPathFromOfferingUrl = function(offeringUrl) {
        var productOfferingPos = offeringUrl.indexOf('/productOffering');
        return url.parse(offeringUrl.substring(0, productOfferingPos)).pathname;
    };

    var validateRSModel = function(req, body, callback) {
        // Someone may have made a PATCH request without body
        if (body == null) {
            return callback(null);
        }

        // Check if the provider has been included in the RSS
        rssClient.createProvider(req.user, function(err) {
            if (err) {
                return callback({
                    status: 500,
                    message: 'An unexpected error in the RSS API prevented your request to be processed'
                });
            }

            // Check if the productClass has been provided
            if (body.serviceCandidate && body.serviceCandidate.id) {
                rssClient.retrieveRSModel(req.user, body.serviceCandidate.id, function(err, res) {
                    if (err) {
                        return callback(err);
                    } else {
                        // Check if there is a model for the specified product class
                        var models = JSON.parse(res.body);
                        if (!models.length) {
                            return callback({
                                status: 422,
                                message: 'The provided productClass does not specify a valid revenue sharing model'
                            })
                        }
                        callback(null);
                    }
                });
            } else {
                // Include the default product class
                body.serviceCandidate = {
                    id: 'defaultRevenue',
                    name: 'Revenue Sharing Service'
                };
                utils.updateBody(req, body);
                callback(null);
            }
        });
    };

    var validateOfferingFields = function(previousBody, newBody) {
        var fixedFields = ['isBundle', 'productSpecification', 'bundledProductOffering', 'validFor'];
        var modified = null;

        for (var i = 0; i < fixedFields.length && modified == null; i++) {
            var field = fixedFields[i];
            if(newBody[field] && !equal(newBody[field], previousBody[field])) {
                modified = field;
            }
        }
        return modified;
    };

    var validateCatalog = function(req, offeringPath, validStates, newBody, errorMessageStateCatalog, callback) {
        // Retrieve the catalog
        var catalogPath = catalogPathFromOfferingUrl(offeringPath);
        retrieveAsset(catalogPath, function (err, result) {

            if (err) {
                callback({
                    status: 500,
                    message: 'The catalog attached to the offering cannot be read'
                });
            } else {

                var catalog = JSON.parse(result.body);

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

    var validateAssetPermissions = function(req, asset, validStates, errorMessageStateProduct, userNotAllowedMsg, callback) {

        // Check that the user is the owner of the asset
        // Offerings don't include a relatedParty field, so for bundles it is needed to retrieve the product
        var ownerHandler = function(req, asset, hdlrCallback) {
            if (!asset.relatedParty) {
                retrieveProduct(asset.productSpecification.href, function(err, result) {
                    var isOwner = false;
                    if (!err) {
                        var product = JSON.parse(result.body);
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

    var validateOffering = function(req, offeringPath, previousBody, newBody, callback) {

        var validStates = null;
        var errorMessageStateProduct = null;
        var errorMessageStateCatalog = null;

        if (previousBody === null) {

            // Offering creation
            validStates = [ACTIVE_STATE, LAUNCHED_STATE];
            errorMessageStateProduct = 'Offerings can only be attached to active or launched products';
            errorMessageStateCatalog = 'Offerings can only be created in a catalog that is active or launched';

        } else if (previousBody !== null && newBody &&
                LIFE_CYCLE in newBody && newBody[LIFE_CYCLE].toLowerCase() === LAUNCHED_STATE) {

            // Launching an existing offering
            validStates = [LAUNCHED_STATE];
            errorMessageStateProduct = 'Offerings can only be launched when the attached product is also launched';
            errorMessageStateCatalog = 'Offerings can only be launched when the attached catalog is also launched';

        }

        if (newBody && previousBody){
            var modifiedField = validateOfferingFields(previousBody, newBody);

            if (modifiedField !== null) {
                return callback({
                    status: 403,
                    message: 'Field ' + modifiedField +' cannot be modified'
                });
            }
        }

        if (newBody && !previousBody && !newBody.validFor) {
            newBody.validFor = {
                startDateTime: new Date().toISOString()
            }
        }

        async.series([
            function (callback) {
                // Check the RS model
                if ((newBody && !previousBody) || (previousBody && newBody && newBody.serviceCandidate)) {
                    validateRSModel(req, newBody, callback);
                } else {
                    callback(null);
                }
            },
            function (callback) {
                // Check the offering categories
                var categories = newBody ? newBody.category : [];

                async.eachSeries(categories, function (category, taskCallback) {

                    var categoryApiUrl = url.parse(category.href).pathname;

                    checkExistingCategoryById(categoryApiUrl, category.id, taskCallback);

                }, callback);
            }], function (err) {
                if (err) {
                    callback(err);
                } else {

                    // Check if the offering is a bundle.
                    var offeringBody = previousBody || newBody;
                    if (offeringBody.isBundle) {
                        // Bundle offerings cannot contain a productSpecification
                        if(offeringBody.productSpecification) {
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
                        async.each(offeringBody.bundledProductOffering, function(offering, taskCallback) {
                            if (!offering.href) {
                                return taskCallback({
                                    status: 422,
                                    message: 'Missing required field href in bundled offering'
                                });
                            }

                            var offeringPath = url.parse(offering.href).pathname;
                            retrieveAsset(offeringPath, function(err, result) {
                                if (err) {
                                    var id = offering.id ? offering.id : '';
                                    return taskCallback({
                                        status: 422,
                                        message: 'The bundled offering ' + id + ' cannot be accessed or does not exists'
                                    });
                                }

                                // Check that the included offering is not also a bundle
                                var bundledOffering = JSON.parse(result.body);
                                if (bundledOffering.isBundle) {
                                    return taskCallback({
                                        status: 422,
                                        message: 'Product offering bundles cannot include another bundle'
                                    });
                                }

                                var userNotAllowedMsg = 'You are not allowed to bundle offerings you do not own';
                                validateAssetPermissions(req, bundledOffering, validStates, errorMessageStateProduct, userNotAllowedMsg, taskCallback);

                            });

                        }, function(err) {
                            if (err) {
                                callback(err);
                            } else if (validStates != null) {
                                // This validation only need to be executed once
                                validateCatalog(req, offeringPath, validStates, newBody, errorMessageStateCatalog, callback);
                            } else {
                                callback(null);
                            }
                        })

                    } else {

                        // Non bundles cannot contain a bundleProductOffering
                        if (offeringBody.bundledProductOffering && offeringBody.bundledProductOffering.length > 0) {
                            return callback({
                                status: 422,
                                message: 'Product offerings which are not a bundle cannot contain a bundled product offering'
                            });
                        }

                        // Check that a productSpecification has been included
                        if (!offeringBody.productSpecification || utils.emptyObject(offeringBody.productSpecification)) {
                            return callback({
                                status: 422,
                                message: 'Product offerings must contain a productSpecification'
                            });
                        }

                        if (!offeringBody.productSpecification.href) {
                            return callback({
                                status: 422,
                                message: 'Missing required field href in product specification'
                            });
                        }

                        // Check that the product attached to the offering is owned by the same user
                        retrieveProduct(offeringBody.productSpecification.href, function(err, result) {
                            if (err) {
                                callback(err);
                            } else {
                                var operation = previousBody != null ? 'update' : 'create';
                                var userNotAllowedMsg = 'You are not allowed to ' + operation + ' offerings for products you do not own';
                                var product = JSON.parse(result.body);

                                validateAssetPermissions(req, product, validStates, errorMessageStateProduct, userNotAllowedMsg, function(err) {
                                    if (err) {
                                        callback(err);
                                    } else if (validStates != null) {
                                        validateCatalog(req, offeringPath, validStates, newBody, errorMessageStateCatalog, callback);
                                    } else {
                                        callback(null);
                                    }
                                });
                            }
                        });
                    }
                }
            }
        );
    };

    var checkExistingCategoryById = function (apiUrl, categoryId, callback) {

        var categoryCollectionPath = '/category';
        var categoryPath = apiUrl.substring(0, apiUrl.indexOf(categoryCollectionPath) +
            categoryCollectionPath.length);

        retrieveAsset(categoryPath + '/' + categoryId, function (err, result) {

            if (err) {

                if (err.status == 404) {
                    callback({
                        status: 400,
                        message: 'Invalid category with id: ' + categoryId
                    });

                } else  {
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

    var checkExistingCategory = function(apiUrl, categoryName, isRoot, parentId, callback) {

        var categoryCollectionPath = '/category';
        var categoryPath = apiUrl.substring(0, apiUrl.indexOf(categoryCollectionPath) +
            categoryCollectionPath.length);

        var queryParams = '?name=' + categoryName;

        if (isRoot) {
            queryParams += '&isRoot=true';
        } else {
            queryParams += '&parentId=' + parentId;
        }

        retrieveAsset(categoryPath + queryParams, function (err, result) {

            if (err) {
                callback({
                    status: 500,
                    message: 'It was impossible to check if the provided category already exists'
                });
            } else {

                var existingCategories = JSON.parse(result.body);

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

    var validateCategory = function(req, updatedCategory, oldCategory, action, callback) {

        // Categories can only be created by administrators
        if (!utils.hasRole(req.user, config.oauth2.roles.admin)) {
            callback({
                status: 403,
                message: 'Only administrators can ' + action + ' categories'
            });
        } else {

            if (updatedCategory && ['POST', 'PATCH', 'PUT'].indexOf(req.method.toUpperCase()) >= 0) {

                // Categories are created as root when isRoot is not included
                var isRoot = 'isRoot' in updatedCategory ? updatedCategory.isRoot :
                    (oldCategory ? oldCategory.isRoot : true);
                var parentId = 'parentId' in updatedCategory ? updatedCategory.parentId :
                    (oldCategory? oldCategory.parentId : null);

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

                    var categoryName = 'name' in updatedCategory ? updatedCategory.name :
                        (oldCategory ? oldCategory.name : null);

                    if (!categoryName) {
                        callback({
                            status: 400,
                            message: 'Category name is mandatory'
                        });

                    } else {

                        var fieldUpdated = function(oldCategory, updatedCategory, field) {
                            return oldCategory && updatedCategory[field] && updatedCategory[field] != oldCategory[field];
                        };

                        var newCategory = updatedCategory && !oldCategory;
                        var nameUpdated = fieldUpdated(oldCategory, updatedCategory, 'name');
                        var isRootUpdated = fieldUpdated(oldCategory, updatedCategory, 'isRoot');
                        var parentIdUpdated = fieldUpdated(oldCategory, updatedCategory, 'parentId');

                        // We should check for other categories with the same properties (name, isRoot, parentId) when:
                        //   1.- The category is new (updatedCategory is not null && oldCategory is null)
                        //   2.- The name of the category is updated
                        //   3.- The parent ID of the category is updated
                        //   4.- The root status of the category is changed
                        if (newCategory || nameUpdated || isRootUpdated || parentIdUpdated) {
                            async.series([
                                function (callback) {
                                    if (!isRoot) {
                                        // Check parent category
                                        checkExistingCategoryById(req.apiUrl, parentId, callback);
                                    } else {
                                        callback(null);
                                    }
                                },
                                function (callback) {
                                    checkExistingCategory(req.apiUrl, categoryName, isRoot, parentId, callback);
                                }], callback);
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

    var validateProductUpdate = function (req, prevBody, newBody, callback) {
        if ((!!newBody.isBundle || !!newBody.bundledProductSpecification) &&
                prevBody.lifecycleStatus.toLowerCase() != 'active') {

            return callback({
                status: 422,
                message: 'It is not allowed to update bundle related attributes (isBundle, bundledProductSpecification) in launched products'
            });
        }

        // Check upgrade problems if the product is a digital one
        if (tmfUtils.isDigitalProduct(prevBody.productSpecCharacteristic)) {
            if (!!newBody.version && !tmfUtils.isDigitalProduct(newBody.productSpecCharacteristic)
                    && newBody.version != prevBody.version) {

                // Trying to upgrade the product without providing new asset info
                return callback({
                    status: 422,
                    message: 'To upgrade digital product specifications it is required to provide new asset info'
                });
            }

            if((!!newBody.version && newBody.version == prevBody.version) || typeof newBody.version === 'undefined'
                    && !!newBody.productSpecCharacteristic &&
                    !equal(newBody.productSpecCharacteristic, prevBody.productSpecCharacteristic)) {

                return callback({
                    status: 422,
                    message: 'Product specification characteristics only can be updated for upgrading digital products'
                });
            }

            if (!!newBody.version && newBody.version != prevBody.version &&
                    tmfUtils.isDigitalProduct(newBody.productSpecCharacteristic) &&
                    !tmfUtils.equalCustomCharacteristics(newBody.productSpecCharacteristic, prevBody.productSpecCharacteristic)) {

                return callback({
                    status: 422,
                    message: 'It is not allowed to update custom characteristics during a product upgrade'
                });
            }

            if (!!newBody.version && newBody.version != prevBody.version && !!newBody.productSpecCharacteristic) {
                return storeClient.upgradeProduct({
                    id: prevBody.id,
                    version: newBody.version,
                    productSpecCharacteristic: newBody.productSpecCharacteristic
                }, req.user, callback);
            }
        } else if (!!newBody.productSpecCharacteristic &&
                !equal(newBody.productSpecCharacteristic, prevBody.productSpecCharacteristic)){

            return callback({
                status: 422,
                message: 'Product spec characteristics cannot be updated'
            });
        }

        return callback(null);
    };

    var validateProduct = function(req, productSpec, callback) {
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

        async.each(productSpec.bundledProductSpecification, function(spec, taskCallback) {
            // Validate that the bundled products exists
            if (!spec.href) {
                return taskCallback({
                    status: 422,
                    message: 'Missing required field href in bundleProductSpecification'
                });
            }

            retrieveProduct(spec.href, function(err, result) {
                if (err) {
                    taskCallback(err);
                } else {
                    var product = JSON.parse(result.body);

                    // Validate that the bundle products belong to the same owner
                    if (!tmfUtils.isOwner(req, product)) {
                        return taskCallback({
                            status: 403,
                            message: 'You are not authorized to include the product spec ' + product.id + ' in a product spec bundle'
                        });
                    }

                    // Validate that the bundle products are not also bundles
                    if (product.isBundle) {
                        return taskCallback({
                            status: 422,
                            message: 'It is not possible to include a product spec bundle in another product spec bundle'
                        });
                    }

                    // Validate that the bundled products are in a valid life cycle state (Active or launched)
                    if([ACTIVE_STATE, LAUNCHED_STATE].indexOf(product.lifecycleStatus.toLowerCase()) < 0) {
                        return taskCallback({
                            status: 422,
                            message: 'Only Active or Launched product specs can be included in a bundle'
                        })
                    }

                    taskCallback(null);
                }
            });

        }, function(err) {
            callback(err);
        });
    };

    var checkExistingCatalog = function (apiUrl, catalogName, callback) {

        var catalogCollectionPath = '/catalog';
        var catalogPath = apiUrl.substring(0, apiUrl.lastIndexOf(catalogCollectionPath) +
            catalogCollectionPath.length);

        var queryParams = '?name=' + catalogName;

        retrieveAsset(catalogPath + queryParams, function (err, result) {

            if (err) {
                callback({
                    status: 500,
                    message: 'It was impossible to check if there is another catalog with the same name'
                });
            } else {

                var existingCatalog = JSON.parse(result.body);

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


    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////// CREATION //////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var createHandler = function(req, resp, callback) {
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
    var validateCreation = function(req, callback) {

        var body;

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

        if (categoriesPattern.test(req.apiUrl)) {

            validateCategory(req, body, null, 'create', callback);

        } else {

            // Check that the user has the seller role or is an admin
            if (!utils.hasRole(req.user, config.oauth2.roles.seller)) {

                callback({
                    status: 403,
                    message: 'You are not authorized to create resources'
                });

                return; // EXIT
            }

            if (offeringsPattern.test(req.apiUrl)) {
                validateOffering(req, req.apiUrl, null, body, function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        storeClient.validateOffering(body, req.user, function (err) {
                            if (err) {
                                callback(err);
                            } else {
                                callback(null);
                            }
                        });
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

                var catalogName = body.name;

                // Check that the catalog name is not already taken
                checkExistingCatalog(req.apiUrl, catalogName, function (result) {
                    if (result) {
                        callback(result);
                    } else {
                        createHandler(req, body, callback);
                    }
                })

            } else {
                createHandler(req, body, callback);
            }
        }
    };


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// UPDATE ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validateInvolvedOfferingsState = function(assertType, assetBody, offeringsPath, callback) {

        // For each state to be validated, this map contains the list of valid states of the offerings
        // attached to the asset whose state is going to be changed and the message to be returned
        // in case the asset cannot be updated
        var validatedStates = {};

        validatedStates[RETIRED_STATE] = {
            offeringsValidStates: [RETIRED_STATE, OBSOLETE_STATE],
            errorMsg: 'All the attached offerings must be retired or obsolete to retire a ' + assertType
        };

        validatedStates[OBSOLETE_STATE] = {
            offeringsValidStates: [OBSOLETE_STATE],
            errorMsg: 'All the attached offerings must be obsolete to make a ' + assertType + ' obsolete'
        };


        var newLifeCycle = assetBody && LIFE_CYCLE in assetBody ? assetBody[LIFE_CYCLE].toLowerCase() : null;

        if (newLifeCycle in validatedStates) {

            retrieveAsset(offeringsPath, function(err, result) {

                if (err) {

                    callback({
                        status: 500,
                        message: 'Attached offerings cannot be retrieved'
                    });

                } else {

                    var offerings = JSON.parse(result.body);
                    var offeringsValid = true;

                    for (var i = 0; i < offerings.length && offeringsValid; i++) {

                        offeringsValid = validatedStates[newLifeCycle]['offeringsValidStates'].indexOf(
                                offerings[i][LIFE_CYCLE].toLowerCase()) >= 0;
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

        } else {
            callback(null);
        }
    };

    var isEqualRelatedParty = function (relatedParty1, relatedParty2) {

        if (relatedParty1.length != relatedParty2.length) {
            return false;
        } else {

            // Copy relatedParties
            var copyRelatedParty1 = relatedParty1.slice();
            var copyRelatedParty2 = relatedParty2.slice();

            var matched = 0;

            for (var i = 0; i < copyRelatedParty1.length; i++) {

                for (var j = 0; j < copyRelatedParty2.length; j++) {

                    if (copyRelatedParty1[i].id === copyRelatedParty2[j].id &&
                        copyRelatedParty1[i].href === copyRelatedParty2[j].href &&
                        copyRelatedParty1[i].role === copyRelatedParty2[j].role) {

                        copyRelatedParty2[j] = {};
                        matched += 1;
                    }
                }
            }

            return matched === relatedParty1.length;
        }
    };

    // Validate the modification of a resource
    var validateUpdate = function(req, callback) {

        var catalogsPattern = new RegExp('/catalog/[^/]+/?$');
        var offeringsPattern = new RegExp('/catalog/[^/]+/productOffering/[^/]+/?$');
        var productsPattern = new RegExp('/productSpecification/[^/]+/?$');

        try {

            var parsedBody = utils.emptyObject(req.body) ? null : JSON.parse(req.body);

            // Retrieve the resource to be updated or removed
            retrieveAsset(req.apiUrl, function (err, result) {

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
                        })
                    }

                } else {

                    var previousBody = JSON.parse(result.body);

                    if (categoryPattern.test(req.apiUrl)) {
                        validateCategory(req, parsedBody, previousBody, 'modify', callback);

                    } else if (offeringsPattern.test(req.apiUrl)) {
                        validateOffering(req, req.apiUrl, previousBody, parsedBody, callback);

                    } else {

                        if (tmfUtils.isOwner(req, previousBody)) {

                            if (parsedBody != null && parsedBody.relatedParty &&
                                !isEqualRelatedParty(previousBody.relatedParty, parsedBody.relatedParty)) {
                                    callback({
                                        status: 409,
                                        message: 'The field "relatedParty" can not be modified'
                                    });

                            } else {

                                if (catalogsPattern.test(req.apiUrl)) {

                                    // Retrieve all the offerings contained in the catalog
                                    var slash = req.apiUrl.endsWith('/') ? '' : '/';
                                    var offeringsInCatalogPath = req.apiUrl + slash + 'productOffering';

                                    validateInvolvedOfferingsState('catalog', parsedBody, offeringsInCatalogPath, callback);

                                } else if (productsPattern.test(req.apiUrl)) {

                                    async.series([
                                        function (callback) {

                                            var url = req.apiUrl;

                                            if (url.endsWith('/')) {
                                                url = url.slice(0, -1);
                                            }

                                            var urlParts = url.split('/');
                                            var productId = urlParts[urlParts.length - 1];

                                            var productSpecificationPos = req.apiUrl.indexOf('/productSpecification');
                                            var baseUrl = req.apiUrl.substring(0, productSpecificationPos);

                                            var offeringsContainProductPath = baseUrl + '/productOffering?productSpecification.id=' + productId;

                                            validateInvolvedOfferingsState('product', parsedBody, offeringsContainProductPath, callback);

                                        },
                                        function (callback) {

                                            if (parsedBody) {
                                                validateProductUpdate(req, previousBody, parsedBody, callback);
                                            } else {
                                                callback(null);
                                            }
                                        }, function (callback) {
                                            if (parsedBody) {
                                                validateProduct(req, parsedBody, callback);
                                            } else {
                                                callback(null);
                                            }
                                        }], callback);

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

    var isCategory = function(req, callback) {

        if (!categoryPattern.test(req.apiUrl)) {
            return callback({
                status: 405,
                message: 'The HTTP method DELETE is not allowed in the accessed API'
            });
        }
        callback(null);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////// INDEXES ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var middlewareSave = function middlewareSave(f, body, user, cb) {
        return function (err, data) {
            f(body, user)
                .then(() => cb(err, data))
                .catch(() => cb(err, data));
        };
    };

    var handleIndexes = function handleIndexes(req, callback) {
        // Handle PUT and PATCH data
        var offeringsPattern = new RegExp('/productOffering/?');
        var productsPattern = new RegExp('/productSpecification/?');
        var catalogPattern = new RegExp('/catalog/?');

        var genericSave = function genericSave(f) {
            f([JSON.parse(req.body)], req.user)
                .then(() => callback(null))
                .catch(() => callback(null));
        };

        var patternsF = [
            [offeringsPattern, indexes.saveIndexOffering],
            [productsPattern, indexes.saveIndexProduct],
            [catalogPattern, indexes.saveIndexCatalog]];

        for(var ind in patternsF) {
            var pattern = patternsF[ind][0];
            var f = patternsF[ind][1];
            if (pattern.test(req.apiUrl) && (req.method == 'PATCH' || req.method == 'PUT')) {
                genericSave(f);
                return;
            }
        }

        callback(null);
    };

    var lifecycleQuery = function lifecycleQuery(req, query) {
        utils.queryAndOrCommas(req.query.lifecycleStatus, "lifecycleStatus", query);
    };

    var createProductQuery = indexes.genericCreateQuery.bind(
	    null,
	    ["isBundle", "productNumber"],
        "product",
    	function (req, query) {
	        if (req.query["relatedParty.id"]) {
                indexes.addAndCondition(query, { relatedPartyHash: [indexes.fixUserId(req.query["relatedParty.id"])]});
    	    }

            utils.queryAndOrCommas(req.query["body"], "body", query);
            lifecycleQuery(req, query);
	});

    var createOfferQuery = indexes.genericCreateQuery.bind(
	    null,
	    ["isBundle", "name"],
        "offering",
	    function (req, query) {
	        if (catalogOfferingsPattern.test(req.apiUrl)) {
	            var catalog = req.apiUrl.split('/')[6];
	            indexes.addAndCondition(query, { catalog: [leftPad(catalog, 12, 0)] });
            }
            if (req.query.relatedParty) {
                indexes.addAndCondition(query, { userId: [indexes.fixUserId(req.query.relatedParty)] });
            }
            if (req.query["category.id"]) {
                indexes.addAndCondition(query, { categoriesId: [leftPad(req.query["category.id"], 12, 0)]});
            }
            if (req.query["category.name"]) {
                indexes.addAndCondition(query, { categoriesName: [md5(req.query["category.name"].toLowerCase())]});
            }

            utils.queryAndOrCommas(req.query["productSpecification.id"], "productSpecification", query, x => leftPad(x, 12, 0));
            utils.queryAndOrCommas(req.query["bundledProductOffering.id"], "bundledProductOffering", query, x => leftPad(x, 12, 0));
            utils.queryAndOrCommas(req.query["body"], "body", query);
            lifecycleQuery(req, query);
	});

    var createCatalogQuery = indexes.genericCreateQuery.bind(
        null,
        ["name"],
        "catalog",
        function (req, query) {
            if (req.query["relatedParty.id"]) {
                indexes.addAndCondition(query, { relatedPartyHash: [indexes.fixUserId(req.query["relatedParty.id"])] });
            }

            utils.queryAndOrCommas(req.query["body"], "body", query);
            lifecycleQuery(req, query);
        }
    );

    var offeringGetParams = new RegExp('/productOffering(\\?|$)');
    var productGetParams = new RegExp('/productSpecification(\\?|$)');
    var catalogGetParams = new RegExp('/catalog(\\?|$)');

    var getCatalogRequest = indexes.getMiddleware.bind(null, catalogGetParams, createCatalogQuery, indexes.searchCatalogs);

    var getProductRequest = indexes.getMiddleware.bind(null, productGetParams, createProductQuery, indexes.searchProducts);

    var getOfferRequest = indexes.getMiddleware.bind(null, offeringGetParams, createOfferQuery, indexes.searchOfferings);


    var methodIndexed = function methodIndexed(req) {
        // I'm gonna feel so bad with this... but I have to use mutability on an input parameter :(
        // The methods change req.apiUrl as needed... Sorry
        return getOfferRequest(req)
			.then(() => getProductRequest(req))
            .then(() => getCatalogRequest(req));
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ validateAllowed ],
        'POST': [ utils.validateLoggedIn, validateCreation ],
        'PATCH': [ utils.validateLoggedIn, validateUpdate ],
        'PUT': [ utils.methodNotAllowed ],
        'DELETE': [ utils.validateLoggedIn, isCategory, validateUpdate]
    };

    var checkPermissions = function (req, callback) {
        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        methodIndexed(req)
            .catch(() => Promise.resolve(req))
            .then(() => { async.series(reqValidators, callback);});
    };

    var executePostValidation = function(req, callback) {
        // Attach product spec info for product creation request
        var body;

        if (req.method == 'POST' && productsPattern.test(req.apiUrl)) {
            body = JSON.parse(req.body);
            storeClient.attachProduct(body, req.user, middlewareSave(indexes.saveIndexProduct, [body], req.user, callback));

        } else if (req.method == 'POST' && offeringsPattern.test(req.apiUrl)) {
            var catalog = '';
            var indexBody;

            body = JSON.parse(req.body);

            if (req.apiUrl.indexOf('/catalog/') > -1) {
                catalog = req.apiUrl.split('/')[6];
            }

            indexBody = deepcopy(body);
            indexBody.catalog = catalog;
            storeClient.attachOffering(body, req.user, middlewareSave(indexes.saveIndexOffering, [indexBody], req.user, callback));

        } else if ((req.method == 'PATCH' || req.method == 'PUT') && offeringPattern.test(req.apiUrl)) {
            var catalog = req.apiUrl.split('/')[6];
            var indexBody;

            body = JSON.parse(req.body);

            indexBody = deepcopy(body);
            indexBody.catalog = catalog;

            storeClient.updateOffering(body, req.user, middlewareSave(indexes.saveIndexOffering, [indexBody], req.user, callback));

        } else if (req.method == 'POST' && catalogsPattern.test(req.apiUrl)) {
            body = JSON.parse(req.body);
            indexes.saveIndexCatalog([body])
                .then(() => callback(null))
                .catch(() => callback(null));

        } else {
            // TODO PATCHes
            handleIndexes(req, callback);
        }
    };

    var handleAPIError = function (req, callback) {
        if (productsPattern.test(req.apiUrl) && req.method == 'POST') {

            var body = JSON.parse(req.reqBody);

            // Notify the error to the charging backend to remove tha asset
            storeClient.rollbackProduct(req.user, body, () => {
                // No matter rollback status, return API message
                callback(null);
            });
        } else if (productPattern.test(req.apiUrl) && req.method == 'PATCH') {

            // There has been an error updating the product, check if the update was an
            // asset upgrade

            var body = JSON.parse(req.reqBody);
            var getURLId = function(apiUrl) {
                return apiUrl.split('/')[6];
            };

            if (!!body.version && !!body.productSpecCharacteristic) {
                var id = !!body.id ? body.id : getURLId(req.apiUrl);

                // Notify the error to the charging backend to downgrade the asset
                return storeClient.rollbackProductUpgrade(req.user, {
                    id: id,
                    version: body.version,
                    productSpecCharacteristic: body.productSpecCharacteristic
                }, () => {
                    callback(null);
                });
            }

            callback(null);

        }  else {
            callback(null);
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation,
        handleAPIError: handleAPIError
    };

})();

exports.catalog = catalog;
