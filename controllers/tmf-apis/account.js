/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
const logger = require('./../../lib/logger').logger.getLogger('TMF')
const tmfUtils = require('./../../lib/tmfUtils')
const url = require('url')
const utils = require('./../../lib/utils')

const account = (function() {

    var getAccountPath = function(asset) {
        return url.parse(asset.account.href).pathname;
    };

    var getAccountAPIUrl = function(path) {
        return utils.getAPIURL(
            config.endpoints.account.appSsl,
            config.endpoints.account.host,
            config.endpoints.account.port,
            path
        );
    };

    const retrieveAsset = function(path, callback) {
        const uri = getAccountAPIUrl(path);

        axios.get(uri).then((response) => {
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
            callback({
                status: 500
            });
        })
    };

    var isOwner = function(req, asset, notAuthorizedMessage, callback) {
        if ('account' in asset) {
            // Customer Account - The attached customer need to be checked
            var accountPath = getAccountPath(asset);

            retrieveAsset(accountPath, function(err, result) {
                if (err) {
                    callback({
                        status: 500,
                        message: 'The attached account cannot be retrieved'
                    });
                } else {
                    const account = result.body;

                    if (tmfUtils.hasPartyRole(req, [account.relatedParty], 'owner')) {
                        callback(null);
                    } else {
                        callback({
                            status: 403,
                            message: notAuthorizedMessage
                        });
                    }
                }
            });
        } else {
            // Customer - Related party is directly included
            if (tmfUtils.hasPartyRole(req, [asset.relatedParty], 'owner')) {
                callback(null);
            } else {
                callback({
                    status: 403,
                    message: notAuthorizedMessage
                });
            }
        }
    };

    const validators = {
        //GET: [utils.validateLoggedIn, validateRetrieval],
        GET: [utils.validateLoggedIn],
        //POST: [utils.validateLoggedIn, validateCreation, validateAccountAccountNotIncluded],
        POST: [utils.validateLoggedIn],
        //PATCH: [utils.validateLoggedIn, validateUpdateOwner, validateIDNotModified, validateAccountAccountNotIncluded],
        PATCH: [utils.validateLoggedIn],
        // This method is not implemented by this API
        //'PUT': [ utils.validateLoggedIn, validateOwner, validateCreation ],
        DELETE: [utils.validateLoggedIn]
    };

    const checkPermissions = function(req, callback) {
        const pathRegExp = new RegExp(
            '^/' + config.endpoints.account.path + '?(/(.*))?$'
        );

        //req.apiUrl = "/account";

        const apiPath = url.parse(req.apiUrl).pathname;
        const regExpResult = pathRegExp.exec(apiPath);

        console.log("Inicio checkPermissions");
        console.log(config.endpoints.account.path);
        console.log("req.apiUrl");
        console.log(req.apiUrl);
        console.log("apiPath");
        console.log(apiPath);
        console.log("regExpResult");
        console.log(regExpResult);
        console.log("complete request");
        console.log(req.body);
        console.log("Fin checkPermissions");

        if (regExpResult) {
            req.isCollection = regExpResult[3] ? false : true;
            req.isAccount = regExpResult[1] ? true : false;

            if (req.method in validators) {
                try {
                    var reqValidators = [];

                    if (req.body && typeof req.body === 'string') {
                        req.json = JSON.parse(req.body);
                    }

                    for (var i in validators[req.method]) {
                        reqValidators.push(validators[req.method][i].bind(this, req));
                    }

                    console.log("Miramos el json");
                    console.log(req.json);
                    console.log("Fin json");

                    async.series(reqValidators, callback);
                } catch (e) {
                    callback({
                        status: 400,
                        message: 'Invalid body'
                    });
                }
            } else {
                callback({
                    status: 405,
                    message: 'Method not allowed'
                });
            }
        } else {
            callback({
                status: 403,
                message: 'This API feature is not supported yet'
            });
        }
    };

    //No acaba de funcionar poque no hay un calback(null)
    //esto parece que lo hace el 

    /*var executePostValidation = function(proxyRes, callback) {
        // This is not supposed to fail since this method is only called when the request to the
        // actual server is OK!

        console.log("Inicio");
        console.log(proxyRes.body);
        console.log("Final");

        //As veces devolve lista vacía e o parse non é capaz de lelo
        if (proxyRes.length != 0) {
            proxyRes.json = JSON.parse(proxyRes.body)
        } else {
            proxyRes.json = proxyRes.body;
        }

        if (proxyRes.method === 'GET') {
            if (!Array.isArray(proxyRes.json)) {
                isOwner(proxyRes, proxyRes.json, 'Unauthorized to retrieve the given account profile', function(err) {
                    if (err) {
                        var customerAccountsIds = null;

                        if ('customerAccount' in proxyRes.json) {
                            // Resource: Customer
                            customerAccountsIds = proxyRes.json.customerAccount.map(function(item) {
                                return item.id;
                            });
                        } else if ('customer' in proxyRes.json) {
                            // Resource: CustomerAccount
                            customerAccountsIds = [proxyRes.json.id];
                        }

                        if (customerAccountsIds && err.status === 403) {
                            // Billing Addresses can be retrieved by involved sellers
                            checkIsRelatedSeller(proxyRes, customerAccountsIds, callback);
                        } else {
                            callback(err);
                        }
                    } else {
                        callback(null);
                    }
                });
            } else {
                // checkPermissions filters the requests to list customer accounts.
                // checkPermissions ensures that users can only retrieve the list
                // of customer they own.
                callback(null);
            }
        } else if (proxyRes.method === 'POST' && 'customer' in proxyRes.json) {
            attachCustomerAccount(proxyRes, callback);
        } else {
            callback(null);
        }
    };*/

    var executePostValidation = function(proxyRes, callback) {
        callback(null);
    }
    
    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.account = account;
