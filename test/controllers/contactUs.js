/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
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

const proxyquire = require('proxyquire').noCallThru();

describe('ContactUs Controller', () => {
    let axiosMock;
    let utilsMock;
    let configMock;
    let loggerErrorSpy;
    let controller;
    const contactPayload = {
        firstName: 'Fran',
        lastName: 'asdsda',
        email: 'cosos@email.cm',
        organization: 'asdsadd',
        roleInOrganization: 'dddd',
        message: 'asddas asdkjadk asdkjhak sdhaksd',
        privacyAccepted: true,
        marketingAccepted: true
    };
    const formattedMessage = [
        'New contact-us request',
        'First name: Fran',
        'Last name: asdsda',
        'Email: cosos@email.cm',
        'Organization: asdsadd',
        'Role in organization: dddd',
        'Privacy accepted: Yes',
        'Marketing accepted: Yes',
        '',
        'Message:',
        'asddas asdkjadk asdkjhak sdhaksd'
    ].join('<br>');

    const loadController = () => {
        return proxyquire('../../controllers/contactUs', {
            axios: axiosMock,
            '../config': configMock,
            '../lib/utils': utilsMock,
            '../lib/logger': {
                logger: {
                    getLogger: () => ({ error: loggerErrorSpy })
                }
            }
        }).contactUs();
    };

    const makeResponse = () => {
        const res = jasmine.createSpyObj('res', ['status', 'send']);
        res.status.and.returnValue(res);
        return res;
    };

    beforeEach(() => {
        axiosMock = jasmine.createSpy('axios');
        utilsMock = {
            getAPIURL: jasmine.createSpy('getAPIURL').and.returnValue('http://charging.example.com/default-notify')
        };
        loggerErrorSpy = jasmine.createSpy('logger.error');

        configMock = {
            contactUsNotificationUrl: '',
            endpoints: {
                charging: {
                    appSsl: false,
                    host: 'charging.example.com',
                    port: '8006',
                    apiPath: ''
                }
            }
        };

        controller = loadController();
    });

    it('should forward request payload to configured contact notification URL', async () => {
        configMock.contactUsNotificationUrl = 'http://charging.example.com/custom-notify';
        controller = loadController();

        const req = {
            body: JSON.stringify(contactPayload)
        };
        const res = makeResponse();

        axiosMock.and.returnValue(Promise.resolve({ status: 202, data: { sent: true } }));

        await controller.sendNotification(req, res);

        expect(axiosMock).toHaveBeenCalledWith({
            method: 'POST',
            url: 'http://charging.example.com/custom-notify',
            data: {
                subject: 'New contact-us request',
                message: formattedMessage
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.send).toHaveBeenCalledWith({ sent: true });
    });

    it('should build default URL from charging endpoint when no override is configured', async () => {
        const req = {
            body: JSON.stringify(contactPayload)
        };
        const res = makeResponse();

        axiosMock.and.returnValue(Promise.resolve({ status: 200, data: { ok: true } }));

        await controller.sendNotification(req, res);

        expect(utilsMock.getAPIURL).toHaveBeenCalledWith(
            false,
            'charging.example.com',
            '8006',
            '/charging/api/orderManagement/notify/configured'
        );
        expect(axiosMock).toHaveBeenCalledWith(
            jasmine.objectContaining({
                data: {
                    subject: 'New contact-us request',
                    message: formattedMessage
                }
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith({ ok: true });
    });

    it('should return 400 when request body is not valid JSON', async () => {
        const req = {
            body: '{invalid-json}'
        };
        const res = makeResponse();

        await controller.sendNotification(req, res);

        expect(axiosMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith('Invalid JSON body');
    });

    it('should propagate backend errors with response payload', async () => {
        const req = {
            body: JSON.stringify(contactPayload)
        };
        const res = makeResponse();

        axiosMock.and.returnValue(
            Promise.reject({
                response: {
                    status: 422,
                    data: { error: 'Validation failed' }
                },
                message: 'Bad Request'
            })
        );

        await controller.sendNotification(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.send).toHaveBeenCalledWith({ error: 'Validation failed' });
    });

    it('should return 500 when backend request fails without response payload', async () => {
        const req = {
            body: JSON.stringify(contactPayload)
        };
        const res = makeResponse();

        axiosMock.and.returnValue(Promise.reject(new Error('Network error')));

        await controller.sendNotification(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith('Internal Server Error');
        expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should escape HTML and preserve new lines in message body', async () => {
        configMock.contactUsNotificationUrl = 'http://charging.example.com/custom-notify';
        controller = loadController();

        const req = {
            body: JSON.stringify({
                firstName: '<Fran>',
                lastName: 'de la vega',
                email: 'asdasd@asdas.com',
                organization: 'org',
                roleInOrganization: 'role',
                message: 'line1\n<b>line2</b>',
                privacyAccepted: true,
                marketingAccepted: false
            })
        };
        const res = makeResponse();

        axiosMock.and.returnValue(Promise.resolve({ status: 200, data: { sent: true } }));

        await controller.sendNotification(req, res);

        expect(axiosMock).toHaveBeenCalledWith(
            jasmine.objectContaining({
                data: {
                    subject: 'New contact-us request',
                    message:
                        'New contact-us request<br>' +
                        'First name: &lt;Fran&gt;<br>' +
                        'Last name: de la vega<br>' +
                        'Email: asdasd@asdas.com<br>' +
                        'Organization: org<br>' +
                        'Role in organization: role<br>' +
                        'Privacy accepted: Yes<br>' +
                        'Marketing accepted: No<br>' +
                        '<br>' +
                        'Message:<br>' +
                        'line1<br>&lt;b&gt;line2&lt;/b&gt;'
                }
            })
        );
    });
});
