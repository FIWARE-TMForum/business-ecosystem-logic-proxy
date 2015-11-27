/**
 * Created by francisco on 26/11/15.
 */


angular.module('app.services')
    .factory('Asset', ['$resource', 'URLS', function ($resource, URLS) {

        var Asset, service = {

            create: function create(data, next) {
                return Asset.save(data, function ($resp) {

                    if (next != null) {
                        next($resp);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }
        };

        Asset = $resource(URLS.ASSET);
        return service;
    }]);