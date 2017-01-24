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

var management = require('../../controllers/management').management;

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
});
