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

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    angular
        .module('app')
        .controller('ResourceSpecSearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
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

    function ResourceSpecSearchController($scope, $state, $rootScope, LIFECYCLE_STATUS) {
    }

    function ResourceSpecCreateController($scope, $state, $rootScope, LIFECYCLE_STATUS) {
    }

    function ResourceSpecUpdateController($scope, $state, $rootScope, LIFECYCLE_STATUS) {
    }
})();