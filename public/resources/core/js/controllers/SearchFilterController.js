/**
 *
 */

angular.module('app')
    .controller('SearchFilterListCtrl', function ($scope, $state, $element, EVENTS) {

        $scope.toggleItem = function (name, item) {
            var index = $scope.filterList[name].indexOf(item);

            if (index != -1) {
                $scope.filterList[name].splice(index, 1);
            } else {
                $scope.filterList[name].push(item);
            }
        };

        $element.on('hidden.bs.modal', function (event) {
            $state.go($scope.to, angular.extend({}, $state.params, {
                status: $scope.filterList.status.join()
            }));
        });

        $scope.$on(EVENTS.FILTERS_SHOW, function (event, filterList) {
            $scope.to = $state.current.name;
            $scope.filterList = filterList;
            $element.modal('show');
        });
    });
