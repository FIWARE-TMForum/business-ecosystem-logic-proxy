/**
 *
 */

angular.module('app')
    .constant('EVENTS', {
        FILTERS_SHOW: '$searchFilterShow',
        MESSAGE_SHOW: '$flashMessageShow',
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
    .directive('noImage', function (URLS) {

        var setDefaultImage = function (element) {
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
    })
    .directive('fieldUnique', function ($http, $injector) {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, controller) {

                scope.$watch(attrs.ngModel, function (newValue) {
                    var params = {};

                    if (newValue && $injector.has(attrs.fieldUnique)) {
                        if (attrs.fieldOriginalValue != newValue) {
                            params[attrs.name] = newValue;

                            $injector.get(attrs.fieldUnique).exists(params).then(function (found) {
                                controller.$setValidity('unique', !found);
                            });
                        }
                    }
                });
            }
        };
    });
