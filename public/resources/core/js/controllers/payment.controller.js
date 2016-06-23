/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
