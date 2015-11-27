/**
 *
 */

angular.module('app.services')
    .factory('AssetType', ['$resource', 'URLS', function ($resource, URLS) {

        var AssetType, service = {
            $collection: [],

            list: function list(next) {

                return AssetType.query(null, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }
        };

        AssetType = $resource(URLS.ASSET_TYPE, {typeId: '@id'});
        return service;
    }]);
