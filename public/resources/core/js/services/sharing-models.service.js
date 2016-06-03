/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

(function () {

    'use strict';

    angular
        .module('app')
        .factory('RSS', RSSService);

    function RSSService($q, $resource, $location, URLS, User) {
        var modelsResource = $resource(URLS.SHARING_MODELS, {}, {
            update: {
                method: 'PUT'
            }
        });

        var providersResource = $resource(URLS.SHARING_PROVIDERS, {}, {});
        var transactionResource = $resource(URLS.SHARING_TRANSACTIONS, {}, {});
        var reportResource = $resource(URLS.SHARING_REPORTS, {}, {});
        var settlementResource = $resource(URLS.SHARING_SETTLEMENT, {}, {});

        var EVENTS = {
            REPORT_CREATE: '$reportCreate',
            REPORT_CREATED: '$reportCreated'
        };

        return {
            EVENTS: EVENTS,
            searchModels: searchModels,
            createModel: createModel,
            detailModel: detailModel,
            updateModel: updateModel,
            searchProviders: searchProviders,
            searchTransactions: searchTransactions,
            searchReports: searchReports,
            createReport: createReport
        };

        function createModel (model) {
            var deferred = $q.defer();
            modelsResource.save({}, model, function(modelCreated){
                deferred.resolve(modelCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function updateModel (model) {
            var deferred = $q.defer();
            modelsResource.update({}, model, function(modelUpdated){
                deferred.resolve(modelUpdated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detailModel (productClass) {
            var deferred = $q.defer();

            modelsResource.query({
                providerId: User.loggedUser.id,
                productClass: productClass
            }, function(models) {
                if (models.length) {
                    deferred.resolve(models[0]);
                } else {
                    deferred.reject(404);
                }
            }, function (response) {
                deferred.reject(response);
            });
            return deferred.promise;
        }

        function search(resource, params) {
            var deferred = $q.defer();

            resource.query(params, function(list) {
                deferred.resolve(list);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function searchModels () {
            var params = {
                providerId: User.loggedUser.id
            };
            return search(modelsResource, params);
        }

        function searchProviders () {
            return search(providersResource, {});
        }

        function searchTransactions() {
            var params = {
                providerId: User.loggedUser.id
            };
            return search(transactionResource, params);
        }

        function searchReports() {
            var params = {
                providerId: User.loggedUser.id
            };
            return search(reportResource, params);
        }

        function createReport(report) {
            report.providerId = User.loggedUser.id;
            report.callbackUrl = $location.protocol() + '://' + $location.host() + ':' + $location.port() + '/#/rss/reports';

            return settlementResource.save(report).$promise;
        }
    }
})();
