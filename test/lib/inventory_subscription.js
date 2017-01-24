/*global expect, it, jasmine, describe */

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

var config = require('./../../config'),
    utils = require('./../../lib/utils'),
    Promise = require('promiz'),
    proxyrequire = require("proxyquire");

describe('Test inventory subscription helper and endpoint', function () {
    var createReq = function createReq(data) {
        return (o, cb) => {
            cb(null, { statusCode: 200 }, JSON.stringify(data));
        };
    };

    var createInd = function createInd(err) {
        var f = err ? () => Promise.reject() : () => Promise.resolve();
        return {
            saveIndexInventory: jasmine.createSpy("saveIndexInventory").and.callFake(f),
            removeIndex: jasmine.createSpy("removeIndex").and.callFake(f)
        };
    };

    var createMock = function createMock(request, indexes) {
        if (!request) {
            request = createReq([]);
        }

        if (!indexes) {
            indexes = createInd();
        }

        return proxyrequire("../../lib/inventory_subscription.js", {
            request: request,
            "./indexes": indexes
        });
    };

    var createUrl = function createUrl(path) {
        var port = config.https.enabled ? config.https.port || 443 : config.port || 80;
        return (config.https.enabled ? "https" : "http") + "://" + 'localhost' + ":" + port + path;
    };

    var hubsUrl = function hubsUrl() {
        return utils.getAPIProtocol("DSProductInventory") + "://" + utils.getAPIHost("DSProductInventory") + ":" + utils.getAPIPort("DSProductInventory") + "/DSProductInventory/api/productInventory/v2/hub";
    };

    it('should not recreate subscription if already subscribed', function (done) {
        var url = createUrl("/path");
        var req = createReq([{ callback: url }]);
        var f = jasmine.createSpy("request").and.callFake(req);
        var lib = createMock(f);
        var expectedUrl = hubsUrl();
        lib.createSubscription("/path").then(() => {
            expect(f).toHaveBeenCalledWith(expectedUrl, jasmine.any(Function));
            done();
        });
    });

    it('should create subscription if not subscribed', function (done) {
        var url = createUrl("/path");
        var req = createReq([]);
        var f = jasmine.createSpy("request").and.callFake(req);
        var lib = createMock(f);
        var expectedUrl = hubsUrl();
        var expectedPost = {
            method: "POST",
            url: hubsUrl(),
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ callback: url })
        };
        lib.createSubscription("/path").catch(() => {
            expect(f.calls.count()).toEqual(2);
            expect(f.calls.allArgs()).toEqual([[expectedUrl, jasmine.any(Function)], [expectedPost, jasmine.any(Function)]]);
            done();
        });
    });

    it('should not create subscription if the hubs request gives an error code', function (done) {
        var req = (url, callback) => {
            callback(null, { statusCode: 500 }, null);
        };
        var request = jasmine.createSpy("request").and.callFake(req);
        var lib = createMock(request);
        var expectedUrl = hubsUrl();
        lib.createSubscription("/path").catch((err) => {
            expect(request).toHaveBeenCalledWith(expectedUrl, jasmine.any(Function));
            expect(err).toBe('Error reading inventory hubs: 500');
            done();
        });
    });

    it('should not create subscription if the hubs request gives an error', function (done) {
        var req = (url, callback) => {
            callback('ERROR', null, null);
        };
        var request = jasmine.createSpy("request").and.callFake(req);
        var lib = createMock(request);
        var expectedUrl = hubsUrl();
        lib.createSubscription("/path").catch((err) => {
            expect(request).toHaveBeenCalledWith(expectedUrl, jasmine.any(Function));
            expect(err).toBe('ERROR');
            done();
        });
    });

    it('should not do anything in an empty notification', function(done) {
        var inds = createInd();
        var lib = createMock(null, inds);
        var res = { end: () => {} };
        spyOn(res, "end");
        lib.postNotification({ body: "{}" }, res).then(() => {
            expect(res.end).toHaveBeenCalled();
            expect(inds.saveIndexInventory).not.toHaveBeenCalled();
            expect(inds.removeIndex).not.toHaveBeenCalled();
            done();
        });
    });

    it ('should reject the promise with an error if the subscription request fails', function (done) {
        var req = function(options, callback) {
            if (options.method == 'POST') {
                callback(null, {statusCode: 500}, null);
            } else {
                callback(null, { statusCode: 200 }, JSON.stringify([]));
            }
        };
        var request = jasmine.createSpy("request").and.callFake(req);
        var lib = createMock(request);
        var expectedUrl = hubsUrl();

        var url = createUrl("/path");
        var expectedPost = {
            method: "POST",
            url: hubsUrl(),
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ callback: url })
        };

        lib.createSubscription("/path").catch((err) => {
            expect(request.calls.count()).toEqual(2);
            expect(request.calls.allArgs()).toEqual([[expectedUrl, jasmine.any(Function)], [expectedPost, jasmine.any(Function)]]);
            expect(err).toBe("It hasn't been possible to create inventory subscription.");
            done();
        });
    });

    var createInventoryHelper = function createInventoryHelper(done, event) {
        var inds = createInd();
        var lib = createMock(null, inds);
        var res = { end: () => {} };
        spyOn(res, "end");
        var event = {
            eventType: event,
            event: {
                product: "data"
            }
        };
        lib.postNotification({ body: JSON.stringify(event) }, res).then(() => {
            expect(res.end).toHaveBeenCalled();
            expect(inds.saveIndexInventory).toHaveBeenCalledWith(["data"]);
            expect(inds.removeIndex).not.toHaveBeenCalled();
            done();
        });
    };


    it('should create inventory with creation notification', function(done) {
        createInventoryHelper(done, "ProductCreationNotification");
    });

    it('should re-create inventory with value change notification', function(done) {
        createInventoryHelper(done, "ProductValueChangeNotification");
    });

    it('should re-create inventory with status change notification', function(done) {
        createInventoryHelper(done, "ProductStatusChangeNotification");
    });

    it('should delete inventory', function(done) {
        var inds = createInd();
        var lib = createMock(null, inds);
        var res = { end: () => {} };
        spyOn(res, "end");
        var event = {
            eventType: "ProductDeletionNotification",
            event: {
                product: {
                    id: 9
                }
            }
        };
        lib.postNotification({ body: JSON.stringify(event) }, res).then(() => {
            expect(res.end).toHaveBeenCalled();
            expect(inds.saveIndexInventory).not.toHaveBeenCalled();
            expect(inds.removeIndex).toHaveBeenCalledWith("indexes/inventory", 9);
            done();
        });
    });

    it('should do transactions correctly', function(done) {
        var inds = createInd();
        var lib = createMock(null, inds);
        var res = { end: () => {} };
        spyOn(res, "end");
        var event = {
            eventType: "ProductTransactionNotification",
            event: [{
                eventType: "ProductCreationNotification",
                event: {
                    product: "data"
                }
            }, {
                eventType: "ProductDeletionNotification",
                event: {
                    product: {
                        id: 9
                    }
                }
            }]
        };
        lib.postNotification({ body: JSON.stringify(event) }, res).then(() => {
            expect(res.end).toHaveBeenCalled();
            expect(inds.saveIndexInventory).toHaveBeenCalledWith(["data"]);
            expect(inds.removeIndex).toHaveBeenCalledWith("indexes/inventory", 9);
            done();
        });
    });

    it('should end response on error', function(done) {
        var inds = createInd(true);
        var lib = createMock(null, inds);
        var res = { end: () => {} };
        spyOn(res, "end");
        var event = {
            eventType: "ProductCreationNotification",
            event: {
                product: "data"
            }
        };
        lib.postNotification({ body: JSON.stringify(event) }, res).then(() => {
            expect(res.end).toHaveBeenCalled();
            expect(inds.saveIndexInventory).toHaveBeenCalledWith(["data"]);
            expect(inds.removeIndex).not.toHaveBeenCalled();
            done();
        });
    });

});
