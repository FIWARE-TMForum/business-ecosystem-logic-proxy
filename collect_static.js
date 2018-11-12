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
const compressor = require('node-minify');
const fs = require('fs');
const mergedirs = require('merge-dirs');
const path = require('path');

const staticPath = './static';

const debug = !(process.env.NODE_ENV == 'production');

const deleteContents = function (path) {
    fs.readdirSync(path).forEach((file) => {
        let curPath = path + "/" + file;

        if (fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteDir(curPath);
        } else { // delete file
            fs.unlinkSync(curPath);
        }
    });
};

const deleteDir = function (path) {
    deleteContents(path);
    fs.rmdirSync(path);
};

const loadTheme = function () {
    // Check if the provided theme exists
    if (!fs.existsSync('./themes/' + config.theme)) {
        console.log('The configured theme ' + config.theme + ' has not been provided');
        process.exit(1);
    }

    console.log('Loading Theme ' + config.theme);

    // Merge default files with theme ones
    mergedirs.default('./themes/' + config.theme, './static', 'overwrite');

    console.log('Theme loaded');
};

const minimizejs = function () {
    let files = [];
    let output = staticPath + '/public/resources/core/js/bae.min.js';

    let compileJs = (jsFile) => {
        if (jsFile.indexOf('.js') != -1) {
            files.push(jsFile);
            console.log('Including ' + jsFile);
        }
    };

    let compileFiles = (d) => fs.statSync(d).isDirectory() ? fs.readdirSync(d).map(f => compileFiles(path.join(d, f))) : compileJs(d);
    compileFiles(staticPath + '/public/resources/core/js');

    console.log('Generating ' + output);
    compressor.minify({
        compressor: 'gcc',
        input: files,
        output: output,
        callback: function (err, min) {
            files.forEach((f) => {
                fs.unlinkSync(f);
            });
            fs.rmdirSync(staticPath + '/public/resources/core/js/controllers');
            fs.rmdirSync(staticPath + '/public/resources/core/js/directives');
            fs.rmdirSync(staticPath + '/public/resources/core/js/services');
            fs.rmdirSync(staticPath + '/public/resources/core/js/routes');
        }
    });
};

const mergeLocales = function() {
    // Check if the plugin includes locales
    let localesDir = './themes/' + config.theme + '/locales'
    if (fs.existsSync(localesDir) && fs.statSync(localesDir).isDirectory()) {
        // Parse and merge files
        fs.readdirSync(localesDir).map(f => {
            let locale = path.join('./default_locales', f);
            let destLocale = path.join('./locales', f).replace('json', 'js');
            let localeJson;

            if (fs.existsSync(locale)) {
                // There is an existing locale, merge with the theme
                let themeLocaleJson = require('./' + path.join(localesDir, f));
                localeJson = require('./' + locale);

                Object.assign(localeJson, themeLocaleJson);

            } else {
                // There is not a locale, save it
                localeJson = require('./' + path.join(localesDir, f));
            }
            // Write new locale
            fs.open(destLocale, 'w', (err, fd) => {
                fs.writeSync(fd, JSON.stringify(localeJson));
                console.log('Locale ' + f + ' updated');
            });
        });
    }
}

// Check if a theme has been provided or the system is in production
if (!config.theme && debug) {
    console.log('The default theme is configured and debug mode is active, nothing to do');
    process.exit(1);
}

// Delete prev static files
if(fs.existsSync(staticPath)) {
    deleteContents(staticPath);
} else {
    fs.mkdirSync(staticPath);
}

// Copy default theme files
mergedirs.default('./views', './static/views', 'overwrite');
mergedirs.default('./public', './static/public', 'overwrite');

if (config.theme) {
    // If a theme has been provided merge it with default files
    loadTheme();
    mergeLocales();
}

if (!debug) {
    // If the system is in production compile jades and minimize js files
    minimizejs();
    console.log('JavaScript files minimized');
}