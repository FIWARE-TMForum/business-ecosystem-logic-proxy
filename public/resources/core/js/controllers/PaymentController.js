
angular.module('app')
    .controller('PaymentController', ['$scope', '$location', 'Payment', function($scope, $location, Payment) {
        $scope.status = '';
        $scope.accepted = true;

        // Get related information from the location URL
        var params = $location.search();

        // Read reference
        var ref = params.ref;

        if (!ref) {
            $scope.accepted = false;
            $scope.status = "It hasn't been provided any ordering reference, so your payment cannot be executed";
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
                    $scope.status = 'Your payment has been accepted'
                } else {
                    $scope.accepted = false;
                    $scope.status = 'Your payment has been canceled'
                }
            }, function(response) {
                $scope.accepted = false;
                $scope.status = response.data.message;
            });
        }

    }]);
