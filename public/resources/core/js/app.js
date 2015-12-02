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
    .constant('LIFECYCLE_STATUS', {
        ACTIVE: 'Active',
        LAUNCHED: 'Launched',
        RETIRED: 'Retired',
        OBSOLETE: 'Obsolete'
    })
    .constant('LIFECYCLE_STATUS_LIST', [
        {id: 'active', title: 'Active'},
        {id: 'launched', title: 'Launched'},
        {id: 'retired', title: 'Retired'},
        {id: 'obsolete', title: 'Obsolete'}
    ])
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
    }])
    .directive('ensureUnique', ['$http', '$injector', function ($http, $injector) {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, controller) {
                scope.$watch(attrs.ngModel, function (newValue) {
                    var params = {};

                    if (newValue && $injector.has(attrs.ensureUnique)) {
                        params[attrs.name] = newValue;
                        $injector.get(attrs.ensureUnique).find(params, function ($collection) {
                            controller.$setValidity('unique', !$collection.length);
                        }, false);
                    }
                });
            }
        };
    }]);

angular.module('app.services', []);
angular.module('app.controllers', []);
