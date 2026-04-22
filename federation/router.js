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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const express = require('express');
const url = require('url');
const catalogController = require('./controllers/catalog').catalog;
const getByIdController = require('./controllers/getById').getById;
const federationProxy = require('./lib/proxy').proxy;

const router = express.Router();

const CATALOG_COLLECTION_ENTITIES = new Set(['productOffering', 'catalog']);

const getPathSegments = function(req) {
    const apiUrl = req && typeof req.apiUrl === 'string' ? req.apiUrl : '';
    const path = apiUrl.split('?')[0];
    return path.split('/').filter((segment) => segment.length > 0);
};

const isCatalogCollectionRequest = function(pathSegments) {
    if (!Array.isArray(pathSegments) || pathSegments.length < 2) {
        return false;
    }

    return pathSegments[0] === 'catalog' && CATALOG_COLLECTION_ENTITIES.has(pathSegments[pathSegments.length - 1]);
};

const proxyFederationRequest = async function(req, res) {
    req.apiUrl = url.parse(req.url).path;

    try {
        const pathSegments = getPathSegments(req);
        if (isCatalogCollectionRequest(pathSegments)) {
            const result = await catalogController.preprocessRequest(req);
            return await federationProxy.get(req, res, result.targets, result.entity);
        }

        const byIdResult = await getByIdController.preprocessRequest(req);
        return await federationProxy.getById(req, res, byIdResult);
    } catch (err) {
        if (err && err.status) {
            return res.status(err.status).json({
                error: err.message || 'Unexpected error'
            });
        }

        if (err && err.response) {
            return res.status(err.response.status).json(err.response.data);
        }

        return res.status(504).json({ error: 'Service unreachable' });
    }
};

router.get('/catalog/:catalogObject', proxyFederationRequest);
router.get('/catalog/:catalogObject/*', proxyFederationRequest);
router.get('/:api/:entity/:id', proxyFederationRequest);

exports.router = router;
