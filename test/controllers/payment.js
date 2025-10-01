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
// payment.spec.js
'use strict';

const proxyquire = require('proxyquire').noCallThru();

describe('payment controller: getPaymentInfo', () => {
  const MODULE_PATH = '../../controllers/payment'; // ⬅️ adjust to your path

  let axiosMock;
  let infoSpy, errorSpy;
  let cfg;
  let payment;

  const makeReqRes = (partyId = 'prov-123') => {
    const req = { user: { partyId } };
    const res = { json: jasmine.createSpy('json') };
    return { req, res };
  };

  const loadModule = () => {
    const mod = proxyquire(MODULE_PATH, {
      axios: axiosMock,
      '../config': cfg,
      '../lib/logger': {
        logger: {
          getLogger: () => ({ info: infoSpy, error: errorSpy })
        }
      }
    });
    return mod.payment();
  };

  beforeEach(() => {
    axiosMock = { get: jasmine.createSpy('axios.get') };
    infoSpy = jasmine.createSpy('logger.info');
    errorSpy = jasmine.createSpy('logger.error');

    cfg = {
      paymentGateway: 'https://pay.example.com'
    };

    payment = loadModule();
  });

  it('calls backend, parses numeric string, and returns gatewaysCount + providerUrl', async () => {
    axiosMock.get.and.returnValue(Promise.resolve({ data: '3' }));
    const { req, res } = makeReqRes('abc-123');

    await payment.getPaymentInfo(req, res);

    expect(axiosMock.get).toHaveBeenCalledWith(
      `${cfg.paymentGateway}/api/product-providers/payment-gateways/count?productProviderExternalId=abc-123`
    );

    expect(res.json).toHaveBeenCalledWith({
      gatewaysCount: 3,
      providerUrl: `${cfg.paymentGateway}/provider-admin/#/login?productProviderId=abc-123`
    });

    expect(infoSpy).toHaveBeenCalledWith('%s: %s', 'Reading payment info from: ', 'abc-123');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('accepts a numeric body too (not only strings)', async () => {
    axiosMock.get.and.returnValue(Promise.resolve({ data: 7 }));
    const { req, res } = makeReqRes('p-777');

    await payment.getPaymentInfo(req, res);

    expect(res.json).toHaveBeenCalledWith({
      gatewaysCount: 7,
      providerUrl: `${cfg.paymentGateway}/provider-admin/#/login?productProviderId=p-777`
    });
  });

  it('handles "0" from backend', async () => {
    axiosMock.get.and.returnValue(Promise.resolve({ data: '0' }));
    const { req, res } = makeReqRes('p-0');

    await payment.getPaymentInfo(req, res);

    expect(res.json).toHaveBeenCalledWith({
      gatewaysCount: 0,
      providerUrl: `${cfg.paymentGateway}/provider-admin/#/login?productProviderId=p-0`
    });
  });

  it('logs and falls back to gatewaysCount=0 when axios throws', async () => {
    axiosMock.get.and.returnValue(Promise.reject(new Error('boom')));
    const { req, res } = makeReqRes('oops-1');

    await payment.getPaymentInfo(req, res);

    expect(res.json).toHaveBeenCalledWith({
      gatewaysCount: 0,
      providerUrl: `${cfg.paymentGateway}/provider-admin/#/login?productProviderId=oops-1`
    });

    expect(errorSpy).toHaveBeenCalledWith('%s: %s', 'Error getting payment gateways count', 'boom');
  });

  it('if backend returns a non-numeric string, current code returns NaN (documenting existing behavior)', async () => {
    axiosMock.get.and.returnValue(Promise.resolve({ data: 'not-a-number' }));
    const { req, res } = makeReqRes('weird-1');

    await payment.getPaymentInfo(req, res);

    const payload = res.json.calls.mostRecent().args[0];
    expect(payload.providerUrl).toBe(
      `${cfg.paymentGateway}/provider-admin/#/login?productProviderId=weird-1`
    );
    expect(Number.isNaN(payload.gatewaysCount)).toBe(true);
  });

  it('builds providerUrl with config.paymentGateway and partyId', async () => {
    axiosMock.get.and.returnValue(Promise.resolve({ data: '2' }));
    const { req, res } = makeReqRes('prov-xyz');

    await payment.getPaymentInfo(req, res);

    expect(res.json).toHaveBeenCalledWith({
      gatewaysCount: 2,
      providerUrl: 'https://pay.example.com/provider-admin/#/login?productProviderId=prov-xyz'
    });
  });
});
