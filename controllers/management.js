/* Copyright (c) 2016 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
const config = require('../config');

var management = (function() {

    var getCount = function(req, res) {
        var size = req.params.size;
        res.statusCode = 200;
        res.json({
            size: size
        });
        res.end();
    };

    var getVersion = function(req, res) {
        var uptime = process.uptime();
        var days = Math.floor(uptime / 86400);
        var hours = Math.floor((uptime - (days * 86400)) / 3600);
        var minutes = Math.floor((uptime - (days * 86400) - (hours * 3600)) / 60);
        var seconds = Math.floor(uptime - (days * 86400) - (hours * 3600) - (minutes * 60));

        var upMsg = days + ' d, ' + hours + ' h, ' + minutes + ' m, ' + seconds + ' s';

        res.statusCode = 200;
        res.json({
            version: config.version.version,
            release_date: config.version.releaseDate,
            uptime: upMsg,
            git_hash: config.version.gitHash,
            doc: config.version.doc,
            user_doc: config.version.userDoc
        });
        res.end();
    };

    return {
        getCount: getCount,
        getVersion: getVersion
    };

})();

exports.management = management;
