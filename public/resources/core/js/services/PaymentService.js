
angular.module('app.services')
    .factory('Payment', ['$resource', 'URLS', function ($resource, URLS) {

        var Payment, service = {

            create: function create(data, next, err) {
                return Payment.save(data, function ($resp) {
                    if (next != null) {
                        next($resp);
                    }
                }, function (response) {
                    if (err != null) {
                        err(response);
                    }
                });
            }
        };

        Payment = $resource(URLS.PAYMENT);
        return service;
    }]);
