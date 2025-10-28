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
const equal = require('deep-equal')
const moment = require('moment')
const storeClient = require('./../../lib/store').storeClient
const tmfUtils = require('./../../lib/tmfUtils')
const url = require('url')
const utils = require('./../../lib/utils')

const ordering = (function() {
    const CUSTOMER = 'Customer';
    const SELLER = 'Seller';

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const makeRequest = function(url, errMsg, callback) {
        axios.get(url).then((response) => {

            callback(null, response.data);
            
        }).catch((err) => {
            callback({
                status: 400,
                message: errMsg
            });
        })
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////// RETRIEVAL //////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validateRetrieving = function(req, callback) {
        tmfUtils.filterRelatedPartyWithRole(req, ['customer', 'seller'], callback);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////// CREATION //////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const includeProductParty = function(offering, item, resolve, reject) {
        const errorMessageProduct = 'The system fails to retrieve the product attached to the ordering item ' + item.id;

        const productUrl = utils.getAPIURL(
            config.endpoints.catalog.appSsl,
            config.endpoints.catalog.host,
            config.endpoints.catalog.port,
            `${config.endpoints.catalog.apiPath}/productSpecification/${offering.productSpecification.id}`
        );

        makeRequest(productUrl, errorMessageProduct, function(err, product) {
            if (err) {
                reject(err);
            } else {
                var owners = product.relatedParty.filter(function(relatedParty) {
                    return relatedParty['role'].toLowerCase() === 'owner';
                });

                if (!owners.length) {
                    reject({
                        status: 400,
                        message: 'You cannot order a product without owners'
                    });
                } else {
                    owners.forEach(function(owner) {
                        item.product.relatedParty.push({
                            id: owner.id,
                            href: owner.id,
                            role: SELLER
                        });
                    });

                    resolve();
                }
            }
        });
    };

    const includeOfferingParty = function(offeringUrl, item, resolve, reject) {
        const errorMessageOffer = 'The system fails to retrieve the offering attached to the ordering item ' + item.id;

        makeRequest(offeringUrl, errorMessageOffer, function(err, offering) {
            if (err) {
                reject(err);
            } else {
                if (!offering.isBundle) {
                    includeProductParty(offering, item, resolve, reject);
                } else {
                    const offeringUrl = utils.getAPIURL(
                        config.endpoints.catalog.appSsl,
                        config.endpoints.catalog.host,
                        config.endpoints.catalog.port,
                        `${config.endpoints.catalog.apiPath}/productOffering/${offering.bundledProductOffering[0].id}`
                    );
                    includeOfferingParty(offeringUrl, item, resolve, reject);
                }
            }
        });
    };

    const completeRelatedPartyInfo = async function(req, item, user) {
        return new Promise((resolve, reject) => {
            if (!item.product) {
                reject({
                    status: 400,
                    message: 'The product order item ' + item.id + ' must contain a product field'
                });

                return;
            }

            if (!item.productOffering) {
                reject({
                    status: 400,
                    message: 'The product order item ' + item.id + ' must contain a productOffering field'
                });

                return;
            }
    
            if (!item.product.relatedParty) {
                item.product.relatedParty = [];
            }

            const itemCustCheck = tmfUtils.isOrderingCustomer(user, item.product);
            if (itemCustCheck[0] && !itemCustCheck[1]) {
                reject({
                    status: 403,
                    message: 'The customer specified in the order item ' + item.id + ' is not the user making the request'
                });
                return;
            }

            if (!itemCustCheck[0]) {
                item.product.relatedParty.push({
                    id: user.partyId,
                    role: CUSTOMER,
                    href: tmfUtils.getIndividualURL(req, user.partyId)
                });
            }

            // Inject customer and seller related parties in the order items in order to make this info
            // available thought the inventory API
            const offeringUrl = utils.getAPIURL(
                config.endpoints.catalog.appSsl,
                config.endpoints.catalog.host,
                config.endpoints.catalog.port,
                `${config.endpoints.catalog.apiPath}/productOffering/${item.productOffering.id}`
            );

            includeOfferingParty(offeringUrl, item, resolve, reject);
        })
    };

    const validateCreation = async function(req, callback) {
        let body;

        // The request body may not be well formed
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            return callback({
                status: 400,
                message: 'The resource is not a valid JSON document'
            });
        }

        // Check that the related party field has been included
        if (!body.relatedParty) {
            return callback({
                status: 400,
                message: 'A product order must contain a relatedParty field'
            });
        }

        // Check that the user has the customer role
        if (config.customerRoleRequired && !utils.hasRole(req.user, config.oauth2.roles.customer)) {
            return callback({
                status: 403,
                message: 'You are not authorized to order products'
            });
        }

        // Check that the user is the specified customer
        const customerCheck = tmfUtils.isOrderingCustomer(req.user, body);
        if (!customerCheck[0]) {
            return callback({
                status: 403,
                message: 'It is required to specify a customer in the relatedParty field'
            });
        }

        if (!customerCheck[1]) {
            return callback({
                status: 403,
                message: 'The customer specified in the product order is not the user making the request'
            });
        }

        if (!body.productOrderItem || !body.productOrderItem.length) {
            return callback({
                status: 400,
                message: 'A product order must contain an productOrderItem field'
            });
        }

        try {
            await Promise.all(body.productOrderItem.map((item) => {
                return completeRelatedPartyInfo(req, item, req.user)
            }))
        } catch (e) {
            console.log(e)
            return callback(e)
        }

        // Include sellers as related party in the ordering
        const pushedSellers = [];
        let customerItem = false;

        body.productOrderItem.forEach(function(item) {
            const sellers = item.product.relatedParty.filter(function(party) {
                return party.role.toLowerCase() === SELLER.toLowerCase();
            });

            sellers.forEach(function(seller) {
                if (seller.id === req.user.partyId) {
                    customerItem = true;
                } else if (pushedSellers.indexOf(seller.id) < 0) {
                    body.relatedParty.push(seller);
                    pushedSellers.push(seller.id);
                }
            });
        });

        if (customerItem) {
            return callback({
                status: 403,
                message: 'You cannot acquire your own offering'
            });
        }

        if (!body.billingAccount || !body.billingAccount.id) {
            return callback({
                status: 422,
                message: 'Billing Account is required'
            });
        }

         const billAccURL = utils.getAPIURL(
                config.endpoints.account.appSsl,
                config.endpoints.account.host,
                config.endpoints.account.port,
                `${config.endpoints.account.apiPath}/billingAccount/${body.billingAccount.id}`)

        let billAcc;

        try {
            const resp = await axios.get(billAccURL);
            billAcc = resp.data;
        } catch (_) {
            return callback({
                status: 422,
                message: 'Invalid billing account id'
            });
        }

        const matches =  billAcc.relatedParty.some(p => p?.id === req.user.partyId)

        if (!billAcc || !matches) {
            return callback({
                status: 422,
                message: 'Cannot find the specified billing account for this user'
            });
        }

        utils.updateBody(req, body)
        callback(null)
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// UPDATE ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const updateItemsState = function(req, updatedOrdering, previousOrdering, includeOtherFields, callback) {
        let error = null;

        for (let i = 0; i < updatedOrdering.productOrderItem.length && !error; i++) {
            let updatedItem = updatedOrdering.productOrderItem[i];
            let previousOrderItem = previousOrdering.productOrderItem.filter((item) => {
                // id is supposed to be unique
                return item.id === updatedItem.id;
            })[0];

            if (!previousOrderItem) {
                error = {
                    status: 400,
                    message: 'You are trying to edit an non-existing item'
                };
            } else {
                // Check that fields are not added or removed
                if ((!!previousOrderItem.state && Object.keys(updatedItem).length !== Object.keys(previousOrderItem).length)
                        || (!previousOrderItem.state && Object.keys(updatedItem).length - 1 !== Object.keys(previousOrderItem).length)) {
                    error = {
                        status: 403,
                        message: 'The fields of an order item cannot be modified'
                    };
                } else {
                    for (let field in previousOrderItem) {
                        if (field.toLowerCase() !== 'state' && !equal(previousOrderItem[field], updatedItem[field])) {
                            error = {
                                status: 403,
                                message: 'The value of the field ' + field + ' cannot be changed'
                            };

                            break;
                        }
                    }

                    if (!error) {
                        const isSeller = tmfUtils.hasPartyRole(req, previousOrderItem.product.relatedParty, SELLER);

                        // If the user is not the seller and the state is changed
                        if (!isSeller && previousOrderItem['state'] != updatedItem['state']) {
                            error = {
                                status: 403,
                                message: 'You cannot modify an order item if you are not seller'
                            };
                        } else {
                            // If no errors, the state can be updated!
                            previousOrderItem['state'] = updatedItem['state'];
                        }
                    }
                }
            }
        }

        if (!error) {
            // Sellers can only modify the 'productOrderItem' field...
            // State is automatically calculated
            let finalBody = includeOtherFields ? updatedOrdering : {};
            finalBody['productOrderItem'] = previousOrdering.productOrderItem;

            // Calculate the new state of the product order
            let state = null;
            let itemStatus = {
                'unchecked': 0,
                'acknowledged': 0,
                'cancelled': 0,
                'completed': 0,
                'inProgress': 0,
                'pending': 0,
                'failed': 0
            }
            let invalidState = false;
            previousOrdering.productOrderItem.forEach((item) => {
                if (item.state && itemStatus[item.state] === undefined){
                   invalidState = true;
                   return;
                }
                else if (item.state) {
                    itemStatus[item.state] += 1;
                } else {
                    itemStatus['unchecked'] += 1;
                }
            })

            if (invalidState) {
                return callback({
                    status: 400,
                    message: 'Bad item state'
                });
            }
            else if (itemStatus.completed === previousOrdering.productOrderItem.length) {
                state = 'completed';
            } else if (itemStatus.cancelled === previousOrdering.productOrderItem.length) {
                state = 'cancelled';
            } else if(itemStatus.failed === previousOrdering.productOrderItem.length) {
                state = 'failed';
            } else if (itemStatus.completed + itemStatus.cancelled + itemStatus.failed === previousOrdering.productOrderItem.length) {
                state = 'partial';
            } else if (itemStatus.inProgress + itemStatus.completed + itemStatus.cancelled +itemStatus.failed > 0 ) {
                state = 'inProgress';
            } else if (itemStatus.acknowledged > 0) {
                state = 'acknowledged';
            }

            finalBody['state'] = state;
            utils.updateBody(req, finalBody);

            callback(null);
        } else {
            callback(error);
        }
    };

    const validateNotes = function(newNotes, prevNotes, callback) {
        // The patch operation to include a note must be an append
        if (!prevNotes || !prevNotes.length) {
            return callback(null);
        }

        for (let i = 0; i < prevNotes.length; i++) {
            let matches = 0;
            let prev = prevNotes[i];

            for (let j = 0; j < newNotes.length; j++) {
                let n = newNotes[j];
                if (prev.text === n.text && prev.date === n.date && prev.author === n.author) {
                    matches++;
                }
            }

            if (matches !== 1) {
                return callback({
                    status: 403,
                    message: 'You are not allowed to modify the existing notes of an order'
                });
            }
        }

        callback(null);
    };

    const validateUpdate = function(req, callback) {
        try {
            const ordering = JSON.parse(req.body);
            const path = req.apiUrl.replace('/ordering', '');
            const orderingUrl = utils.getAPIURL(
                config.endpoints.ordering.appSsl,
                config.endpoints.ordering.host,
                config.endpoints.ordering.port,
                `${config.endpoints.ordering.apiPath}${path}`
            );

            makeRequest(orderingUrl, 'The requested ordering cannot be retrieved', (err, previousOrdering) => {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    const isCustomer = tmfUtils.hasPartyRole(req, previousOrdering.relatedParty, CUSTOMER);
                    const isSeller = tmfUtils.hasPartyRole(req, previousOrdering.relatedParty, SELLER);

                    if (isCustomer) {
                        if ('relatedParty' in ordering) {
                            callback({
                                status: 403,
                                message: 'Related parties cannot be modified'
                            });
                        } else if ('productOrderItem' in ordering) {
                            callback({
                                status: 403,
                                message: 'Order items can only be modified by sellers'
                            });
                        } else if ('state' in ordering) {
                            if (ordering['state'].toLowerCase() !== 'cancelled') {
                                callback({
                                    status: 403,
                                    message: 'Invalid order state. Valid states for customers are: "cancelled"'
                                });
                            } else {
                                // Orderings can only be cancelled when all items are marked as Acknowledged
                                const productsInAckState = previousOrdering.productOrderItem.filter(function(item) {
                                    return 'acknowledged' === item.state.toLowerCase();
                                });

                                if (productsInAckState.length != previousOrdering.productOrderItem.length) {
                                    callback({
                                        status: 403,
                                        message:
                                            'Orderings can only be cancelled when all Order items are in Acknowledged state'
                                    });
                                } else {
                                    // Otherwise, the charges has to be refunded to the user.
                                    // If the sales cannot be refunded, the callback will be called with
                                    // the error parameter so the pre validation will fail and the state
                                    // won't be changed.
                                    storeClient.refund(previousOrdering.id, req.user, function(err) {
                                        if (err) {
                                            callback(err);
                                        } else {
                                            // Cancel all order items
                                            previousOrdering.productOrderItem.forEach(function(item) {
                                                item.state = 'cancelled';
                                            });

                                            // Included order items will be ignored
                                            ordering.productOrderItem = previousOrdering.productOrderItem;
                                            utils.updateBody(req, ordering);

                                            callback(null);
                                        }
                                    });
                                }
                            }
                        } else if ('note' in ordering) {
                            validateNotes(ordering.note, previousOrdering.note, callback);
                        } else {
                            callback(null);
                        }
                    } else if (isSeller) {
                        if (Object.keys(ordering).length == 1 && 'productOrderItem' in ordering) {
                            updateItemsState(req, ordering, previousOrdering, false, callback);
                        } else if (Object.keys(ordering).length == 1 && 'note' in ordering) {
                            validateNotes(ordering.note, previousOrdering.note, callback);
                        } else {
                            callback({
                                status: 403,
                                message: 'Sellers can only modify order items or include notes'
                            });
                        }
                    } else {
                        callback({
                            status: 403,
                            message: 'You are not authorized to modify this order'
                        });
                    }
                }
            });
        } catch (e) {
            callback({
                status: 400,
                message: 'The resource is not a valid JSON document'
            });
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// PRE-VALIDATION ///////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validators = {
        GET: [utils.validateLoggedIn, tmfUtils.ensureRelatedPartyIncluded, validateRetrieving],
        POST: [utils.validateLoggedIn, validateCreation],
        PATCH: [utils.validateLoggedIn, validateUpdate],
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

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// POST-VALIDATION //////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const sortByDate = function sortByDate(list) {
        if (!Array.isArray(list)) {
            return [];
        }

        if (list.length < 2) {
            return list;
        }

        return list.sort(function(a, b) {
            return moment(a.date).isBefore(b.date) ? -1 : 1;
        });
    };

    const filterOrderItems = function(req, callback) {
        const body = req.body;
        let orderings = [];
        let isArray = true;
        
        if (!Array.isArray(body)) {
            orderings = [body];
            isArray = false;
        } else {
            orderings = body;
        }

        // This array is needed as the length of the array cannot be modified while it's being iterated
        const orderingsToRemove = [];
        orderings.forEach(function(ordering) {
            const customer = tmfUtils.hasPartyRole(req, ordering.relatedParty, CUSTOMER);
            const seller = tmfUtils.hasPartyRole(req, ordering.relatedParty, SELLER);

            if (!customer && !seller) {
                // This can happen when a user ask for a specific ordering.
                orderingsToRemove.push(ordering);
            } else if (!customer && seller) {
                // When a user is involved only as a seller in an ordering, only the order items
                // where the user is a seller have to be returned
                ordering.productOrderItem = ordering.productOrderItem.filter(function(item) {
                    return tmfUtils.hasPartyRole(req, item.product.relatedParty, SELLER);
                });
            }
            // ELSE: If the user is the customer, order items don't have to be filtered
            if (req.method.toUpperCase() === 'GET') {
                ordering.note = sortByDate(ordering.note);
            }
        });

        orderings = orderings.filter(function(ordering) {
            return orderingsToRemove.indexOf(ordering) < 0;
        });

        if (!isArray) {
            if (orderings.length === 0) {
                callback({
                    status: 403,
                    message: 'You are not authorized to retrieve the specified ordering'
                });
            } else {
                utils.updateResponseBody(req, orderings[0]);
                callback(null);
            }
        } else {
            orderings.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))

            utils.updateResponseBody(req, orderings);
            callback(null);
        }
    };

    const filterOrders = function(req, callback) {
        const body = req.body

        if (!Array.isArray(body)) {
            return callback(null)
        }

        let role = CUSTOMER

        if (req.query['relatedParty.role'] != null && req.query['relatedParty.role'] == SELLER) {
            role = SELLER
        }

        const orders = body.filter((order) => {
            return tmfUtils.hasPartyRole(req, order.relatedParty, role);
        })

        utils.updateResponseBody(req, orders)
        callback(null)
    }

    const notifyOrderCompleted = function(req, callback) {
        storeClient.notifyOrderCompleted(req.body.id, req.user, (err) => {
            console.log('we got the response')
            if (err) {
                console.log('Error notifying order completion')
            }
            callback(null)
        })
    }

    const notifyOrder = function(req, callback) {
        const body = req.body;

        // Send ordering notification to the store
        storeClient.notifyOrder(body, req.user, function(err, res) {
            if (res) {
                const parsedResp = res.body;
            
                if (parsedResp.redirectUrl) {
                    req.headers['X-Redirect-URL'] = parsedResp.redirectUrl;
                }

                callback(null);
            } else {
                callback(err);
            }
        });
    };

    const executePostValidation = function(req, callback) {
        // TODO: Filter the result of the PATCH request
        if (['GET', 'PUT'].indexOf(req.method.toUpperCase()) >= 0) {
            filterOrderItems(req, (err) => {
                if (req.method.toUpperCase() != 'GET' || err != null) {
                    callback(err)
                } else {
                    // Filter results
                    filterOrders(req, callback)
                }
            });
        } else if (req.method === 'POST') {
            const tasks = [];
            tasks.push(notifyOrder.bind(this, req));
            async.series(tasks, callback);
        } else if (req.method === 'PATCH') {
            if (req.body.state && req.body.state.toLowerCase() === 'completed') {
                console.log('Making the notification call')
                notifyOrderCompleted(req, () => {
                    filterOrderItems(req, callback);
                })
            } else {
                filterOrderItems(req, callback);
            }
        } else {
            callback(null);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.ordering = ordering;
