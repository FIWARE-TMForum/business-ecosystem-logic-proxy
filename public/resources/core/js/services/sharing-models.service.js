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

    function RSSService($q, $resource, URLS, User) {
        var modelsResource = $resource(URLS.SHARING_MODELS, {}, {
            update: {
                method: 'PUT'
            }
        });

        var providersResource = $resource(URLS.SHARING_PROVIDERS, {}, {});

        return {
            searchModels: searchModels,
            createModel: createModel,
            searchProviders: searchProviders
        };

        function searchModels () {
            var deferred = $q.defer();
            var params = {
                providerId: User.loggedUser.id
            };

            modelsResource.query(params, function(modelsList) {
                deferred.resolve(modelsList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function createModel (model) {
            var deferred = $q.defer();
            modelsResource.save({}, model, function(modelCreated){
                deferred.resolve(modelCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function searchProviders () {
            var deferred = $q.defer();

            providersResource.query({}, function(providersList) {
                deferred.resolve(providersList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }
})();
