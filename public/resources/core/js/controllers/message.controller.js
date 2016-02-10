(function () {

    'use strict';

    angular
        .module('app')
        .controller('MessageCtrl', MessageController);

    function MessageController($rootScope, $element, EVENTS) {

        var vm = this;

        $rootScope.$on(EVENTS.MESSAGE_CREATED, function(type, paypalUrl, closeCallback) {
            vm.paypalUrl = paypalUrl;
            $element.modal('show');
            $element.on('hide.bs.modal', closeCallback);
        });

        $rootScope.$on(EVENTS.MESSAGE_CLOSED, function() {
            $element.modal('hide');
        });
    }

})();