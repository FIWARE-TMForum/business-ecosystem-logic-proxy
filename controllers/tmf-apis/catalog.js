var async = require('async'),
    config = require('./../../config'),
    equal = require('deep-equal'),
    request = require('request'),
    storeClient = require('./../../lib/store').storeClient,
    url = require('url'),
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils');

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

    var retrieveAsset = function(assetPath, callback) {

        var uri = utils.getAPIURL(config.appSsl, config.appHost, config.endpoints.catalog.port, assetPath);

        request(uri, function(err, response, body) {

            if (err || response.statusCode >= 400) {
                callback({
                    status: response.statusCode ? response.statusCode : 500
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
    var retrieveProduct = function(offeringInfo, callback) {

        var productUrl = offeringInfo.productSpecification.href;
        var productPath = url.parse(productUrl).pathname;

        retrieveAsset(productPath, function(err, response) {
            if (err) {
                callback({
                    status: 500,
                    message: 'The product attached to the offering cannot be read'
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
        callback();
    };

    var catalogPathFromOfferingUrl = function(offeringUrl) {
        var productOfferingPos = offeringUrl.indexOf('/productOffering');
        return url.parse(offeringUrl.substring(0, productOfferingPos)).pathname;
    };

    var validateOffering = function(user, offeringPath, previousBody, newBody, callback) {

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

        // When updating an offering, it must be checked that the productSpecification field is not modified
        if (newBody && previousBody && newBody.productSpecification &&
                !equal(newBody.productSpecification, previousBody.productSpecification)) {

            return callback({
                status: 403,
                message: 'Field productSpecification cannot be modified'
            });
        }

        // Check that the product attached to the offering is owned by the same user
        retrieveProduct(previousBody || newBody, function(err, result) {

            if (err) {
                callback(err);
            } else {

                var product = JSON.parse(result.body);

                // Check that the user is the owner of the product
                if (tmfUtils.isOwner(user, product)) {

                    // States are only checked when the offering is being created
                    // or when the offering is being launched

                    if (validStates !== null) {

                        // Check that the product is in an appropriate state
                        if (checkAssetStatus(product, validStates)) {

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
                                        callback();
                                    } else {
                                        callback({
                                            status: 400,
                                            message: errorMessageStateCatalog
                                        });
                                    }
                                }
                            });

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
                        callback();
                    }

                } else {

                    callback({
                        status: 403,
                        message: 'You are not allowed to create offerings for products you do not own'
                    });
                }
            }
        });
    };

    var validateCategory = function(updatedCategory, oldCategory, user, action, callback) {

        // Categories can only be created by administrators
        if (!utils.hasRole(user, config.oauth2.roles.admin)) {

            callback({
                status: 403,
                message: 'Only administrators can ' + action + ' categories'
            });
        } else {

            if (updatedCategory) {

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
                    callback();
                }

            } else {
                callback();
            }
        }
    };


    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////// CREATION //////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var createHandler = function(userInfo, resp, callback) {
        if (tmfUtils.isOwner(userInfo, resp)) {
            callback();
        } else {
            callback({
                status: 403,
                message: 'The user making the request and the specified owner are not the same user'
            });
        }
    };

    // Validate the creation of a resource
    var validateCreation = function(req, callback) {

        var offeringsPattern = new RegExp('/productOffering/?$');
        var productsPattern = new RegExp('/productSpecification/?$');
        var categoriesPattern = new RegExp('/category/?$');

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

            validateCategory(body, null, req.user, 'create', callback);

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

                validateOffering(req.user, req.apiUrl, null, body, function (err) {

                    if (err) {
                        callback(err);
                    } else {
                        storeClient.validateOffering(body, req.user, function (err) {
                            if (err) {
                                callback(err);
                            } else {
                                callback();
                            }
                        });
                    }

                });
            } else if (productsPattern.test(req.apiUrl)) {

                // Check that the product specification contains a valid product
                // according to the charging backed
                storeClient.validateProduct(body, req.user, function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        createHandler(req.user, body, callback);
                    }
                });
            } else {
                createHandler(req.user, body, callback);
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
                        callback();
                    } else {
                        callback({
                            status: 400,
                            message: validatedStates[newLifeCycle]['errorMsg']
                        });
                    }
                }
            });

        } else {
            callback();
        }

    };

    // Validate the modification of a resource
    var validateUpdate = function(req, callback) {

        function emptyObject(object) {

            if (!object) {
                return true;
            }

            return !Object.keys(object).length;
        }

        var catalogsPattern = new RegExp('/catalog/[^/]+/?$');
        var offeringsPattern = new RegExp('/catalog/[^/]+/productOffering/[^/]+/?$');
        var productsPattern = new RegExp('/productSpecification/[^/]+/?$');
        var categoriesPattern = new RegExp('/category/[^/]+/?$');

        try {

            var parsedBody = emptyObject(req.body) ? null : JSON.parse(req.body);

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

                    if (categoriesPattern.test(req.apiUrl)) {

                        validateCategory(parsedBody, previousBody, req.user, 'modify', callback);

                    } else if (offeringsPattern.test(req.apiUrl)) {

                        validateOffering(req.user, req.apiUrl, previousBody, parsedBody, callback);

                    } else {

                        if (tmfUtils.isOwner(req.user, previousBody)) {

                            if (catalogsPattern.test(req.apiUrl)) {

                                // Retrieve all the offerings contained in the catalog
                                var slash = req.apiUrl.endsWith('/') ? '' : '/';
                                var offeringsInCatalogPath = req.apiUrl + slash + 'productOffering';

                                validateInvolvedOfferingsState('catalog', parsedBody, offeringsInCatalogPath, callback);

                            } else if (productsPattern.test(req.apiUrl)) {

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

                            } else {
                                callback();
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


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ validateAllowed ],
        'POST': [ utils.validateLoggedIn, validateCreation ],
        'PATCH': [ utils.validateLoggedIn, validateUpdate ],
        'PUT': [ utils.validateLoggedIn, validateUpdate ],
        'DELETE': [ utils.validateLoggedIn, validateUpdate ]
    };

    var checkPermissions = function (req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.catalog = catalog;
