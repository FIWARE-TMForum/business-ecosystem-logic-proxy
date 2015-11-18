var freeport = require('freeport'),
    nock = require('nock'),
    proxyquire =  require('proxyquire'),
    reporters = require('jasmine-reporters'),
    testUtils = require('../utils');

describe('HTTP Client', function() {

    var junitReporter = new reporters.JUnitXmlReporter({
        savePath: __dirname + '/../..',    // The main folder of the project
        consolidateAll: true,
        filePrefix: 'xunit'
    });
    jasmine.getEnv().addReporter(junitReporter);

    var emptyFunction = function() {};
    var httpClient = proxyquire('../../lib/httpClient.js', { './logger': testUtils.emptyLogger });

    describe('Request', function() {

        it('should call error callback when server is unreachable', function(done) {

            freeport(function(err, port) {

                var options = {
                    host: 'localhost',
                    port: port,
                    method: 'GET'
                }

                httpClient.request('http', options, null, null, function(code, err) {
                    expect(code).toBe(503);
                    expect(err.code).toBe('ECONNREFUSED');
                    done();
                });

            });
        });
        
        var testAppropriateCallback = function(protocol, statusCode, requestOk, done) {
            // Setting up the environment
            var host = 'example.com';
            var port = '80';
            var path = '/user/1';
            var reqHeaders = {'accept': 'application/json', 'x-custom': 'Custom Value'};
            var answer = {id: 1, name: 'Example User', email: 'an_example@example.com'};
            var resHeaders = {'content-type': 'application/json', 'x-another': 'Another Value'};

            // Mock server
            var url = protocol + '://' + host + ':' + port;
            var acceptHeaderValue;
            var xCustomValue;
            var server = nock(url, {
                reqheaders: {
                    'Accept': function(headerValue) {
                        acceptHeaderValue = headerValue;
                        return true;
                    },
                    'X-Custom': function(headerValue) {
                        xCustomValue = headerValue;
                        return true;
                    }
                }
            }).get(path).reply(statusCode, answer, resHeaders);

            // Call the server
            var options = {
                host: host,
                port: port,
                path: path,
                method: 'GET',
                headers: reqHeaders
            }

            var callback = function(status, resp, headers) {
                expect(status).toBe(statusCode);
                expect(JSON.parse(resp)).toEqual(answer);
                expect(acceptHeaderValue).toBe(reqHeaders['accept']);
                expect(xCustomValue).toBe(reqHeaders['x-custom']);

                // Headers are not sent when the error callback is called
                if (requestOk) {
                    expect(headers).toEqual(resHeaders);
                }

                done();
            }

            var callbackOk = requestOk === true ? callback : null;
            var callbackError = requestOk === false ? callback : null;

            httpClient.request(protocol, options, null, callbackOk, callbackError);

        }

        it('should call OK callback when status code is 200', function(done) {
            testAppropriateCallback('http', 200, true, done);
        });

        // Test bug: OK callback was only called for requests with 200 status
        it('should call OK callback when status code is 299', function(done) {
            testAppropriateCallback('http', 299, true, done);
        });

        it('should call error callback when status code is not 2XX', function(done) {
            testAppropriateCallback('http', 400, false, done);
        });

        it('should use the HTTPs library when required', function(done) {
            testAppropriateCallback('https', 200, true, done);
        });

        var testWithBody = function(method, bodyExpected, done) {
            // Setting up the environment
            var protocol = 'http';
            var host = 'example.com';
            var port = '80';
            var path = '/user/1';
            var body = 'THIS IS AN EXAMPLE!!';
            var statusCode = 200;
            var answer = {id: 1, name: 'Example User', email: 'an_example@example.com'};

            // Mock server
            var receivedBody;
            var url = protocol + '://' + host + ':' + port;
            var server = nock(url)[method.toLowerCase()](path, function(body) {
                receivedBody = body;
                return true;
            }).reply(statusCode, answer);

            // Call the server
            var options = {
                host: host,
                port: port,
                path: path,
                method: method
            }

            httpClient.request(protocol, options, body, function(status, resp, headers) {
                var expectedBody = bodyExpected ? body : '';
                expect(receivedBody).toEqual(expectedBody);
                expect(status).toBe(statusCode);
                expect(JSON.parse(resp)).toEqual(answer);
                done();
            });
        }

        it('should send body in POST requests', function(done) {
            testWithBody('POST', true, done);
        });

        it('should send body in PUT requests', function(done) {
            testWithBody('PUT', true, done);
        });

        it('should send body in PATCH requests', function(done) {
            testWithBody('PATCH', true, done);
        });

        it('should not send body in GET requests', function(done) {
            testWithBody('GET', false, done);
        });

        it('should not send body in DELETE requests', function(done) {
            testWithBody('DELETE', false, done);
        });
    });

    describe('Proxied Request', function() {

        var testPorxyRequest = function(statusCode, method, bodyExpected, headersExpected, done) {

            // Set up mock
            var protocol = 'http';
            var host = 'example.com';
            var port = '80';
            var path = '/user/1';
            var reqHeaders = {'accept': 'application/json', 'x-custom': 'Custom Value'};
            var body = 'THIS IS AN EXAMPLE';
            var answer = {id: 1, name: 'Example User', email: 'an_example@example.com'};
            var resHeaders = {'content-type': 'application/json', 'x-another': 'Another Value'};

            var url = protocol + '://' + host + ':' + port;
            var acceptHeaderValue;
            var xCustomValue;
            var receivedBody;
            var server = nock(url, {
                reqheaders: {
                    'Accept': function(headerValue) {
                        acceptHeaderValue = headerValue;
                        return true;
                    },
                    'X-Custom': function(headerValue) {
                        xCustomValue = headerValue;
                        return true;
                    }
                }
            })[method.toLowerCase()](path, function(body) {
                receivedBody = body;
                return true;
            }).reply(statusCode, answer, resHeaders);

            // Call the server
            var options = {
                host: host,
                port: port,
                path: path,
                method: method,
                headers: reqHeaders
            }

            var res = jasmine.createSpyObj('res', ['statusCode', 'setHeader', 'write', 'end']);
            httpClient.proxyRequest(protocol, options, body, res);

            // Wait until the response parameters has been set
            setTimeout(function() {

                var expectedBody = bodyExpected === true ? body : '';

                // Check the request
                expect(acceptHeaderValue).toBe(reqHeaders['accept']);
                expect(xCustomValue).toBe(reqHeaders['x-custom']);
                expect(receivedBody).toBe(expectedBody);

                // Check the response
                expect(res.statusCode).toBe(statusCode);
                expect(res.write).toHaveBeenCalledWith(JSON.stringify(answer));
                expect(res.end).toHaveBeenCalledWith();

                if (headersExpected) {
                    for (var header in resHeaders) {
                        expect(res.setHeader).toHaveBeenCalledWith(header, resHeaders[header]);
                    }
                }

                done();
            }, 150);
        }

        it('should proxy request when status code is 200 (GET)', function(done) {
            testPorxyRequest(200, 'GET', false, true, done);
        });
        it('should proxy request when status code is 200 (POST)', function(done) {
            testPorxyRequest(200, 'POST', true, true, done);
        });

        it('should proxy request when status code is 200 (PUT)', function(done) {
            testPorxyRequest(200, 'PUT', true, true, done);
        });

        it('should proxy request when status code is 200 (PATCH)', function(done) {
            testPorxyRequest(200, 'PATCH', true, true, done);
        });

        it('should proxy request when status code is 200 (DELETE)', function(done) {
            testPorxyRequest(200, 'DELETE', false, true, done);
        });

        it('should proxy request when satus code is not 2XX (GET)', function(done) {
            testPorxyRequest(400, 'GET', false, false, done);
        });

        it('should proxy request when satus code is not 2XX (POST)', function(done) {
            testPorxyRequest(400, 'POST', true, false, done);
        });

        it('should proxy request when satus code is not 2XX (PUT)', function(done) {
            testPorxyRequest(400, 'PUT', true, false, done);
        });

        it('should proxy request when satus code is not 2XX (PATCH)', function(done) {
            testPorxyRequest(400, 'PATCH', true, false, done);
        });

        it('should proxy request when satus code is not 2XX (DELETE)', function(done) {
            testPorxyRequest(400, 'DELETE', false, false, done);
        });

        it('should proxy request when server is not available', function(done) {
            freeport(function(err, port) {

                var options = {
                    host: 'localhost',
                    port: port,
                    method: 'GET'
                }

                var res = jasmine.createSpyObj('res', ['statusCode', 'write', 'end']);
                httpClient.proxyRequest('http', options, null, res);

                // Wait until response parameters have been set
                setTimeout(function() {
                    // Check the response
                    expect(res.statusCode).toBe(503);
                    done();
                }, 500);

            });
        });

    });

});