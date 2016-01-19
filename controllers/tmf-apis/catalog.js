var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    storeClient = require('./../../lib/store').storeClient,
    url = require('url'),
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger('Root');

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

    var retrieveAsset = function(assetPath, errMsg, callback) {

        var options = {
            host: config.appHost,
            port: config.endpoints.catalog.port,
            path: assetPath,
            method: 'GET',
            headers: {'accept': 'application/json'}
        };

        var protocol = config.appSsl ? 'https' : 'http';

        http.request(protocol, options, null, function(err, result) {
            if (err) {

                callback({
                    status: 400,
                    message: errMsg
                })
            } else {
                callback(null, result);
            }
        });

    };

    // Retrieves the product belonging to a given offering
    var retrieveProduct = function(offeringInfo, callback) {

        var productUrl = offeringInfo.productSpecification.href;
        var productPath = url.parse(productUrl).pathname;
        var errMsg = 'The product attached to the offering cannot be read';

        retrieveAsset(productPath, errMsg, callback);
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

                            var messageError = 'The catalog attached to the offering cannot be read';

                            // Retrieve the catalog
                            var catalogPath = catalogPathFromOfferingUrl(offeringPath);

                            retrieveAsset(catalogPath, messageError, function (err, result) {

                                if (err) {
                                    callback(err);
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

        var body;

        // The request body may not be well formed
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON document'
            });

            return; // EXIT
        }

        // Check that the user has the seller role or is an admin
        if (!tmfUtils.checkRole(req.user, config.oauth2.roles.seller) && !
                tmfUtils.checkRole(req.user, config.oauth2.roles.admin)) {

            callback({
                status: 403,
                message: 'You are not authorized to create resources'
            });

            return; // EXIT
        }

        if (req.apiPath.indexOf('productOffering') > -1) {

            validateOffering(req.user, req.apiPath, null, body, callback);

        } else if (req.apiPath.indexOf('productSpecification') > -1) {

            // Check that the product specification contains a valid product
            // according to the charging backed
            storeClient.validateProduct(body, req.user, function(err) {
               if (err) {
                   callback(err);
               } else {
                   createHandler(req.user, body, callback);
               }
            });
        } else {
            createHandler(req.user, body, callback);
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

            retrieveAsset(offeringsPath, 'Attached offerings cannot be retrieved', function(err, result) {

                if (err) {

                    callback(err);

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

        // Retrieve the resource to be updated or removed
        var errorMessage = 'The TMForum APIs fails to retrieve the object you are trying to update/delete';
        retrieveAsset(req.apiPath, errorMessage, function(err, result) {

            if (err) {
                callback(err, result);
            } else {

                try {

                    var parsedBody = emptyObject(req.body) ? null : JSON.parse(req.body);
                    var previousBody = JSON.parse(result.body);

                    if (offeringsPattern.test(req.apiPath)) {

                        validateOffering(req.user, req.apiPath, previousBody, parsedBody, callback);

                    } else {

                        if (tmfUtils.isOwner(req.user, previousBody)) {

                            if (catalogsPattern.test(req.apiPath)) {

                                // Retrieve all the offerings contained in the catalog
                                var slash = req.apiPath.endsWith('/') ? '' : '/';
                                var offeringsInCatalogPath = req.apiPath + slash + 'productOffering';

                                validateInvolvedOfferingsState('catalog', parsedBody, offeringsInCatalogPath, callback);

                            } else if (productsPattern.test(req.apiPath)) {

                                var url = req.apiPath;

                                if (url.endsWith('/')) {
                                    url = url.slice(0, -1);
                                }

                                var urlParts = url.split('/');
                                var productId = urlParts[urlParts.length - 1];

                                var productSpecificationPos = req.apiPath.indexOf('/productSpecification');
                                var baseUrl = req.apiPath.substring(0, productSpecificationPos);

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

                } catch (e) {

                    callback({
                        status: 400,
                        message: 'The provided body is not a valid JSON'
                    });
                }
            }
        });
    };


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ validateAllowed ],
        'POST': [ tmfUtils.validateLoggedIn, validateCreation ],
        'PATCH': [ tmfUtils.validateLoggedIn, validateUpdate ],
        'PUT': [ tmfUtils.validateLoggedIn, validateUpdate ],
        'DELETE': [ tmfUtils.validateLoggedIn, validateUpdate ]
    };

    var checkPermissions = function (req, callback) {
        log.info('Checking Catalog permissions');

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
