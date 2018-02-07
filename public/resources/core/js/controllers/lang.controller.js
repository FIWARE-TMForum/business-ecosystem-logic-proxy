/* Copyright (c) 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

(function () {

    'use strict';

    angular
        .module('app')
        .controller('LangCtrl', ['$cookies', '$window', LangController]);

    function LangController($cookies, $window) {
        const vm = this;
        const cookie = 'lang';

        const setlocale = function(locale) {
            $cookies.put(cookie, locale);
            // Refresh current view
            $window.location.reload();
        }

        // Check if the locale cookie is alrady set
        let currCookie = $cookies.get(cookie);

        // If not set include browser preference
        if (!currCookie) {
            currCookie = navigator.language || navigator.userLanguage;
            setlocale(currCookie);
        }

        vm.locale = currCookie;
        vm.onLocaleChange = function() {
            setlocale(vm.locale);
        }
    }

})();