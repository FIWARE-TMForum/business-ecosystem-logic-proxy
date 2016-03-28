/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .controller('ContactMediumCreateCtrl', ContactMediumCreateController)
        .controller('ContactMediumUpdateCtrl', ContactMediumUpdateController);

    function ContactMediumCreateController($state, $scope, $rootScope, EVENTS, COUNTRIES, Individual) {
        /* jshint validthis: true */
        var vm = this;

        var emailAddress = {
            emailAddress: ''
        };

        var telephoneNumber = {
            type: '',
            number: ''
        };

        var postalAddress = {
            streetOne: '',
            postcode: '',
            city: '',
            country: '',
            stateOrProvince: ''
        };

        $scope.MEDIUM_TYPES = Individual.MEDIUM_TYPES;
        $scope.COUNTRIES = COUNTRIES;

        vm.data = {
            preferred: false,
            type: Individual.MEDIUM_TYPES.EMAIL_ADDRESS,
            medium: angular.copy(emailAddress)
        };
        vm.create = create;
        vm.refresh = refresh;

        function create() {
            $rootScope.$broadcast(EVENTS.CONTACT_MEDIUM_CREATED, angular.copy(vm.data));
            refresh();
        }

        function refresh() {

            switch (vm.data.type) {
            case Individual.MEDIUM_TYPES.EMAIL_ADDRESS:
                vm.data.medium = angular.copy(emailAddress);
                break;
            case Individual.MEDIUM_TYPES.TELEPHONE_NUMBER:
                vm.data.medium = angular.copy(telephoneNumber);
                break;
            case Individual.MEDIUM_TYPES.POSTAL_ADDRESS:
                vm.data.medium = angular.copy(postalAddress);
                break;
            }
        }
    }

    function ContactMediumUpdateController($element, $scope, $rootScope, EVENTS, COUNTRIES, Individual) {
        /* jshint validthis: true */
        var vm = this;

        $scope.MEDIUM_TYPES = Individual.MEDIUM_TYPES;
        $scope.COUNTRIES = COUNTRIES;

        vm.data = null;
        vm.update = update;

        $scope.$on(EVENTS.CONTACT_MEDIUM_UPDATE, function (event, contactMedium) {
            vm.item = contactMedium;
            vm.data = angular.copy(contactMedium);

            if (contactMedium.medium.number != null && typeof contactMedium.medium.number !== 'number') {
                vm.data.medium.number = parseInt(contactMedium.medium.number);
            }

            if (contactMedium.medium.postcode != null && typeof contactMedium.medium.postcode !== 'number') {
                vm.data.medium.postcode = parseInt(contactMedium.medium.postcode);
            }

            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(EVENTS.CONTACT_MEDIUM_UPDATED, angular.merge(vm.item, vm.data));
            vm.data = null;
        }
    }

})();
