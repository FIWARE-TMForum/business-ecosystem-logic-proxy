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
            'DATA_STATUS',
            'ResourceSpec',
            'Utils',
            'EVENTS',
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

    function ResourceSpecCreateController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ResourceSpec, Utils, EVENTS) {
        this.STATUS = DATA_STATUS
        this.status = this.STATUS.LOADED

        this.stepList = [
            {
                title: 'General',
                templateUrl: 'stock/resource-spec/create/general'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/resource-spec/create/finish'
            }
        ];

        this.data = ResourceSpec.buildInitialData()

        this.create = () => {
            // Create resource specifications
            this.status = DATA_STATUS.PENDING
            ResourceSpec.createResourceSpec(this.data).then((spec) => {
                this.status = this.STATUS.LOADED

                $state.go('stock.resource.update', {
                    resourceId: spec.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'resource spec',
                    name: spec.name
                });
            }).catch((response) => {
                this.status = this.STATUS.LOADED
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the resource specification.')
                });
            })
        }
    }

    function ResourceSpecUpdateController($scope, $state, $rootScope, LIFECYCLE_STATUS) {
    }
})();