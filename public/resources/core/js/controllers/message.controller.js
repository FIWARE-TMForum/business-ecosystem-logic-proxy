(function () {

    'use strict';

    angular
        .module('app')
        .controller('MessageCtrl', MessageController);

    function MessageController($rootScope, $element, EVENTS) {
        $rootScope.$on(EVENTS.MESSAGE_CREATED, function() {
            $element.modal('show');
        });

        $rootScope.$on(EVENTS.MESSAGE_CLOSED, function() {
            $element.modal('hide');
        });
    }

})();