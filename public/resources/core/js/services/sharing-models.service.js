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
        var resource = $resource(URLS.SHARING_MODELS, {}, {
            update: {
                method: 'PUT'
            }
        });

        return {
            search: search
        };

        function search () {
            var deferred = $q.defer();
            var params = {
                providerId: User.loggedUser.id
            };

            resource.query(params, function(modelsList) {
                deferred.resolve(modelsList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }
})();
