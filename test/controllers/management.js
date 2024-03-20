/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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

describe('Management API', function () {

    describe('get version', function() {
        it('should return the valid value of version object', function() {
            const res = {
                json: function(val) {},
                end: function() {}
            };
            const uptime = 90061;
            const expVersion = {
                versionInfo: {
                    version: 'develop',
                    releaseDate: '',
                    gitHash: '',
                    doc: 'https://fiware-tmforum.github.io/Business-API-Ecosystem/',
                    userDoc: 'http://business-api-ecosystem.readthedocs.io/en/develop'
                }
            }

            spyOn(res, 'json');
            spyOn(res, 'end');

            spyOn(process, 'uptime').and.returnValue(uptime);

            versionInfo = expVersion;

            const management = proxyquire('../../controllers/management', {
                './versionInfo': expVersion
            }).management;

            management.getVersion({}, res);

            expect(res.statusCode).toBe(200);
            expect(res.json).toHaveBeenCalledWith({
               version: expVersion.versionInfo.version,
               release_date: expVersion.versionInfo.releaseDate,
               uptime: '1 d, 1 h, 1 m, 1 s',
               git_hash: expVersion.versionInfo.gitHash,
               doc: expVersion.versionInfo.doc,
               user_doc: expVersion.versionInfo.userDoc
            });
            expect(res.end).toHaveBeenCalledWith();
        });
    });
});
