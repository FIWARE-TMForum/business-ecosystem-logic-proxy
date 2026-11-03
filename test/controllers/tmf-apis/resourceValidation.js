/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
 * Licensed under the GNU Affero General Public License, version 3 or later.
 */
const nock = require('nock');
const proxyquire = require('proxyquire');
const testUtils = require('../../utils');

describe('Resource specification charging validation', function() {
    const config = testUtils.getDefaultConfig();
    const utils = proxyquire('../../../lib/utils', { './../config': config });
    const storeClient = proxyquire('../../../lib/store', {
        './../config': config,
        './utils': utils
    }).storeClient;
    const backend = utils.getAPIURL(config.endpoints.charging.appSsl,
        config.endpoints.charging.host, config.endpoints.charging.port, '');
    const catalog = utils.getAPIURL(config.endpoints.resource.appSsl,
        config.endpoints.resource.host, config.endpoints.resource.port, '');
    const validationPath = config.endpoints.charging.apiPath + '/charging/api/assetManagement/assets/validateResourceJob';
    const user = {
        id: 'provider', partyId: 'provider-party', userId: 'operator', userPartyId: 'operator-party',
        accessToken: 'provider-token', email: 'provider@example.org', displayName: 'Provider',
        roles: [{ name: config.roles.seller }]
    };
    const previous = {
        id: 'resource-1', name: 'Resource', description: 'Original', lifecycleStatus: 'Active',
        relatedParty: [{ id: user.partyId, role: config.roles.seller }],
        specCharacteristic: [{ name: 'Resource Type', valueType: 'string', specCharacteristicValue: [{ value: 'plugin' }] }]
    };
    let api;
    let loggedIn;
    let owner;

    beforeEach(function() {
        nock.cleanAll();
        loggedIn = true;
        owner = true;
        api = proxyquire('../../../controllers/tmf-apis/resource', {
            './../../config': config,
            './../../lib/store': { storeClient: storeClient },
            './../../lib/utils': {
                validateLoggedIn: (req, cb) => cb(loggedIn ? null : { status: 401 }),
                hasRole: () => true
            },
            './../../lib/tmfUtils': {
                hasPartyRole: () => owner,
                validateNameField: () => null,
                validateDescriptionField: () => null
            }
        }).resource;
    });

    afterEach(function() { nock.cleanAll(); });

    function request(method, body) {
        if (method === 'PATCH') {
            nock(catalog).get('/api/resourceSpecification/resource-1').reply(200, previous);
        }
        return {
            method: method, user: user, body: JSON.stringify(body),
            apiUrl: '/resource/resourceSpecification' + (method === 'PATCH' ? '/resource-1' : ''),
            headers: {}
        };
    }

    function validation(action, resource) {
        return nock(backend, { reqheaders: {
            'content-type': 'application/json', authorization: 'Bearer provider-token',
            'x-actor-id': user.id, 'x-party-id': user.partyId,
            'x-user-id': user.userId, 'x-user-party-id': user.userPartyId,
            'x-roles': config.roles.seller.toLowerCase() + ','
        } }).post(validationPath, { action: action, resource: resource });
    }

    [undefined, previous.specCharacteristic].forEach(function(characteristics) {
        it('validates creation with ' + (characteristics ? 'a Resource Type' : 'no Resource Type'), function(done) {
            const body = { name: 'New resource', relatedParty: previous.relatedParty };
            if (characteristics) body.specCharacteristic = characteristics;
            const req = request('POST', body);
            const scope = validation('create', body).reply(200);
            api.checkPermissions(req, function(err) {
                expect(err).toBe(null);
                expect(scope.isDone()).toBe(true);
                expect(req.body).toBe(JSON.stringify(body));
                done();
            });
        });
    });

    [undefined, [], [{ name: 'New characteristic' }]].forEach(function(characteristics) {
        it('validates complete PATCH with characteristics ' + JSON.stringify(characteristics), function(done) {
            const patch = { description: 'Updated', id: 'caller-id' };
            if (characteristics) patch.specCharacteristic = characteristics;
            const proposed = Object.assign({}, previous, patch, { id: previous.id });
            const req = request('PATCH', patch);
            const scope = validation('update', proposed).reply(200);
            api.checkPermissions(req, function(err) {
                expect(err).toBe(null);
                expect(scope.isDone()).toBe(true);
                expect(req.body).toBe(JSON.stringify(patch));
                expect(req.prevBody).toEqual(previous);
                done();
            });
        });
    });

    ['POST', 'PATCH'].forEach(function(method) {
        [400, 403, 409, 422, 500, 201, 202, 204, 'network'].forEach(function(status) {
            it('blocks ' + method + ' on backend result ' + status, function(done) {
                const body = method === 'POST' ? previous : { description: 'Updated' };
                const proposed = Object.assign({}, previous, body);
                const scope = validation(method === 'POST' ? 'create' : 'update', proposed);
                if (status === 'network') scope.replyWithError('connection reset');
                else scope.reply(status, { error: 'Plugin rejected resource' });
                api.checkPermissions(request(method, body), function(err) {
                    const expectedStatus = status === 'network' ? 504 : status < 300 ? 502 : status;
                    expect(err.status).toBe(expectedStatus);
                    expect(err.message).toBe([400, 403, 409, 422].indexOf(status) >= 0
                        ? 'Plugin rejected resource' : 'The server has failed validating the resource specification');
                    done();
                });
            });
        });

        it('skips backend validation for unauthenticated ' + method, function(done) {
            loggedIn = false;
            const scope = validation(method === 'POST' ? 'create' : 'update', previous).reply(200);
            api.checkPermissions(request(method, previous), function(err) {
                expect(err.status).toBe(401);
                expect(scope.isDone()).toBe(false);
                done();
            });
        });

        it('skips backend validation for non-owner ' + method, function(done) {
            owner = false;
            const scope = validation(method === 'POST' ? 'create' : 'update', previous).reply(200);
            api.checkPermissions(request(method, previous), function(err) {
                expect(err.status).toBe(403);
                expect(scope.isDone()).toBe(false);
                done();
            });
        });
    });

    it('waits for backend validation before allowing forwarding', function(done) {
        const scope = validation('create', previous).delay(30).reply(200);
        let completed = false;
        api.checkPermissions(request('POST', previous), function(err) {
            completed = true;
            expect(err).toBe(null);
            expect(scope.isDone()).toBe(true);
            done();
        });
        expect(completed).toBe(false);
    });
});
