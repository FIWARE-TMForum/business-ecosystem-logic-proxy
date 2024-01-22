/* Copyright (c) 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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


const versionInfo = require('./versionInfo').versionInfo;

const management = (function() {

    const getVersion = function(req, res) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime - days * 86400) / 3600);
        const minutes = Math.floor((uptime - days * 86400 - hours * 3600) / 60);
        const seconds = Math.floor(uptime - days * 86400 - hours * 3600 - minutes * 60);

        const upMsg = days + ' d, ' + hours + ' h, ' + minutes + ' m, ' + seconds + ' s';

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
        getVersion: getVersion
    };
})();

exports.management = management;
