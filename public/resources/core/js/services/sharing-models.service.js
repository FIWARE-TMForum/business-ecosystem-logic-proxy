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
                appProviderId: User.loggedUser.id,
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
                appProviderId: User.loggedUser.id
            };
            return search(modelsResource, params);
        }

        function searchProviders () {
            return search(providersResource, {});
        }

        function searchTransactions() {
            var params = {
                appProviderId: User.loggedUser.id
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
