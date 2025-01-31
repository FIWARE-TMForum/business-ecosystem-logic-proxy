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
const config = require('./../../config')
const axios = require('axios')
const tmfUtils = require('./../../lib/tmfUtils')
const url = require('url')
const utils = require('./../../lib/utils')

const billing = (function() {

    const validateRetrieving = function(req, callback) {
        callback(null);
    }

    const validators = {
        GET: [utils.validateLoggedIn, validateRetrieving],
        POST: [utils.methodNotAllowed],
        PATCH: [utils.methodNotAllowed],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.methodNotAllowed]
    };

    const checkPermissions = function(req, callback) {
        const reqValidators = [];
    
        for (let i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }
    
        async.series(reqValidators, callback);
    };
    
    const executePostValidation = function(response, callback) {
        callback(null);
    };

    const handleAPIError = function(res, callback) {
        callback(null);
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation,
        handleAPIError: handleAPIError
    }
})();

exports.billing = billing;
