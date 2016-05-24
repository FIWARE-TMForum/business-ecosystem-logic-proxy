/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .filter('status', statusFilter)
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
