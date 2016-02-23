/**
 * @author Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('UnauthorizedCtrl', UnauthorizedCtrl);

    function UnauthorizedCtrl($window, $stateParams) {
        this.loginLink = 'login?came_from=' + $stateParams['came_from'];
        $window.location.href = this.loginLink;
    }

})();
