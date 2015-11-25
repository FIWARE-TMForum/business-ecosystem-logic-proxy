/**
 *
 */

angular.module('app.services')
    .factory('Asset', ['$resource', 'URLS', 'User', 'LOGGED_USER', function ($resource, URLS, User, LOGGED_USER) {

        var Asset, service = {
            $collection: [],

            list: function list(next) {

                return Asset.query(null, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }
        };

        Asset = $resource(URLS.ASSET_TYPE, {typeId: '@id'});
        return service;
    }]);