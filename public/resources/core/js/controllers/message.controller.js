(function () {

    'use strict';

    angular
        .module('app')
        .controller('MessageCtrl', MessageController);

    function MessageController($rootScope, $element, EVENTS) {

        var vm = this;

        $rootScope.$on(EVENTS.MESSAGE_CREATED, function(type, paypalUrl) {
            vm.paypalUrl = paypalUrl;
            $element.modal('show');
        });

        $rootScope.$on(EVENTS.MESSAGE_CLOSED, function() {
            $element.modal('hide');
        });
    }

})();