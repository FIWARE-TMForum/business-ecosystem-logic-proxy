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

var defaultConfig = {
    port: 7496,
    proxyPrefix: '',
    oauth2: {
        server: 'https://account.lab.fiware.org',
        roles: {
            admin: 'provider',
            seller: 'seller',
            customer: 'customer'
        }
    },
    appHost: 'example.com',
    appSsl: false,
    endpoints: {
        catalog: {
            path: 'catalog',
            port: 99
        },
        ordering: {
            path: 'ordering',
            port: 189
        },
        inventory: {
            path: 'inventory',
            port: 475
        },
        charging: {
            path: 'charging',
            port: 35
        },
        rss: {
            path: 'rss',
            port: 753
        },
        party: {
            path: 'party',
            port: 74
        },
        billing: {
            path: 'billing',
            port: 78
        },
        customer: {
            path: 'customer',
            port: 82
        },
        usage: {
            path: 'usage',
            port: 78
        }
    },
    billingAccountOwnerRole: 'bill receiver',
    revenueModel: 30
};

exports.getDefaultConfig = function() {
    // Return a copy to avoid side effects
    return JSON.parse(JSON.stringify(defaultConfig));
};

var emptyFunction = function() {};
exports.emptyLogger = {
    logger: {
        getLogger: function() {
            return {
                'info': emptyFunction,
                'warn': emptyFunction,
                'error': emptyFunction
            }
        }
    }
};