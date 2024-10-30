/* Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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

const proxyquire = require('proxyquire');

describe('Admin Controller', () => {

    const utils = {
        log: function() {},
        getAPIPort: function() {
            return 1234;
        },
        getAPIHost: function() {
            return 'example.com';
        },
        proxiedRequestHeaders: function() {
            return {
                Authorization: 'Bearer EXAMPLE',
                Accept: 'application/json'
            };
        },
        attachUserHeaders: function(headers, userInfo) {
            headers['X-Nick-Name'] = userInfo.partyId;
        }
    }

    const config = {
        oauth2: {
            roles: {
                admin: 'admin'
            }
        }
    }

    const getAdminInstance = function (axios, uuid) {
        let mocks = {
            'axios': axios,
            './../config': config,
            './../lib/utils': utils
        }

        if (uuid) {
            mocks.uuid = uuid
        }
        return proxyquire('../../controllers/admin', mocks).admin()
    }

    it('should redrect json request if the user is admin', (done) => {
        const data = {
            status: 'launched'
        }
        const body = JSON.stringify(data)

        const request = {
            headers: [],
            user: {
                partyId: '1234',
                roles: [{
                    name: 'admin'
                }]
            },
            apiUrl: '/admin/catalog/productSpec',
            method: 'PATCH',
            body: body
        }

        const axios = jasmine.createSpyObj('axios', ['request'])
        axios.request.and.returnValue(Promise.resolve({
            status: 200,
            headers: {
                'content-type': 'application/json'
            },
            data: data
        }))

        const response = jasmine.createSpyObj('res', ['status', 'setHeader', 'json'])

        let resPromise = new Promise((resolve, reject) => {
            response.json.and.callFake(() => {
                return resolve()
            })
        })

        const instance = getAdminInstance(axios)

        instance.checkPermissions(request, response)

        resPromise.then(() => {
            expect(axios.request).toHaveBeenCalledWith({
                url: 'http://example.com:1234/productSpec',
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer EXAMPLE',
                    Accept: 'application/json'
                },
                data: body
            })

            expect(response.status).toHaveBeenCalledWith(200)
            expect(response.setHeader).toHaveBeenCalledWith('content-type', 'application/json')
            expect(response.json).toHaveBeenCalledWith(data)
            done()
        })
    })

    it('should redirect media request if the user is admin', (done) => {
        const request = {
            headers: {
                'if-modified-since': '',
                'if-none-match': ''
            },
            user: {
                partyId: '1234',
                roles: [{
                    name: 'admin'
                }]
            },
            apiUrl: '/admin/charging/media/uploadJob',
            method: 'PUT'
        }

        const axios = jasmine.createSpyObj('axios', ['request'])
        axios.request.and.returnValue(Promise.resolve({
            status: 200,
            headers: {
                'content-type': 'image/png'
            },
            data: {}
        }))

        const response = jasmine.createSpyObj('res', ['status', 'setHeader', 'write', 'end'])
        let resPromise = new Promise((resolve, reject) => {
            response.end.and.callFake(() => {
                return resolve()
            })
        })

        const instance = getAdminInstance(axios)

        instance.checkPermissions(request, response)

        resPromise.then(() => {
            expect(axios.request).toHaveBeenCalledWith({
                url: 'http://example.com:1234/media/uploadJob',
                method: 'PUT',
                headers: {
                    Authorization: 'Bearer EXAMPLE',
                    Accept: 'application/json',
                    'cache-control': 'no-cache'
                },
                responseType: 'arraybuffer'
            })

            expect(response.status).toHaveBeenCalledWith(200)
            expect(response.setHeader).toHaveBeenCalledWith('content-type', 'image/png')
            expect(response.write).toHaveBeenCalledWith({})
            done()
        })
    })

    const testErrorManagement = (error, status, msg, done) => {
        const data = {
            status: 'launched'
        }
        const body = JSON.stringify(data)

        const request = {
            headers: [],
            user: {
                partyId: '1234',
                roles: [{
                    name: 'admin'
                }]
            },
            apiUrl: '/admin/catalog/productSpec',
            method: 'PATCH',
            body: body
        }

        const axios = jasmine.createSpyObj('axios', ['request'])
        axios.request.and.returnValue(Promise.reject(error))

        const response = jasmine.createSpyObj('res', ['status', 'setHeader', 'json'])

        let resPromise = new Promise((resolve, reject) => {
            response.json.and.callFake(() => {
                return resolve()
            })
        })

        const instance = getAdminInstance(axios)

        instance.checkPermissions(request, response)

        resPromise.then(() => {
            expect(axios.request).toHaveBeenCalledWith({
                url: 'http://example.com:1234/productSpec',
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer EXAMPLE',
                    Accept: 'application/json'
                },
                data: body
            })

            expect(response.status).toHaveBeenCalledWith(status)
            expect(response.setHeader).not.toHaveBeenCalled()
            expect(response.json).toHaveBeenCalledWith({
                error: msg
            })
            done()
        })
    }

    it('should return the error is raised by the API', (done) => {
        testErrorManagement({
            response: {
                status: 400,
                data: {
                    error: 'An error'
                }
            },
        }, 400, 'An error', done)
    })

    it('should return an error if there is a comunication failure', (done) => {
        testErrorManagement({}, 504, 'Service unreachable', done)
    })

    it('should return a 403 error if the user is not an admin', (done) => {
        const request = {
            user: {
                partyId: '1234',
                roles: []
            }
        }

        const axios = jasmine.createSpyObj('axios', ['request'])
        const response = jasmine.createSpyObj('res', ['status', 'setHeader', 'json'])

        let resPromise = new Promise((resolve, reject) => {
            response.json.and.callFake(() => {
                return resolve()
            })
        })

        const instance = getAdminInstance(axios)

        instance.checkPermissions(request, response)

        resPromise.then(() => {
            expect(axios.request).not.toHaveBeenCalled()

            expect(response.status).toHaveBeenCalledWith(403)
            expect(response.setHeader).not.toHaveBeenCalled()
            expect(response.json).toHaveBeenCalledWith({
                error: "You are not authorized to access admin endpoint"
            })
            done()
        })
    })

    const testCertificateUpload = function(user, done) {
        const vc = '1234567899'
        const data = {
            vc: vc
        }
        const body = JSON.stringify(data)

        const request = {
            headers: [],
            params: {
                specId: '1'
            },
            user: user,
            apiUrl: '/admin/uploadcertificate/1',
            method: 'PATCH',
            body: body
        }

        const respBody = {
            productSpecCharacteristic: [{
                name: 'char1'
            }, {
                name: 'Compliance:VC'
            }]
        }

        const axios = jasmine.createSpyObj('axios', ['request'])
        axios.request.and.returnValue(Promise.resolve({
            status: 200,
            headers: {
                'content-type': 'application/json'
            },
            data: respBody
        }))

        const response = jasmine.createSpyObj('res', ['status', 'setHeader', 'json'])

        let resPromise = new Promise((resolve, reject) => {
            response.json.and.callFake(() => {
                return resolve()
            })
        })

        const instance = getAdminInstance(axios, {
            v4: () => {
                return '1234'
            }
        })

        instance.uploadCertificate(request, response)

        resPromise.then(() => {
            expect(axios.request).toHaveBeenCalledTimes(2); // Check the number of calls

            expect(axios.request.calls.argsFor(0)).toEqual([{
                url: 'http://example.com:1234/productSpecification/1',
                method: 'GET'
            }]);

            expect(axios.request.calls.argsFor(1)).toEqual([{
                url: 'http://example.com:1234/productSpecification/1',
                method: 'PATCH',
                headers: {
                  'content-type': 'application/json'
                },
                data: {
                  productSpecCharacteristic: [
                    { name: 'char1' },
                    {
                      id: 'urn:ngsi-ld:characteristic:1234',
                      name: 'Compliance:VC',
                      productSpecCharacteristicValue: [
                        { isDefault: true, value: vc }
                      ]
                    }
                  ]
                }
            }]);

            expect(response.status).toHaveBeenCalledWith(200)
            expect(response.setHeader).toHaveBeenCalledWith('content-type', 'application/json')
            expect(response.json).toHaveBeenCalledWith(respBody)
            done()
        })
    }

    it('should allow to upload VC if the user is an admin', (done) => {
        testCertificateUpload({
            partyId: '1234',
            roles: [{
                name: 'admin',
            }]
        }, done)
    })

    it('should allow to upload VC if the user is a certifier', (done) => {
        testCertificateUpload({
            partyId: '1234',
            roles: [{
                name: 'certifier',
            }]
        }, done)
    })

    it('should allow to upload VC if the user organization is certifier', (done) => {
        testCertificateUpload({
            partyId: '1234',
            roles: [],
            organizations: [{
                roles: [{
                    name: 'seller'
                }]
            }, {
                roles: [{
                    name: 'certifier'
                }]
            }]
        }, done)
    })

    const testCertificateError = (axios, request, code, msg, validator, done) => {
        const response = jasmine.createSpyObj('res', ['status', 'setHeader', 'json'])

        let resPromise = new Promise((resolve, reject) => {
            response.json.and.callFake(() => {
                return resolve()
            })
        })

        const instance = getAdminInstance(axios)

        instance.uploadCertificate(request, response)

        resPromise.then(() => {
            validator()

            expect(response.status).toHaveBeenCalledWith(code)
            expect(response.setHeader).not.toHaveBeenCalled()
            expect(response.json).toHaveBeenCalledWith({
                error: msg
            })
            done()
        })
    }

    const testUploadCertificateError = (request, code, msg, done) => {
        const axios = jasmine.createSpyObj('axios', ['request'])

        const validator = () => {
            expect(axios.request).not.toHaveBeenCalled()
        }
        testCertificateError(axios, request, code, msg, validator, done)
    }

    it('should fail if the user is not authorized to upload a VC certificate', (done) => {
        const request = {
            user: {
                partyId: '1234',
                roles: [],
                organizations: [{
                    roles: [{
                        name: 'seller'
                    }]
                }]
            }
        }

        testUploadCertificateError(request, 403, "You are not authorized to upload certificates", done)
    })

    it('should return an error if the body is not a valid JSON when uploading a VC', (done) => {
        const request = {
            headers: [],
            params: {
                specId: '1'
            },
            user: {
                partyId: '1234',
                roles: [{
                    name: 'admin',
                }]
            },
            apiUrl: '/admin/uploadcertificate/1',
            method: 'PATCH',
        }

        testUploadCertificateError(request, 400, "Invalid body", done)
    })

    it('should return an error if the VC is not provided', (done) => {
        const request = {
            headers: [],
            params: {
                specId: '1'
            },
            user: {
                partyId: '1234',
                roles: [{
                    name: 'admin',
                }]
            },
            apiUrl: '/admin/uploadcertificate/1',
            method: 'PATCH',
            body: '{}'
        }

        testUploadCertificateError(request, 400, "Missing VC", done)
    })

    it('should return an error if the product spec is not found', (done) => {
        const axios = jasmine.createSpyObj('axios', ['request'])
        axios.request.and.returnValue(Promise.reject({
            status: 404
        }))

        const request = {
            headers: [],
            params: {
                specId: '1'
            },
            user: {
                partyId: '1234',
                roles: [{
                    name: 'admin',
                }]
            },
            apiUrl: '/admin/uploadcertificate/1',
            method: 'PATCH',
            body: JSON.stringify({vc: '1234'})
        }

        const validator = () => {
            expect(axios.request).toHaveBeenCalled()
        }
        testCertificateError(axios, request, 404, "The product spec does not exists", validator, done)
    })
})
