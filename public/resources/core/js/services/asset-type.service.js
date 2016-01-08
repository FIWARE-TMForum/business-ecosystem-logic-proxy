/**
 *
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('AssetType', AssetTypeService);

    function AssetTypeService($q, $resource, URLS) {
        var resource = $resource(URLS.ASSET_MANAGEMENT + '/assetTypes/:typeId', {
            'typeId': '@id'
        });

        return {
            'search': search
        };

        function search() {
            var deferred = $q.defer();
            var params = {};

            resource.query(params, function (typeList) {
                deferred.resolve(typeList);
            });

            return deferred.promise;
        }
    }

})();
