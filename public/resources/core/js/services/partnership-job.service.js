/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .factory('PartnershipJob', PartnershipJobService);

    function PartnershipJobService($q, $resource, URLS) {
        var resource = $resource(URLS.ONBOARDING_MANAGEMENT + '/partnershipJob/:jobId', {
            jobId: '@id'
        });
        var status = {
            RUNNING: 'running',
            COMPLETED: 'completed',
            FAILED: 'failed'
        };

        return {
            create: create,
            detail: detail
        };

        function create(data) {
            var deferred = $q.defer();

            resource.save(data, function (jobCreated) {
                waitForCompleted(jobCreated.id);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function waitForCompleted(jobId) {
                detail(jobId).then(function (jobRetrieved) {
                    switch (jobRetrieved.status) {
                    case status.RUNNING:
                        waitForCompleted(jobRetrieved.id);
                        break;
                    case status.COMPLETED:
                        deferred.resolve(jobRetrieved);
                        break;
                    default:
                        deferred.reject();
                    }
                }, function (response) {
                    deferred.reject(response);
                });
            }
        }

        function detail(jobId) {
            var deferred = $q.defer();
            var params = {
                jobId: jobId
            };

            resource.get(params, function (jobRetrieved) {
                deferred.resolve(jobRetrieved);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }

})();
