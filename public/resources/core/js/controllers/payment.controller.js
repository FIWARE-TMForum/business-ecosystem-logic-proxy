
angular.module('app')
    .controller('PaymentController', ['$scope', '$location', 'Payment', function($scope, $location, Payment) {

        var LOADING = 'LOADING';
        var ACCEPTED = 'ACCEPTED';
        var ERROR = 'ERROR';

        $scope.message = '';
        $scope.state = LOADING;

        // Get related information from the location URL
        var params = $location.search();

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
