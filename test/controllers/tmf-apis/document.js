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

const proxyquire = require('proxyquire').noCallThru();

describe('Document API', function() {
    const getDocumentAPI = function(utils) {
        return proxyquire('../../../controllers/tmf-apis/document', {
            './../../lib/utils': utils
        }).document;
    };

    describe('Check Permissions', function() {
        const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

        methods.forEach((method) => {
            it(`should require authentication for ${method} requests`, function(done) {
                const authError = {
                    status: 401,
                    message: 'You need to be authenticated to create/update/delete resources'
                };

                const utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake((req, callback) => callback(authError));

                const documentAPI = getDocumentAPI(utils);

                documentAPI.checkPermissions({ method: method }, function(err) {
                    expect(utils.validateLoggedIn).toHaveBeenCalled();
                    expect(err).toEqual(authError);
                    done();
                });
            });

            it(`should allow authenticated ${method} requests`, function(done) {
                const utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake((req, callback) => callback(null));

                const documentAPI = getDocumentAPI(utils);

                documentAPI.checkPermissions({ method: method }, function(err) {
                    expect(utils.validateLoggedIn).toHaveBeenCalled();
                    expect(err).toBe(null);
                    done();
                });
            });
        });
    });

    it('should not add post-validation errors', function(done) {
        const documentAPI = getDocumentAPI({});

        documentAPI.executePostValidation({}, function(err) {
            expect(err).toBe(null);
            done();
        });
    });

    it('should not transform API errors', function(done) {
        const documentAPI = getDocumentAPI({});

        documentAPI.handleAPIError({}, function(err) {
            expect(err).toBe(null);
            done();
        });
    });
});
