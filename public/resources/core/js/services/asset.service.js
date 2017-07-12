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
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Asset', AssetService);

    function AssetService($q, $resource, URLS) {
        var resource = $resource(URLS.ASSET_MANAGEMENT + '/assets/uploadJob');
        var upgradeResource = $resource(URLS.ASSET_MANAGEMENT + '/assets/:assetId/upgradeJob', {
            assetId: '@id'
        });
        var productAssetResource = $resource(URLS.ASSET_MANAGEMENT + '/assets/product/:productId', {
            productId: '@id'
        });

        return {
            searchByProduct: searchByProduct,
            registerAsset: registerAsset,
            upgradeRegisteredAsset: upgradeRegisteredAsset,
            uploadAsset: uploadAsset,
            upgradeAsset: upgradeAsset
        };

        function searchByProduct(productId) {
            var deferred = $q.defer();

            productAssetResource.query({
                productId: productId
            }, (assets) => {
                deferred.resolve(assets);
            }, (err) => {
                deferred.reject(err);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();

            resource.save(data, function (response) {
                deferred.resolve(response);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function upgrade(assetId, data) {
            var deferred = $q.defer();

            upgradeResource.save({
                assetId: assetId
            }, data, function (response) {
                deferred.resolve(response);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function register(url, assetType, contentType, meta, method, callback, errCallback) {
            var data = {
                resourceType: assetType,
                content: url,
                contentType: contentType
            };

            if (meta !== null) {
                data.metadata = meta;
            }
            method(data).then(callback, errCallback);
        }

        function registerAsset(url, assetType, contentType, meta, callback, errCallback) {
            register(url, assetType, contentType, meta, create, callback, errCallback)
        }

        function upgradeRegisteredAsset(url, assetType, contentType, meta, callback, errCallback, assetId) {
            register(url, assetType, contentType, meta, upgrade.bind(this, assetId), callback, errCallback)
        }

        function upload(file, scope, assetType, contentType, publicFile, meta, method, callback, errCallback) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var data = {
                    content: {
                        name: scope + '__' + file.name,
                        data: btoa(e.target.result)
                    },
                    contentType: contentType
                };

                if (publicFile) {
                    data.isPublic = true;
                } else {
                    data.resourceType = assetType;
                }
                if (meta !== null) {
                    data.metadata = meta;
                }

                method(data).then(callback, errCallback);
            };
            reader.readAsBinaryString(file);
        }

        function uploadAsset(file, scope, assetType, contentType, publicFile, meta, callback, errCallback) {
            upload(file, scope, assetType, contentType, publicFile, meta, create, callback, errCallback);
        }

        function upgradeAsset(file, scope, assetType, contentType, publicFile, meta, callback, errCallback, assetId) {
            upload(file, scope, assetType, contentType, publicFile, meta, upgrade.bind(this, assetId), callback, errCallback);
        }
    }

})();
