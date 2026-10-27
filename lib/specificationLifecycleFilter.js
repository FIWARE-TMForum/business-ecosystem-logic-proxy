/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const url = require('url');

// Multi-status queries are filtered locally because upstream OR queries can
// return incomplete pages. Each controller supplies its specification collection.
exports.createSpecificationLifecycleFilter = function(resourceName) {
    const paginationState = Symbol(resourceName + 'LifecyclePagination');

    const prepare = function(req, callback) {
        const parsedUrl = url.parse(req.apiUrl || req.url || req.path || '');
        const params = new URLSearchParams(parsedUrl.query || '');
        const getParam = (name) => req.query && req.query[name] != null
            ? req.query[name]
            : params.getAll(name).join(',');
        const statuses = String(getParam('lifecycleStatus') || '')
            .split(',')
            .map((status) => status.trim().toLowerCase())
            .filter((status) => status.length > 0);
        const limit = parseInt(getParam('limit'), 10);
        const pathname = parsedUrl.pathname || '';

        if (req.method !== 'GET' ||
            !pathname.replace(/\/$/, '').endsWith('/' + resourceName) ||
            statuses.length <= 1 || isNaN(limit) || limit <= 0) {
            return callback(null);
        }

        params.delete('lifecycleStatus');
        const fingerprintParams = new URLSearchParams(params);
        fingerprintParams.delete('offset');
        fingerprintParams.delete('limit');

        const paginationConfig = {
            fingerprint: [pathname, fingerprintParams.toString(), statuses.slice().sort().join(',')].join('|'),
            predicate: (item) => statuses.indexOf(String(item && item.lifecycleStatus || '').toLowerCase()) >= 0
        };

        const fields = String(getParam('fields') || '');
        if (fields && !fields.split(',').some((field) => field.trim() === 'lifecycleStatus')) {
            // Fetch the status for filtering, then restore the requested projection.
            params.set('fields', fields + ',lifecycleStatus');
            if (req.query) {
                req.query.fields = fields + ',lifecycleStatus';
            }
            paginationConfig.transformItem = (item) => {
                const projectedItem = Object.assign({}, item);
                delete projectedItem.lifecycleStatus;
                return projectedItem;
            };
        }

        req.apiUrl = pathname + '?' + params.toString();
        if (req.query) {
            delete req.query.lifecycleStatus;
        }
        req[paginationState] = paginationConfig;
        callback(null);
    };

    return {
        prepare: prepare,
        getFilteredPaginationConfig: (req) => req.method === 'GET' ? req[paginationState] || null : null
    };
};
