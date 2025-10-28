/* Copyright (c) 2025 Future Internet Consulting and Development Solutions S.L.
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

'use strict';

const path = require('path');
const proxyquire = require('proxyquire');

// ---- Shared spies/stubs (fresh per test) ----
function makeStubs() {
  // logger stub
  const loggerStub = {
    logger: {
      getLogger: function () {
        return {
          info: jasmine.createSpy('info'),
          warn: jasmine.createSpy('warn'),
          debug: jasmine.createSpy('debug'),
        };
      },
    },
  };

  // party client stub
  const partyClientStub = {
    getIndividualsByQuery: jasmine.createSpy('getIndividualsByQuery'),
    createIndividual: jasmine.createSpy('createIndividual'),
    getOrganizationsByQuery: jasmine.createSpy('getOrganizationsByQuery'),
    createOrganization: jasmine.createSpy('createOrganization'),
    updateOrganization: jasmine.createSpy('updateOrganization'),
    updateIndividual: jasmine.createSpy('updateIndividual'),
  };

  const partyStub = { partyClient: partyClientStub };

  // utils stub
  const utilsStub = {
    getAuthToken: jasmine.createSpy('getAuthToken'),
    sendUnauthorized: jasmine.createSpy('sendUnauthorized').and.callFake((res, msg) => {
      res.statusCode = 401;
      res.body = { error: msg };
    }),
    sendUnexpectedError: jasmine.createSpy('sendUnexpectedError').and.callFake((res, msg) => {
      res.statusCode = 500;
      res.body = { error: msg };
    }),
    log: jasmine.createSpy('log'),
  };

  // config stub; we toggle editParty inside tests
  const configStub = { editParty: false };

  // Strategy stub factory (fiware)
  function makeFiwareStrategyStub() {
    // STRATEGY instance that lib/auth wraps with loadProfile(), refresh(), userProfile()
    const STRATEGY = {
      // Fallback path used when token not cached
      userProfile: function (accessToken, cb) {
        cb(null, {
          id: 'user-1',
          username: 'u1',
          organizations: [],
          _json: { exp: Math.floor(Date.now() / 1000) + 1800 }, // 30m
        });
      },
      refresh: function (refreshToken, cb) {
        // default: return a new access token
        cb(null, 'NEW_ACCESS', refreshToken);
      },
    };

    function buildStrategy(verifyCb) {
      // make it easy to simulate "provider callback" from tests
      STRATEGY.__triggerVerify = function (accessToken, refreshToken, profile) {
        return new Promise((resolve, reject) => {
          verifyCb(accessToken, refreshToken, profile, function (err, user) {
            if (err) reject(err);
            else resolve(user);
          });
        });
      };
      return STRATEGY;
    }
    function getScope() {
      return ['openid', 'profile', 'email'];
    }
    return { strategy: function () { return { buildStrategy, getScope }; } };
  }

  return {
    loggerStub,
    partyStub,
    utilsStub,
    configStub,
    fiwareStrategyStub: makeFiwareStrategyStub(),
  };
}

// Helper to require SUT with fresh stubs every time
function loadSUT(stubs) {
  const authModule = proxyquire('../../lib/auth', {
    './logger': stubs.loggerStub,
    './party': stubs.partyStub,
    './utils': stubs.utilsStub,
    '../config': stubs.configStub,
    './strategies/fiware': stubs.fiwareStrategyStub,
    // other strategies are not loaded in these tests
  });
  return authModule;
}

// Small helpers
function baseProfile(overrides) {
  return Object.assign(
    {
      id: 'user-1',
      username: 'user1',
      displayName: 'User One',
      organizations: [],
    },
    overrides || {}
  );
}

fdescribe('Auth lib', function () {
  let clockNow;
  beforeEach(function () {
    // Fix "now" to keep exp/expire comparisons deterministic
    clockNow = new Date('2025-10-21T10:00:00Z');
    // Not a full clock mock, but exp comparisons are relative to Date.now()
    spyOn(Date, 'now').and.returnValue(clockNow.getTime());
  });

  it('auth() builds strategy, creates individual if not found, and caches profile via verify callback', function (done) {
    const stubs = makeStubs();
    const { auth } = loadSUT(stubs);

    // Party: no individual → create
    stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [] }));
    stubs.partyStub.partyClient.createIndividual.and.returnValue(Promise.resolve({ body: { id: 'INDIV-1' } }));

    // Build auth
    auth({ provider: 'fiware', idpId: 'my-idp' }).then(function ({ STRATEGY, getScope }) {
      expect(typeof getScope).toBe('function');
      expect(getScope()).toContain('openid');

      const inputProfile = baseProfile();

      // Simulate IdP verify callback
      STRATEGY.__triggerVerify('ACCESS_1', 'REFRESH_1', inputProfile).then(function (user) {
        // Decorated user
        expect(user).toEqual(jasmine.objectContaining({
          id: 'user-1',
          accessToken: 'ACCESS_1',
          refreshToken: 'REFRESH_1',
          idp: 'my-idp',
          partyId: 'INDIV-1',
        }));

        // Party calls
        expect(stubs.partyStub.partyClient.getIndividualsByQuery)
          .toHaveBeenCalledWith('externalReference.name=user-1');
        expect(stubs.partyStub.partyClient.createIndividual).toHaveBeenCalled();

        // Cached profile: calling STRATEGY.userProfile with cached token should return profile quickly
        STRATEGY.userProfile('ACCESS_1', function (err, prof) {
          expect(err).toBeFalsy();
          expect(prof.id).toBe('user-1');
          done();
        });
      }).catch(done.fail);
    }).catch(done.fail);
  });

  it('userProfile fallback: when token not cached, fetches from IdP and sets expire from _json.exp', function (done) {
    const stubs = makeStubs();
    const { auth } = loadSUT(stubs);

    stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [] }));
    stubs.partyStub.partyClient.createIndividual.and.returnValue(Promise.resolve({ body: { id: 'INDIV-2' } }));

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
      STRATEGY.userProfile('UNCACHED', function (err, prof) {
        expect(err).toBeFalsy();
        expect(prof.partyId).toBe('INDIV-2');
        expect(prof.expire).toBeGreaterThan(Math.floor(Date.now() / 1000)); // derived from _json.exp
        done();
      });
    }).catch(done.fail);
  });

  it('authMiddleware.headerAuthentication loads token from header, attaches user, and saves session', function (done) {
    const stubs = makeStubs();
    const { auth, authMiddleware } = loadSUT(stubs);

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
      // Seed cache via provider callback
      stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [] }));
      stubs.partyStub.partyClient.createIndividual.and.returnValue(Promise.resolve({ body: { id: 'INDIV-3' } }));

      STRATEGY.__triggerVerify('TKN1', 'R1', baseProfile()).then(function () {
        // Make header token available via utils.getAuthToken
        stubs.utilsStub.getAuthToken.and.returnValue('TKN1');

        const mw = authMiddleware({ local: { STRATEGY } });

        const saved = { called: false, err: null };
        const req = { headers: { authorization: 'Bearer TKN1' }, session: { passport: {}, save: function (cb) { saved.called = true; cb && cb(saved.err); } } };
        const res = {};
        const next = jasmine.createSpy('next');

        mw.headerAuthentication(req, res, function () {
          next();
          try {
            expect(next).toHaveBeenCalled();
            expect(req.user).toBeTruthy();
            expect(req.user.accessToken).toBe('TKN1');
            expect(req.session.passport.user).toBe(req.user);
            expect(saved.called).toBe(true);
            done();
          } catch (e) {
            done.fail(e);
          }
        });
      }).catch(done.fail);
    }).catch(done.fail);
  });

  it('authMiddleware.headerAuthentication uses local STRATEGY when token not cached', function (done) {
    const stubs = makeStubs();
    const { auth, authMiddleware } = loadSUT(stubs);

    // Critical: stub party calls the middleware awaits when token is not cached
    stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [] }));
    stubs.partyStub.partyClient.createIndividual.and.returnValue(Promise.resolve({ body: { id: 'INDIV-UNK' } }));

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
        // Token unknown to cache
        stubs.utilsStub.getAuthToken.and.returnValue('UNKNOWN');

        const mw = authMiddleware({ local: { STRATEGY } });
        const req = {
        headers: { authorization: 'Bearer UNKNOWN' },
        session: { passport: {}, save: function (cb) { cb && cb(); } },
        };
        const res = {};
        const next = jasmine.createSpy('next');

        mw.headerAuthentication(req, res, function () {
        next();
        try {
            expect(next).toHaveBeenCalled();
            expect(req.user).toBeTruthy();
            expect(req.user.accessToken).toBe('UNKNOWN'); // set by loadProfile()
            expect(stubs.partyStub.partyClient.createIndividual).toHaveBeenCalled(); // proved path ran
            done();
        } catch (e) {
            done.fail(e);
        }
        });
    }).catch(done.fail);
  });

  it('authMiddleware.setPartyObj switches to organization context when x-organization is present', function (done) {
    const stubs = makeStubs();
    const { auth, authMiddleware } = loadSUT(stubs);

    // Ensure all party helpers that might run during verify/org sync return { body: ... }
    stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-5' }] }));
    stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.resolve({ body: [] }));
    stubs.partyStub.partyClient.createOrganization.and.returnValue(Promise.resolve({ body: { id: 'ORG-1' } }));
    stubs.partyStub.partyClient.updateOrganization.and.returnValue(Promise.resolve({}));
    stubs.partyStub.partyClient.updateIndividual.and.returnValue(Promise.resolve({}));

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
        const profile = baseProfile({
        organizations: [
            { id: 'ORG-1', name: 'Org One', roles: [{ name: 'ADMIN' }], partyId: 'ORG-PARTY-1' },
        ],
        accessToken: 'AAA',
        refreshToken: 'RRR',
        partyId: 'INDIV-5',
        idp: 'local',
        });

        STRATEGY.__triggerVerify('AAA', 'RRR', profile).then(function () {
        const mw = authMiddleware({ local: { STRATEGY } });
        const req = { headers: { 'x-organization': 'ORG-1' }, user: profile };
        const res = {};
        const next = jasmine.createSpy('next');

        mw.setPartyObj(req, res, function () {
            next();
            try {
            expect(next).toHaveBeenCalled();
            expect(req.user.id).toBe('ORG-1');
            expect(req.user.userPartyId).toBe('INDIV-5');
            expect(req.user.displayName).toBe('Org One');
            expect(req.user.roles).toEqual([{ name: 'ADMIN' }]);
            done();
            } catch (e) {
            done.fail(e);
            }
        });
        }).catch(done.fail);
    }).catch(done.fail);
    });

  it('authMiddleware.setPartyObj rejects unauthorized x-organization', function () {
    const stubs = makeStubs();
    const { authMiddleware } = loadSUT(stubs);

    const mw = authMiddleware({});
    const req = {
        headers: { 'x-organization': 'ORG-UNKNOWN' },
        user: baseProfile({ organizations: [{ id: 'ORG-1', name: 'Org One' }] }),
    };
    const res = {};
    const next = jasmine.createSpy('next');

    // setPartyObj is synchronous in the unauthorized branch: it calls sendUnauthorized and returns
    mw.setPartyObj(req, res, function () {
        // Intentionally do nothing; this callback should NOT be invoked on unauthorized
        next();
    });

    expect(stubs.utilsStub.sendUnauthorized).toHaveBeenCalledWith(
        res,
        'You are not allowed to act on behalf the provided organization'
    );
    expect(next).not.toHaveBeenCalled();
    });


  it('authMiddleware.checkOrganizations creates/updates party when editParty=false and marks processed', function (done) {
    const stubs = makeStubs();
    const { auth, authMiddleware } = loadSUT(stubs);

    stubs.configStub.editParty = false;

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
      // Seed cache with a user (party will be created)
      const reqUser = baseProfile({
        accessToken: 'TOK-CHECK',
        organizations: [],
        idp: 'local',
        expire: Math.floor(Date.now() / 1000) + 300,
      });

      stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValues(
        Promise.resolve({ body: [] }),           // on verify: not found
        Promise.resolve({ body: [{ id: 'INDIV-CHK' }] }) // maybe subsequent reads
      );
      stubs.partyStub.partyClient.createIndividual.and.returnValue(Promise.resolve({ body: { id: 'INDIV-CHK' } }));
      stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.resolve({ body: [] }));
      stubs.partyStub.partyClient.createOrganization.and.returnValue(Promise.resolve({ body: { id: 'ORGX' } }));
      stubs.partyStub.partyClient.updateOrganization.and.returnValue(Promise.resolve({}));
      stubs.partyStub.partyClient.updateIndividual.and.returnValue(Promise.resolve({}));

      STRATEGY.__triggerVerify('TOK-CHECK', 'REF', reqUser).then(function () {
        const mw = authMiddleware({ local: { STRATEGY } });
        const req = { user: Object.assign({}, reqUser), headers: {} };
        const res = {};
        const next = jasmine.createSpy('next');

        mw.checkOrganizations(req, res, function () {
          next();
          try {
            expect(next).toHaveBeenCalled();
            // editParty=false → updateIndividual should have been called to sync characteristics/roles
            expect(stubs.partyStub.partyClient.updateIndividual).toHaveBeenCalled();
            done();
          } catch (e) {
            done.fail(e);
          }
        });
      }).catch(done.fail);
    }).catch(done.fail);
  });

  it('authMiddleware.checkOrganizations handles errors and returns 500', function (done) {
    const stubs = makeStubs();
    const { auth, authMiddleware } = loadSUT(stubs);

    // Seed an individual so cache can resolve
    stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-ERR' }] }));

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
        STRATEGY.__triggerVerify('TOK-ERR', 'REF', baseProfile()).then(function () {
        const mw = authMiddleware({ local: { STRATEGY } });

        // Force an error from organizations query
        stubs.partyStub.partyClient.getOrganizationsByQuery.and.callFake(function () {
            return Promise.reject(new Error('boom'));
        });

        const req = { user: { accessToken: 'TOK-ERR' }, headers: {} };
        const res = {};
        const next = jasmine.createSpy('next');

        // Do NOT chain .then on the return; the middleware may not return a promise.
        mw.checkOrganizations(req, res, next);

        // Let the microtask queue drain so the catch inside the middleware runs
        setTimeout(function () {
            try {
            expect(stubs.utilsStub.sendUnexpectedError).toHaveBeenCalled();
            expect(res.statusCode).toBe(500);
            expect(next).not.toHaveBeenCalled();
            done();
            } catch (e) {
            done.fail(e);
            }
        }, 0);
        }).catch(done.fail);
    }).catch(done.fail);
    });

  it('authMiddleware refresh path is used when token is near expiration', function (done) {
    const stubs = makeStubs();
    const { auth, authMiddleware } = loadSUT(stubs);

    auth({ provider: 'fiware' }).then(function ({ STRATEGY }) {
      // Seed user with expire within 5 seconds
      const nearExp = Math.floor(Date.now() / 1000) + 4;

      stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [] }));
      stubs.partyStub.partyClient.createIndividual.and.returnValue(Promise.resolve({ body: { id: 'INDIV-R' } }));

      const prof = baseProfile({ expire: nearExp });

      STRATEGY.__triggerVerify('TOKEN-R', 'REFRESH-R', prof).then(function () {
        // Override refresh to confirm it runs
        const refreshSpy = spyOn(STRATEGY, 'refresh').and.callFake(function (refreshToken, cb) {
          cb(null, 'TOKEN-R-NEW', refreshToken);
        });

        const mw = authMiddleware({ local: { STRATEGY } });
        const req = { user: Object.assign({}, prof, { accessToken: 'TOKEN-R', refreshToken: 'REFRESH-R' }), session: { passport: {}, save: function (cb) { cb && cb(); } } };
        const res = {};
        const next = jasmine.createSpy('next');

        mw.headerAuthentication(req, res, function () {
          next();
          try {
            expect(next).toHaveBeenCalled();
            expect(refreshSpy).toHaveBeenCalled();
            expect(req.user.accessToken).toBe('TOKEN-R-NEW');
            done();
          } catch (e) {
            done.fail(e);
          }
        });
      }).catch(done.fail);
    }).catch(done.fail);
  });

    describe('buildOrganization branches', function() {

    it('creates organization when none exists and includes country characteristic', function(done) {
        const stubs = makeStubs();
        const { auth } = loadSUT(stubs);

        stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.resolve({ body: [] }));
        stubs.partyStub.partyClient.createOrganization.and.returnValue(Promise.resolve({ body: { id: 'ORG-NEW', href: '/party/ORG-NEW' } }));
        stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-X' }] }));
        stubs.partyStub.partyClient.updateIndividual.and.returnValue(Promise.resolve({}));

        auth({ provider: 'fiware', idpId: 'local' }).then(({ STRATEGY }) => {
        const profile = {
            id: 'user-1',
            username: 'u1',
            displayName: 'User One',
            organizations: [{
            id: 'acme',
            name: 'ACME Inc.',
            roles: [{ name: 'ADMIN' }],
            country: 'ES'
            }]
        };
        STRATEGY.__triggerVerify('AT1', 'RT1', profile).then(() => {
            const payload = stubs.partyStub.partyClient.createOrganization.calls.mostRecent().args[0];
            expect(payload.tradingName).toBe('ACME Inc.');
            expect(payload.partyCharacteristic).toEqual([{ name: 'country', value: 'ES' }]);
            expect(stubs.partyStub.partyClient.updateIndividual).toHaveBeenCalledWith('INDIV-X', jasmine.any(Object));
            done();
        }).catch(done.fail);
        }).catch(done.fail);
    });

    it('updates existing organization to add missing country characteristic', function(done) {
        const stubs = makeStubs();
        const { auth } = loadSUT(stubs);

        stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.resolve({
        body: [{ id: 'ORG-1', href: '/party/ORG-1', tradingName: 'ACME Inc.', partyCharacteristic: [] }]
        }));
        stubs.partyStub.partyClient.updateOrganization.and.returnValue(Promise.resolve({}));
        stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-X' }] }));
        stubs.partyStub.partyClient.updateIndividual.and.returnValue(Promise.resolve({}));

        auth({ provider: 'fiware', idpId: 'local' }).then(({ STRATEGY }) => {
        const profile = {
            id: 'user-1',
            username: 'u1',
            displayName: 'User One',
            organizations: [{
            id: 'acme',
            name: 'ACME Inc.',
            roles: [{ name: 'ADMIN' }],
            country: 'ES'
            }]
        };
        STRATEGY.__triggerVerify('AT2', 'RT2', profile).then(() => {
            expect(stubs.partyStub.partyClient.updateOrganization).toHaveBeenCalledWith(
            'ORG-1',
            jasmine.objectContaining({
                partyCharacteristic: jasmine.arrayContaining([{ name: 'country', value: 'ES' }])
            })
            );
            done();
        }).catch(done.fail);
        }).catch(done.fail);
    });

    it('does not update organization when country already present', function(done) {
        const stubs = makeStubs();
        const { auth } = loadSUT(stubs);

        stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.resolve({
        body: [{ id: 'ORG-1', href: '/party/ORG-1', tradingName: 'ACME Inc.', partyCharacteristic: [{ name: 'country', value: 'ES' }] }]
        }));
        stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-X' }] }));
        stubs.partyStub.partyClient.updateIndividual.and.returnValue(Promise.resolve({}));

        auth({ provider: 'fiware', idpId: 'local' }).then(({ STRATEGY }) => {
        const profile = {
            id: 'user-1',
            username: 'u1',
            displayName: 'User One',
            organizations: [{
            id: 'acme',
            name: 'ACME Inc.',
            roles: [{ name: 'USER' }],
            country: 'ES'
            }]
        };
        STRATEGY.__triggerVerify('AT3', 'RT3', profile).then(() => {
            expect(stubs.partyStub.partyClient.updateOrganization).not.toHaveBeenCalled();
            expect(stubs.partyStub.partyClient.updateIndividual).toHaveBeenCalledWith('INDIV-X', jasmine.any(Object));
            done();
        }).catch(done.fail);
        }).catch(done.fail);
    });

    it('creates organization without country characteristic when country not provided', function(done) {
        const stubs = makeStubs();
        const { auth } = loadSUT(stubs);

        stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.resolve({ body: [] }));
        stubs.partyStub.partyClient.createOrganization.and.returnValue(Promise.resolve({ body: { id: 'ORG-NO-COUNTRY' } }));
        stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-X' }] }));
        stubs.partyStub.partyClient.updateIndividual.and.returnValue(Promise.resolve({}));

        auth({ provider: 'fiware', idpId: 'local' }).then(({ STRATEGY }) => {
        const profile = {
            id: 'user-1',
            username: 'u1',
            displayName: 'User One',
            organizations: [{
            id: 'acme',
            name: 'ACME Inc.',
            roles: [{ name: 'USER' }]
            // no country
            }]
        };
        STRATEGY.__triggerVerify('AT4', 'RT4', profile).then(() => {
            const payload = stubs.partyStub.partyClient.createOrganization.calls.mostRecent().args[0];
            expect(payload.tradingName).toBe('ACME Inc.');
            expect(payload.partyCharacteristic).toBeUndefined();
            done();
        }).catch(done.fail);
        }).catch(done.fail);
    });

    it('surfaces errors from getOrganizationsByQuery to caller', function(done) {
        const stubs = makeStubs();
        const { auth } = loadSUT(stubs);

        stubs.partyStub.partyClient.getOrganizationsByQuery.and.returnValue(Promise.reject(new Error('boom')));
        stubs.partyStub.partyClient.getIndividualsByQuery.and.returnValue(Promise.resolve({ body: [{ id: 'INDIV-X' }] }));

        auth({ provider: 'fiware', idpId: 'local' }).then(({ STRATEGY }) => {
        const profile = {
            id: 'user-1',
            username: 'u1',
            displayName: 'User One',
            organizations: [{ id: 'acme', name: 'ACME Inc.', roles: [{ name: 'USER' }] }]
        };
        STRATEGY.__triggerVerify('AT5', 'RT5', profile).then(() => {
            done.fail('Expected error to propagate');
        }).catch(err => {
            expect(err).toEqual(jasmine.any(Error));
            expect(err.message).toBe('boom');
            done();
        });
        }).catch(done.fail);
    });
    });
});
