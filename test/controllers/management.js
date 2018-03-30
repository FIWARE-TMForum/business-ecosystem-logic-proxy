/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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

const management = require('../../controllers/management').management;
const config = require('../utils.js').getDefaultConfig();
const proxyquire =  require('proxyquire');

describe('Management API', function () {

    describe('get count', function () {

        it('should return the correct size object when the param is included', function () {
            var req = {
                params: {
                    size: '10'
                }
            };

            var res = {
                json: function (val) {
                },
                end: function () {
                }
            };

            spyOn(res, 'json');
            spyOn(res, 'end');

            management.getCount(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.json).toHaveBeenCalledWith({
                size: '10'
            });
            expect(res.end).toHaveBeenCalledWith();
        });
    });
    describe('get version', function() {
        function getManagement() {
            return proxyquire('../../controllers/management', {
                '../config': config
            });
        };

        it('should return the valid value of version object', function() { 
            var res = {
                json: function (val) {
                },
                end: function () {
                }
            };
            var uptime = 90061;

            spyOn(res, 'json');
            spyOn(res, 'end');

            spyOn(process, 'uptime').and.returnValue(uptime);

            var manageCtl = getManagement().management;
            manageCtl.getVersion({}, res);

            expect(res.statusCode).toBe(200);
            expect(res.json).toHaveBeenCalledWith({
               version: config.version.version,
               release_date: config.version.releaseDate,
               uptime: '1 d, 1 h, 1 m, 1 s',
               git_hash: config.version.gitHash,
               doc: config.version.doc,
               user_doc: config.version.userDoc
            });
            expect(res.end).toHaveBeenCalledWith();
        });
    });
});
