/* Copyright (c) 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

const config = require('./config');
const fs = require('fs');
const mergedirs = require('merge-dirs');

const staticPath = './static';

const deleteDir = function (path) {
    if(fs.existsSync(path)) {
        fs.readdirSync(path).forEach((file) => {
            let curPath = path + "/" + file;

            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteDir(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

// Check if a theme has been provided
if (!config.theme) {
    console.log('The default theme is configured, nothing to do');
    process.exit(1);
}

// Check if the provided theme exists
if (!fs.existsSync('./themes/' + config.theme)) {
    console.log('The configured theme ' + config.theme + ' has not been provided');
    process.exit(1);
}

// Delete prev static files
deleteDir(staticPath);
fs.mkdirSync(staticPath);

// Copy default theme files
mergedirs.default('./views', './static/views', 'overwrite');
mergedirs.default('./public', './static/public', 'overwrite');

// Merge default files with theme ones
mergedirs.default('./themes/' + config.theme, './static', 'overwrite');

console.log('Theme loaded');