/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */
(function() {
    'use strict';

    angular
        .module('app')
        .config(['$stateProvider', RSSRouteConfig])
        .controller('RouteRSSCtl', ['$state', RSSController]);

    function RSSRouteConfig($stateProvider) {
        $stateProvider.state('rss', {
            url: '/rss',
            data: {
                title: 'Revenue Sharing',
                loggingRequired: true
            },
            views: {
                'sidebar-content': {
                    templateUrl: 'rss/sidebar',
                    controller: 'RouteRSSCtl'
                },
                content: {
                    template: '<ui-view>'
                }
            }
        });
    }

    function RSSController($state) {
        if ($state.is('rss')) {
            $state.go('rss.models');
        }
    }
})();
