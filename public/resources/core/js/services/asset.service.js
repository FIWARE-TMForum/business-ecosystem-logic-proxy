/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Asset', AssetService);

    function AssetService($q, $resource, URLS) {
        var resource = $resource(URLS.ASSET_MANAGEMENT + '/assets/uploadJob');

        return {
            create: create
        };

        function create(data) {
            var deferred = $q.defer();

            resource.save(data, function (response) {
                deferred.resolve(response);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }

})();
