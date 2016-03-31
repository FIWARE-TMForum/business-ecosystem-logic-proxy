var proxyquire = require('proxyquire'),
    testUtils = require('../utils');

describe('RSS Client', function() {

    var PROVIDER_URL = '/rss/rss/providers';
    var MODELS_URL = '/rss/rss/models';

    var config = testUtils.getDefaultConfig();

    var userInfo = {
        id: 'testuser',
        displayName: 'Test user',
        email: 'testuser@email.com'
    };

    var getRssClient = function(request) {
        return proxyquire('../../lib/rss', {
            './../config': config,
            './utils': {
                attachUserHeaders: function(headers) {
                    headers['X-Nick-Name'] = userInfo.id;
                    headers['X-Email'] = userInfo.email;
                    headers['X-Display-Name'] = userInfo.displayName;
                    headers['X-Roles'] = '';
                }
            },
            'request': request
        }).rssClient;
    };


    var protocol = config.appSsl ? 'https' : 'http';
    var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.rss.port;

    var mockRSSServer = function(exp_options, err, resp, body) {
        return function(called_options, callback) {
            expect(called_options).toEqual(exp_options);
            callback(err, resp, body);
        };
    };

    it('should call the callback with the RSS server response when creating a provider', function(done) {

        var exp_options = {
            url: serverUrl + PROVIDER_URL,
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'X-Nick-Name': 'proxyAdmin',
                'X-Roles': config.oauth2.roles.admin,
                'X-Email': 'proxy@email.com'
            },
            body: JSON.stringify({
                'providerId': userInfo.id,
                'providerName': userInfo.displayName
            })
        };

        var request = mockRSSServer(exp_options, null, {
            statusCode: 201
        }, null);

        var rssClient = getRssClient(request);

        rssClient.createProvider(userInfo, function(resp) {
            expect(resp).toBe(null);
            done();
        });
    });

    var testDefaultModelCreation = function(err, resp, resp_body, exp_err, exp_resp, done) {
        var exp_options = {
            url: serverUrl + MODELS_URL,
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'Accept': 'application/json',
                'X-Nick-Name': userInfo.id,
                'X-Display-Name': userInfo.displayName,
                'X-Roles': '',
                'X-Email': userInfo.email
            },
            body: JSON.stringify({
                'aggregatorValue': config.revenueModel,
                'ownerValue': (100 - config.revenueModel),
                'algorithmType': 'FIXED_PERCENTAGE',
                'productClass': 'defaultRevenue'
            })
        };

        var request = mockRSSServer(exp_options, err, resp, resp_body);

        var rssClient = getRssClient(request);

        rssClient.createDefaultModel(userInfo, function(err, resp){
            expect(err).toEqual(exp_err);
            expect(resp).toEqual(exp_resp);
            done();
        })
    };

    it('should call the callback with the response info when the RSS server returns a 201 code', function(done) {
        var status = 201;
        var headers = {
            'content-type': 'application/json'
        };
        var body = {
            aggregatorValue: 30
        };

        testDefaultModelCreation(null, {
            statusCode: status,
            headers: headers
        }, body, null, {
            status: 201,
            headers: headers,
            body: body
        }, done);
    });

    it('should call the callback with the default error message when the server has an error', function(done){
        testDefaultModelCreation('ERROR', null, null, {
            status: 504,
            message: 'An unexpected error prevented your default RS model to be created'
        }, undefined, done);
    });

    it('should call the callback with the error given by the server when it returns a 400 code', function (done) {
        var errMsg =  'Unexpected error';

        testDefaultModelCreation(null, {
            statusCode: 400
        }, JSON.stringify({
            exceptionText: errMsg
        }), {
            status: 400,
            message: errMsg
        }, undefined, done);
    });
});
