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

/**
 * @author Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .factory('Utils', UtilsService);

    function UtilsService() {

        function getGlassfishErrorHtmlProperty(html, property) {
            var regExp = new RegExp('<p><b>' + property + '</b>(.*?)</p>');
            return regExp.exec(html)[1];    // Exception thrown if not match
        }

        return {
            parseError: parseError
        };

        function parseError(response, defaultMessage) {

            var finalErrorMessage = defaultMessage;

            var data = response['data'];

            if (angular.isString(response) && response.length) {
                return response;
            }

            if (typeof(data) === 'string') {
                // HTML

                try {
                    var type = getGlassfishErrorHtmlProperty(data, 'type');
                    var message = getGlassfishErrorHtmlProperty(data, 'message');
                    var description = getGlassfishErrorHtmlProperty(data, 'description');

                    finalErrorMessage = type + ' - ' + message + ': ' + description;

                } catch (e) {
                    finalErrorMessage = data;
                }

            } else if (data !== null && typeof(data) === 'object' && 'error' in data) {
                // JSON
                if (typeof(data['error']) === 'object' && 'title' in data['error']) {
                    finalErrorMessage = data['error']['title'];
                } else {
                    finalErrorMessage = data['error'];
                }
            }

            return finalErrorMessage;
        }

    }

})();