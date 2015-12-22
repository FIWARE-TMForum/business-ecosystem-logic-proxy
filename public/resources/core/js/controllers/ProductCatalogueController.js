/**
 *
 */

angular.module('app')
    .controller('CatalogueListCtrl', function ($scope, User, Catalogue) {

        $scope.loading = true;

        Catalogue.list(User.ROLES.CUSTOMER).then(function (catalogueList) {
            $scope.loading = false;
            $scope.catalogueList = catalogueList;
        });
    })
    .controller('CatalogueSearchCtrl', function ($scope, $rootScope, User, Catalogue, catalogueParams) {

        $scope.loading = true;

        Catalogue.list(User.ROLES.SELLER, catalogueParams).then(function (catalogueList) {
            $scope.loading = false;
            $scope.catalogueList = catalogueList;
        });
    })
    .controller('CatalogueCreateCtrl', function ($scope, $state, Catalogue) {

        $scope.createCatalogue = function () {
            Catalogue.create($scope.catalogueInfo).then(function (catalogueCreated) {
                $state.go('app.stock.catalogue.update', {
                    catalogueId: catalogueCreated.id
                });
            });
        };

        $scope.catalogueInfo = {};
    })
    .controller('CatalogueDetailCtrl', function ($scope, $state, Catalogue) {

        $scope.loading = true;

        Catalogue.get($state.params.catalogueId).then(function (catalogue) {
            $scope.loading = false;
            $scope.catalogue = catalogue;
        });
    })
    .controller('CatalogueUpdateCtrl', function ($scope, $state, Catalogue) {

        $scope.updateCatalogue = function () {
            Catalogue.update($scope.catalogueInfo).then(function (catalogueUpdated) {
                $state.go('app.stock.catalogue.update', {
                    catalogueId: catalogueUpdated.id,
                    reload: true
                });
            });
        };

        $scope.loading = true;

        Catalogue.get($state.params.catalogueId).then(function (catalogue) {
            $scope.loading = false;
            $scope.catalogue = catalogue;
            $scope.catalogueInfo = angular.copy(catalogue);
        });
    });
