/* Copyright (c) 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('PagerController', PagerController);

    function PagerController($scope, Utils) {
        // Load controller to paginate
        var managedCtrl = $scope.vm;

        var currPage = 0;
        var pageSize = $scope.pageSize;
        var maxPages = $scope.max;
        var pages = [];
        var nPages = 0;

        managedCtrl.size = pageSize;

        this.nextPage = nextPage;
        this.prevPage = prevPage;
        this.setPage = setPage;
        this.getNPages = getNPages;
        this.getPages = getPages;
        this.isSelected = isSelected;
        this.prevDisabled = prevDisabled;
        this.nextDisabled = nextDisabled;

        // Create pager event handlers
        function nextPage() {
            if (currPage !== nPages - 1) {
                currPage = currPage + 1;
                managedCtrl.offset = currPage * pageSize;

                if (currPage > pages[pages.length -1].page) {
                    pages.shift();
                    pages.push({
                        page: currPage
                    });
                }
            }
        }

        function prevPage() {
            if (currPage !== 0) {
                currPage = currPage - 1;
                managedCtrl.offset = currPage * pageSize;

                if (currPage < pages[0].page) {
                    pages.pop();
                    pages.unshift({
                        page: currPage
                    });
                }
            }
        }

        function setPage(page) {
            currPage = page;
            managedCtrl.offset = currPage * pageSize;
        }

        function getNPages() {
            return nPages;
        }

        function getPages() {
            return pages;
        }

        function isSelected(page) {
            return currPage == page;
        }

        function prevDisabled() {
            return currPage == 0;
        }

        function nextDisabled() {
            return currPage == nPages - 1;
        }

        managedCtrl.getElementsLength().then(function (response) {
            nPages = Math.ceil(response.size/pageSize);

            var maxP = nPages < maxPages ? nPages : maxPages;
            for (var i = 0; i < maxP; i++) {
                pages.push({
                    page: i
                })
            }
            // Load initial page
            managedCtrl.offset = 0;
        }, function (response) {
            managedCtrl.error = Utils.parseError(response, 'It was impossible to load the list of elements');
            managedCtrl.list.status = 'ERROR';
        });
    }

})();
