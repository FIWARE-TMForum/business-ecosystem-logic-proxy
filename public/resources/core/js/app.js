/**
 *
 */

angular.module('app')
    .constant('EVENTS', {
        PRODUCT_CREATE: '$productCreate',
        PRODUCT_CREATEFORM_SHOW: '$productCreateFormShow',
        PRODUCT_UPDATEFORM_SHOW: '$productUpdateFormShow',
        OFFERING_CREATE: '$offeringCreate',
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
    .directive('fileModel', ['$parse', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                var fileSetter = $parse(attrs.fileModel).assign;
                element.on('change', function() {
                    scope.$apply(function() {
                        fileSetter(scope, element[0].files[0]);
                    });
                });
            }
        }
    }]);

angular.module('app.services', []);
angular.module('app.controllers', []);
