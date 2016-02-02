var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    storeClient = require('./../../lib/store').storeClient,
    url = require('url'),
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger('Root'),
    OnBoardingTask = require('../../db/schemas/onBoardingTask');

var onboarding = (function() {

    var apiKey = 'user4-987654';  // TODO: Remove when the RI is available
    var host = 'https://biologeek.orange-labs.fr:443/tmf-api';

    var makeRequest = function(path, data, callback) {
        log.info("Making on boarding request - " + path);

        var completeURL = host + '/' + config.endpoints.onboarding.path + '/' + path;
        var parsedUrl = url.parse(completeURL);

        var options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Content-type': 'application/json'
            }
        };

        log.info(options);
        log.info(completeURL);
        var protocol = parsedUrl.protocol.indexOf('https') >= 0 ? 'https' : 'http';

        http.request(protocol, options, JSON.stringify(data), function(err, result) {
            log.info("Response received");
            if (err) {
                log.info(err);
                callback({
                    status: 400,
                });
            } else {
                callback(err, JSON.parse(result.body));
            }
        });
    };

    var validateRetrieving = function(req, callback) {
        callback();
    };

    var createPartyRole = function(body, roleInfo, partnershipInfo, partyInfo, task) {
        log.info("Processing party role");
        makeRequest('partyRole', {
            status: roleInfo.status,
            name: roleInfo.name,
            type: {
                partnershipId: partnershipInfo.id,
                partnershipHref: partnershipInfo.href,
                partnershipName: partnershipInfo.name,
                name: roleInfo.name
            },
            engagedParty: {
                id: partyInfo.id,
                href: partyInfo.href,
                name: partyInfo.name
            }
        }, function(err) {
            if (err) {
                task.status = 'failed';
                task.description = 'There has been a problem creating a partyRole';
                task.save();
            } else {
                // Continue processing parties
                buildPartyRole(roleInfo, partnershipInfo, task);
            }
        });
    };

    var buildPartyRole = function(body, partnershipInfo, task) {
        log.info("Processing party");
        if (body.partyRole && body.partyRole.length) {
            var element = body.partyRole.pop();

            // Create the engaged party
            if (!element.engagedParty) {
                task.status = 'failed';
                task.description = 'Missing engagedParty field in partyRole element';
                task.save();
                return;
            }

            var partyType = element.engagedParty.type;
            delete element.engagedParty.type

            makeRequest(partyType, element.engagedParty, function(err, resp) {
                if (err) {
                    task.status = 'failed';
                    task.description = 'There have been a problem creating an engagedParty';
                    task.save();
                } else {
                    // Create the partyRole
                    createPartyRole(body, element, partnershipInfo, resp, task);
                }
            });
        } else {
            task.status = 'completed';
            task.save();
        }
    };

    var buildPartnershipType = function(body, roleTypes, task) {
        log.info("Processing partnership type");
        makeRequest('partnershipType', {
            name: body.name,
            roleType: roleTypes
        }, function (err, resp) {
            if(err) {
                task.status = 'failed';
                task.description = "There has been a problem creating the partnershipType";
                task.save()
            } else {
                // If there are parties, process them, otherwise set the task as completed
                buildPartyRole(body, resp, task);
            }
        });
    };

    var buildAgreements = function(body, createdList, task) {
        log.info("Processing agreement");
        if (body.roleType && body.roleType.length) {
            var element = body.roleType.pop();

            if (!element.agreementSpecification) {
                task.status = 'failed';
                task.description = 'Missing a required field agreementSpecification in roleType';
                task.save();
                return;
            }

            // Create the agreement spec
            makeRequest('agreementSpecification', element.agreementSpecification, function(err, resp) {
                if (err) {
                    task.status = 'failed';
                    task.description = 'There has been an unexpected problem creating agreementSpecification';
                    task.save();
                } else {
                    createdList.push({
                        name: element.name,
                        agreementSpecification: {
                            id: resp.id,
                            href: resp.href,
                            name: resp.name
                        }
                    });
                    buildAgreements(body, createdList, task)
                }
            });
        } else {
            // There is not more agreements, create the partnertship type
            buildPartnershipType(body, createdList, task);
        }
    };


    var validateCreation = function(req, callback) {
        var body;
        var task = new OnBoardingTask();

        try{
            body = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The resource is not a valid JSON document'
            });
            return;
        }

        // Check the url in order to determine the task to execute
        if (req.path.endsWith('partnershipJob')) {
            log.info("Creating a partnertshipJob");

            // Build the task
            task.path = 'partnershipJob';
            task.status = 'running';

            task.save(function(err) {
                if (err) {
                    log.warn("Error saving task - " + err.message);
                    if (err.code === 11000) {
                        callback({
                            status: 409,
                            message: 'There is already a task with the specified characteristics'
                        });
                    } else {
                        // other errors
                        callback({
                            status: 500,
                            message: err.message 
                        });
                    }
                } else {
                    log.info("Task saved");
                    task.href = 'http://' + req.headers.host + '/' + config.endpoints.onboarding.path + '/partnertshipJob/' + task._id;
                    // Send response with created task
                    callback({
                        status: 201,
                        body: {
                            id: task._id,
                            href: task.href,
                            status: task.status
                        }
                    });
                    // Start the execution of the task
                    buildAgreements(body, [], task);
                }
            });
        } else if (req.path.endsWith('enrollmentJob')) {
            // Create parties
            // Create party roles
        } else {
            callback({
                status: 404,
                message: 'The specified task does not exists'
            });
        }
    };

    var validators = {
        'GET': [ tmfUtils.validateLoggedIn, validateRetrieving ],
        'POST': [ tmfUtils.validateLoggedIn, validateCreation ],
        'PATCH': [ tmfUtils.methodNotAllowed ],
        'PUT': [ tmfUtils.methodNotAllowed ],
        'DELETE': [ tmfUtils.methodNotAllowed ]
    };

    var checkPermissions = function (req, callback) {
        log.info('Checking on Boarding permissions');
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

exports.onboarding = onboarding;
