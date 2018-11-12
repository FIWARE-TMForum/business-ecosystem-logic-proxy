/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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
        .filter('status', statusFilter)
        .filter('isBundle', isBundleFilter)
        .filter('capitalize', capitalizeFilter)
        .filter('orderByParentId', orderByParentId)
        .filter('trusted', ['$sce', trustedURL]);

    function capitalizeFilter() {
        return function (input) {
            return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
        }
    }

    function statusFilter() {
        return function (list) {
            var statusList = Array.prototype.slice.call(arguments, 1);

            return list.filter(function (element) {
                return statusList.indexOf(element.lifecycleStatus) !== -1;
            });
        };
    }

    function isBundleFilter() {
        return function(list) {
            var state = Array.prototype.slice.call(arguments, 1)[0];

            return list.filter(function(element) {
                return element.isBundle === state;
            })
        }
    }

    function orderByParentId() {
        return function (list) {
            var unorderedList = list.slice(),
                orderedList = [];

            // Start adding the real roots.
            addNextLevel(null, isRoot);

            return orderedList;

            function addNextLevel(parentId, levelFilter) {
                var roots = [];

                // Find the new roots.
                for (var i = unorderedList.length - 1; i >= 0; i--) {
                    if (levelFilter(unorderedList[i], parentId)) {
                        // Add the root at the beginning to keep the current
                        // order.
                        roots.unshift(unorderedList[i]);
                        // Remove the root from the unordered list.
                        unorderedList.splice(i, 1);
                    }
                }

                roots.forEach(function (root) {
                    // Add the root to ordered list.
                    orderedList.push(root);
                    // Next, add the root children.
                    addNextLevel(root.id, hasParentId);
                });
            }

            function isRoot(item) {
                return item.isRoot;
            }

            function hasParentId(item, parentId) {
                return item.parentId === parentId;
            }
        }
    }

    function trustedURL($sce) {
        return function(url) {
            return $sce.trustAsResourceUrl(url);
        };
    }

})();
