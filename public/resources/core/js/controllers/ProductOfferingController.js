/**
 *
 */

angular.module('app.controllers')
    .controller('OfferingListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Offering', function ($scope, $rootScope, EVENTS, Offering) {

        $scope.$offeringList = Offering.$collection;

        $scope.$offeringTypeList = Offering.TYPES;
        $scope.$offeringStatusList = Offering.STATUS;

        $scope.filters = {
            type: "",
            status: ""
        };

        $scope.getPicture = function getPicture($offering) {
            var i, src = "";

            if ('attachment' in $offering.productSpecification) {
                for (i = 0; i < $offering.productSpecification.attachment.length && !src.length; i++) {
                    if ($offering.productSpecification.attachment[i].type == 'Picture') {
                        src = $offering.productSpecification.attachment[i].url;
                    }
                }
            }

            return src;
        };

        $scope.filterList = function filterList() {
            Offering.filter($scope.filters, function ($offeringList) {});
        };
    }])
    .controller('OfferingView', ['$scope', '$rootScope', 'Offering', 'User', 'EVENTS', function ($scope, $rootScope, Offering, User, EVENTS) {

        $scope.createFormHidden = true;

        $scope.changeView = function changeView() {
            $scope.createFormHidden = !$scope.createFormHidden;
        };

        $scope.$on(EVENTS.OFFERING_CREATE, function ($event, $offering) {
            $scope.changeView();
        });

        Offering.list(User.ROLES.SELLER, function ($offeringList) {});
    }]);
