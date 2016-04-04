
angular.module('app')
    .controller('PaymentController', ['$scope', '$location', 'Payment', function($scope, $location, Payment) {

        var urlParams = function urlParams() {

            var search = window.location.search,
                params = {};

            if (search) {

                search = search.substring(1);
                var rawParameters = search.split('&');

                rawParameters.forEach(function (queryParam) {
                    queryParam = queryParam.split('=');
                    params[queryParam[0]] = queryParam[1];
                });
            }

            return params;
        };

        var LOADING = 'LOADING';
        var ACCEPTED = 'ACCEPTED';
        var ERROR = 'ERROR';

        $scope.message = '';
        $scope.state = LOADING;

        // Get related information from the location URL
        var params = urlParams();

        // Read reference
        var ref = params.ref;

        if (!ref) {
            $scope.state = ERROR;
            $scope.message = 'It has not been provided any ordering reference, so your payment cannot be executed';
        } else {
            var action = params.action;

            // If the action is cancel of just invalid the payment is canceled
            if (action !== 'accept' || (action === 'accept' && (!params.paymentId || !params.PayerID))) {
                action = 'cancel';
            }

            var data = {
                action: action,
                reference: ref
            };

            if (action === 'accept') {
                data.paymentId = params.paymentId;
                data.payerId = params.PayerID;
            }

            // Make request to the backend
            Payment.create(data, function() {
                if (action === 'accept') {
                    $scope.message = 'Your payment has been accepted. You can close this tab.';
                    $scope.state = ACCEPTED;
                } else {
                    $scope.accepted = ERROR;
                    $scope.message = 'Your payment has been canceled. You can close this tab.'
                }
            }, function(response) {
                $scope.state = ERROR;
                $scope.message = response.data.message;
            });
        }

    }]);
