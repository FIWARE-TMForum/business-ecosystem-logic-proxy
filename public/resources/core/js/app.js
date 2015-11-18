/**
 *
 */

angular.module('app')
    .constant('EVENTS', {
        PRODUCT_CREATE: '$productCreate',
        PRODUCT_CREATEFORM_SHOW: '$productCreateFormShow',
        PRODUCT_UPDATEFORM_SHOW: '$productUpdateFormShow',
        CATALOGUE_SHOW: '$catalogueShow',
        CATALOGUE_SELECT: '$catalogueSelect',
        CATALOGUE_CREATEFORM_SHOW: '$catalogueCreateFormShow',
        CATALOGUE_UPDATEFORM_SHOW: '$catalogueUpdateFormShow',
        CATEGORY_SHOW: '$categoryShow',
        CATEGORY_SELECT: '$categorySelect',
        MESSAGE_SHOW: '$messageShow'
    })
    .directive('bsTooltip', function () {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.tooltip();
            }
        };
    })
    .config(['$httpProvider', 'LOGGED_USER', function ($httpProvider, LOGGED_USER) {
        $httpProvider.defaults.headers.common['AUTHORIZATION'] = LOGGED_USER.BEARER_TOKEN;
    }]);

angular.module('app.services', []);
angular.module('app.controllers', []);
