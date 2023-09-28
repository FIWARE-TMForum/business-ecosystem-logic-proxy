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

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function() {
    'use strict';

    angular
        .module('app')
        .factory('InventoryProduct', ['$q', '$resource', 'URLS', 'User', 'Offering', InventoryProductService]);

    function InventoryProductService($q, $resource, URLS, User, Offering) {
        var resource = $resource(URLS.INVENTORY + '/product/:productId', {
            productId: '@id'
        });

        return {
            search: search,
            count: count,
            detail: detail,
            renew: renew,
            remove: remove,
            getToken: getToken,
            setToken: setToken,
            getSla: getSla,
            setRating : setRating,
            getOwnRating : getOwnRating
        };

        function query(deferred, filters, method, callback) {
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.customer) {
                params['relatedParty.id'] = User.loggedUser.currentUser.partyId;
            }

            if (filters.status) {
                params['status'] = filters.status;
            }

            if (filters.action) {
                params['action'] = filters.action;
            }

            if (filters.offset !== undefined) {
                params['offset'] = filters.offset;
                params['limit'] = filters.limit;
            }

            if (filters.body !== undefined) {
                params['body'] = filters.body.replace(/\s/g, ',');
            }

            method(params, callback, function(response) {
                deferred.reject(response);
            });
        }

        function search(filters) {
            var deferred = $q.defer();

            query(deferred, filters, resource.query, function(productList) {
                if (productList.length) {
                    // Include offering with the product
                    var completeList = angular.copy(productList);
                    attachOfferingInfo(deferred, productList, completeList);
                } else {
                    deferred.resolve(productList);
                }
            });

            return deferred.promise;

            function attachOfferingInfo(deferred, productList, completeList) {
                // Get element to process
                var item = productList.shift();

                // Get offering info
                Offering.detail(item.productOffering.id).then(
                    function(offeringInfo) {
                        // Append offering information
                        completeList[completeList.length - productList.length - 1].productOffering = offeringInfo;

                        // If there are not more elements to process, return the product list
                        if (!productList.length) {
                            deferred.resolve(completeList);
                        } else {
                            // Process the rest of the list
                            attachOfferingInfo(deferred, productList, completeList);
                        }
                    },
                    function(response) {
                        deferred.reject(response);
                    }
                );
            }
        }

        function count(filters) {
            var deferred = $q.defer();

            filters.action = 'count';
            query(deferred, filters, resource.get, function(info) {
                deferred.resolve(info);
            });

            return deferred.promise;
        }

        function detail(productId) {
            var deferred = $q.defer();
            var params = {
                productId: productId
            };

            resource.get(
                params,
                function(productRetrieved) {
                    if (
                        productRetrieved.productCharacteristic.length === 1 &&
                        Object.keys(productRetrieved.productCharacteristic[0]).length === 0
                    ) {
                        productRetrieved.productCharacteristic = [];
                    }

                    extendProductOffering(productRetrieved);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;

            function extendProductOffering(productRetrieved) {
                Offering.detail(productRetrieved.productOffering.id).then(
                    function(productOfferingRetrieved) {
                        productRetrieved.productOffering = productOfferingRetrieved;
                        deferred.resolve(productRetrieved);
                    },
                    function(response) {
                        deferred.reject(response);
                    }
                );
            }
        }

        function processProductJob(url, data) {
            var renewResource = $resource(url);
            var deferred = $q.defer();

            renewResource.save(
                data,
                function(renewJob, getResponseHeaders) {
                    deferred.resolve({
                        headers: getResponseHeaders()
                    });
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function remove(data) {
            return processProductJob(URLS.UNSUBSCRIBE_JOB, data)
        }

        function renew(data) {
            return processProductJob(URLS.RENEW_JOB, data)
        }

        function getToken(data) {
            var tokenResource = $resource(URLS.TOKEN_GET);
            var deferred = $q.defer();

            tokenResource.save(data, function(res, getResponseHeaders) {
                deferred.resolve(res, {headers: getResponseHeaders()});
            }, function (response) {
                deferred.reject(response);
            });
            
            return deferred.promise;
        
        }
        
        function setToken(data) {
            var tokenResource = $resource(URLS.TOKEN_SET);
            var deferred = $q.defer();

            tokenResource.save(data, function(res, getResponseHeaders) {
                deferred.resolve(res, {headers: getResponseHeaders()});
            }, function (response) {
                deferred.reject(response);
            });
            
            return deferred.promise;
        
        }

        function getSla(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };
            var sla = {};
            var slaResource = $resource(URLS.SLA_GET);
            slaResource.get(params, function (collection) {
                sla = collection;
                sla.metrics = sla.services;
                deferred.resolve(sla);
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }

        function setRating(data) {
            var ratingResource = $resource(URLS.REPUTATION_SET);
            var deferred = $q.defer();

            ratingResource.save(data, function(res, getResponseHeaders) {
                deferred.resolve(res, {headers: getResponseHeaders()});
            }, function (response) {
                deferred.reject(response);
            });
            
            return deferred.promise;
        
        }

        function getOwnRating(id, user) {
            var deferred = $q.defer();
            var params = {
                id: id,
                consumerId: user
            };
            //var rating = {};
            var ratingResource = $resource(URLS.REPUTATION_GET);
            ratingResource.get(params, function (collection) {
                var rating = 0;
                if(collection.rate){
                    rating = JSON.parse(collection.rate);
                } 
                deferred.resolve(rating);
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }
    }
})();
