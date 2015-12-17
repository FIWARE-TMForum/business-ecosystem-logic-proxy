/**
 *
 */

angular.module('app')
    .constant('EVENTS', {
        OFFERING_CREATE: '$offeringCreate',
        CATALOGUE_SHOW: '$catalogueShow',
        CATALOGUE_SELECT: '$catalogueSelect',
        CATALOGUE_CREATEFORM_SHOW: '$catalogueCreateFormShow',
        CATALOGUE_UPDATEFORM_SHOW: '$catalogueUpdateFormShow',
        CATEGORY_SHOW: '$categoryShow',
        CATEGORY_SELECT: '$categorySelect',
        MESSAGE_SHOW: '$messageShow',
        PROFILE_UPDATE: '$profileUpdate',
        ORDER_ADDITION: '$orderAddition'
    })
    .constant('PARTY_ROLES', {
        OWNER: 'Owner',
        SELLER: 'Seller'
    })
    .constant('LIFECYCLE_STATUS', {
        ACTIVE: 'Active',
        LAUNCHED: 'Launched',
        RETIRED: 'Retired',
        OBSOLETE: 'Obsolete'
    })
    .constant('LIFECYCLE_STATUS_LIST', [
        {id: 'ACTIVE', title: 'Active'},
        {id: 'LAUNCHED', title: 'Launched'},
        {id: 'RETIRED', title: 'Retired'},
        {id: 'OBSOLETE', title: 'Obsolete'}
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
    .directive('noImage', ['URLS', function (URLS) {

        var setDefaultImage = function setDefaultImage(element) {
            element.attr('src', URLS.IMAGE + '/default-no-image.png');
        };

        return {
            restrict: 'A',
            link: function link(scope, element, attrs) {

                scope.$watch(function () {
                    return attrs.ngSrc;
                }, function () {

                    if (!attrs.ngSrc) {
                        setDefaultImage(element);
                    }
                });

                element.bind('error', function () {
                    setDefaultImage(element);
                });
            }
        };
    }])
    .directive('fieldUnique', ['$http', '$injector', function ($http, $injector) {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, controller) {
                scope.$watch(attrs.ngModel, function (newValue) {
                    var params = {};

                    if (newValue && $injector.has(attrs.fieldUnique)) {
                        if (attrs.fieldOriginalValue != newValue) {
                            params[attrs.name] = newValue;

                            $injector.get(attrs.fieldUnique).find(params, function ($collection) {
                                controller.$setValidity('unique', !$collection.length);
                            }, false);
                        }
                    }
                });
            }
        };
    }]);

angular.module('app.services', []);
angular.module('app.controllers', []);
