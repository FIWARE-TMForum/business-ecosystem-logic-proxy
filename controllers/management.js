/* Copyright (c) 2016 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

var management = (function() {

    var versionInfo = {
        version: '7.4.0',
        releaseDate: '23/10/2018',
        gitHash: '',
        doc: 'https://fiware-tmforum.github.io/Business-API-Ecosystem/v7.4.0/',
        userDoc: 'http://business-api-ecosystem.readthedocs.io/en/v7.4.0/'
    };

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
            version: versionInfo.version,
            release_date: versionInfo.releaseDate,
            uptime: upMsg,
            git_hash: versionInfo.gitHash,
            doc: versionInfo.doc,
            user_doc: versionInfo.userDoc
        });
        res.end();
    };

    return {
        getCount: getCount,
        getVersion: getVersion
    };

})();

exports.management = management;
