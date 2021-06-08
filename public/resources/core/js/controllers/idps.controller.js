/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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


(function() {
    'use strict';

    angular
        .module('app')
        .controller('IdpsSearchCtrl', [
            '$state', '$rootScope', 'PROMISE_STATUS', 'EVENTS', 'IdpsService', 'Utils', IdpsSearchController
        ])
        .controller('IdpsCreateCtrl', [
            '$state', '$rootScope', 'PROMISE_STATUS', 'EVENTS', 'IdpsService', IdpsCreateController
        ])
        .controller('IdpsUpdateCtrl', [
            '$state', '$rootScope', 'PROMISE_STATUS', 'DATA_STATUS', 'EVENTS', 'IdpsService', 'Utils', IdpsUpdateController
        ])

    function IdpsSearchController($state, $rootScope, PROMISE_STATUS, EVENTS, IdpsService, Utils) {
        this.list = [];
        this.STATUS = PROMISE_STATUS;
        this.status = this.STATUS.PENDING;

        IdpsService.getIdps().then((items) => {
            this.list = items;
            this.status = this.STATUS.RESOLVED;
        }, (err) => {
            this.errorMessage = err;
            this.status = this.STATUS.REJECTED;
        });

        this.edit = editIdp;
        this.delete = deleteIdpModal;
        this.deleteIdp = deleteIdp;
        this.toDel = null;

        const vm = this;
        function editIdp(index) {
            $state.go('admin.idps.update', {
                idpId: vm.list[index].idpId
            });
        }

        function deleteIdpModal(index) {
            vm.toDel = index;
            $('#idp-modal').modal('show');
        }

        function deleteIdp() {
            IdpsService.deleteIdp(vm.list[vm.toDel].idpId).then(() => {
                vm.list.splice(vm.toDel, 1);
            }, (response) => {
                const defaultMessage =
                    'There was an unexpected error that prevented the ' + 'system from creating a new IDP';
                const error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

    function IdpsCreateController($state, $rootScope, PROMISE_STATUS, EVENTS, IdpsService) {
        const vm = this;
        this.stepList = [
            {
                title: 'General',
                templateUrl: 'admin/idps/create/general'
            },
            {
                title: 'Finish',
                templateUrl: 'admin/idps/create/finish'
            }
        ];

        this.STATUS = PROMISE_STATUS;
        this.status = null;

        this.data = {};

        this.create = create;

        function create() {
            vm.status = vm.STATUS.PENDING;
            IdpsService.createIdp(vm.data).then(
                () => {
                    vm.status = vm.STATUS.RESOLVED;
                    $state.go('admin.idps.update', {
                        idpId: vm.data.idpId
                    });
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                        resource: 'idps',
                        name: vm.data.name
                    });
                },
                (response) => {
                    vm.status = vm.STATUS.REJECTED;
                    const defaultMessage =
                        'There was an unexpected error that prevented the ' + 'system from creating a new IDP';
                    const error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }
    }

    function IdpsUpdateController($state, $rootScope, PROMISE_STATUS, DATA_STATUS, EVENTS, IdpsService, Utils) {
        const vm = this;

        this.STATUS = PROMISE_STATUS;
        this.DATA_STATUS = DATA_STATUS;

        this.status = this.STATUS.PENDING;
        this.dataStatus = this.DATA_STATUS.LOADED;
        this.data = {};

        IdpsService.getIdp($state.params.idpId).then((idp) => {
            this.status = this.STATUS.RESOLVED;
            this.data = idp;
        }, (response) => {
            this.status = this.STATUS.REJECTED;
            this.errorMessage = Utils.parseError(response, 'The requested IDP could not be retrieved');
        });

        this.update = update;

        function update() {
            vm.dataStatus = vm.DATA_STATUS.LOADING;
            IdpsService.updateIdp(vm.data.idpId, vm.data).then(() => {
                vm.dataStatus = vm.DATA_STATUS.LOADED;
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'IDP',
                    name: vm.data.idpId
                });
            }, (response) => {
                vm.dataStatus = vm.DATA_STATUS.ERROR;
                const defaultMessage =
                    'There was an unexpected error that prevented the ' + 'system from updating a new IDP';
                const error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

})();