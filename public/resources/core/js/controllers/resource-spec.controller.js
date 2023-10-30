/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 * 
 * This file belongs to the bbusiness-ecosystem-logic-proxy of the
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

(function() {
    'use strict';

    angular
        .module('app')
        .controller('ResourceSpecSearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            'DATA_STATUS',
            'ResourceSpec',
            'Utils',
            ResourceSpecSearchController
        ])

        .controller('ResourceSpecCreateCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            ResourceSpecCreateController
        ])
        .controller('ResourceSpecUpdateCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            ResourceSpecUpdateController
        ]);

    function ResourceSpecSearchController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ResourceSpec, Utils) {
        this.STATUS = DATA_STATUS
        this.status = DATA_STATUS.LOADING

        this.list = []

        this.getElementsLength = getElementsLength;

        function getElementsLength() {
            return Promise.resolve(10)
        }

        // Get resource specifications
        ResourceSpec.getResouceSpecs().then((resources) => {
            this.list = resources
            this.status = this.STATUS.LOADED
        }).catch((response) => {
            this.errorMessage = Utils.parseError(response, 'It was impossible to load the list of resource specs')
            this.status = this.STATUS.ERROR
        })
    }

    function ResourceSpecCreateController($scope, $state, $rootScope, LIFECYCLE_STATUS) {
    }

    function ResourceSpecUpdateController($scope, $state, $rootScope, LIFECYCLE_STATUS) {
    }
})();