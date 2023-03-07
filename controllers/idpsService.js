/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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

const idpModel = require('../db/schemas/idpModel');
const config = require('../config');

const idpService = (function() {

    let addProcessor = null;
    let removeProcessor = null;

    const getIdp = function(req, res) {
        const idpId = req.params.idpId;
        try {
            idpModel.findOne({idpId: idpId}, (err, result) => {
                if (err) {
                    res.status(500).json({ error: 'Unexpected error' });
                } else {
                    if (result) {
                        const response = {
                            name: result.name,
                            server: result.server,
                            idpId: result.idpId,
                            issuerDid: result.issuerDid,
                            description: result.description
                        }

                        res.statusCode = 200;
                        res.json(response);
                        res.end()
                    } else {
                        res.status(404).json({ error: 'Idp not found' });
                    }
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message + ' Invalid request' });
        }
    }

    const getIdps = function(req, res) {
        let query = {}

        if (req.query.search != null) {
            query = { $text: { $search: req.query.search } }
        }

        try {
            idpModel.find(query, (err, result) => {
                if (err) {
                    res.status(500).json({ error: 'Unexpected error' });
                } else {
                    const response = result.map((item) => {
                        return {
                            name: item.name,
                            server: item.server,
                            idpId: item.idpId,                          
                            issuerDid: item.issuerDid,
                            description: item.description
                        }
                    })
                    res.statusCode = 200;
                    res.json(response);
                    res.end();
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message + ' Invalid request' });
        }
    }

    const getDBIdps = function() {
        return new Promise((resolve, reject) => {
            idpModel.find({}, (err, result) => {
                if (err) {
                    return reject(err);
                }

                resolve(result);
            });
        });
    }

    const createIdp = function(req, res) {
        console.log(req.body);
        const data = JSON.parse(req.body);

        try {
            let idp = new idpModel();
            // Add custom fields
            idp.name = data.name;
            idp.idpId = data.idpId;
            idp.server = data.server;

            if (data.issuerDid) {
                idp.issuerDid = data.issuerDid;
            }

            if (data.description) {
                idp.description = data.description;
            }

            let marketUrl;
            if (config.proxy.enabled) {
                const proto = config.proxy.secured ? 'https' : 'http';
                const port = config.proxy.port != 443 && config.proxy.port != 80 ? ':' + config.proxy.port : '';
                marketUrl = `${proto}://${config.proxy.host}${port}`;
            } else {
                marketUrl = `http://${config.host}:${config.port}`;
            }

            // Add generated fields
            idp.provider = 'i4trust';
            idp.clientID = config.localEORI;
            idp.tokenKey = config.ishareKey;
            idp.tokenCrt = config.ishareCrt;
            idp.callbackURL = `${marketUrl}/auth/${idp.idpId}/callback`

            idp.save((err) => {
                if (err) {
                    if (err.message && err.message.startsWith('E11000')) {
                        res.status(409).json({ error: 'The provided IDP ID is already registered' });
                    } else {
                        res.status(500).json({ error: 'Unexpected error' });
                    }
                } else {
                    addProcessor(idp);

                    let slash = req.url.slice(-1) === '/' ? '' : '/';
                    res.statusCode = 200;
                    res.setHeader('location', req.url + slash + idp.idpId);
                    res.end();
                }
            });
        } catch (e) {
            console.log(e);
            res.status(500).json({ error: e.message + ' Invalid request' });
        }
    };

    const deleteIdp = function(req, res) {
        const idpId = req.params.idpId;
        try {
            idpModel.remove({idpId: idpId}, (err, result) => {
                if (err) {
                    res.status(500).json({ error: 'Unexpected error' });
                } else {
                    removeProcessor({idpId: idpId});
                    res.status(204).end();
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message + ' Invalid request' });
        }
    };

    const updateIdp = function(req, res) {
        const idpId = req.params.idpId;
        const data = JSON.parse(req.body);
        try {
            idpModel.findOne({idpId: idpId}, (err, result) => {
                if (err) {
                    res.status(500).json({ error: 'Unexpected error' });
                } else {
                    if (result) {
                        result.name = data.name;
                        result.description = data.description;
                        result.server = data.server;
                        result.issuerDid = data.issuerDid;

                        result.save((err) => {
                            if (err) {
                                console.log(err);
                                res.status(500).json({ error: 'Unexpected error' });
                            } else {
                                addProcessor(result);
                                res.statusCode = 200;
                                res.end();
                            }
                        });
                    } else {
                        res.status(404).json({ error: 'Idp not found' });
                    }
                }
            });
        } catch (e) {
            console.log(e);
            res.status(500).json({ error: e.message + ' Invalid request' });
        }
    }

    const setNewIdpProcessor = function setNewIdpProcessor(processor) {
        addProcessor = processor;
    }

    const setRemoveIdpProcessor = function setRemoveIdpProcessor(processor) {
        removeProcessor = processor;
    }

    return {
        getIdp: getIdp,
        getIdps: getIdps,
        getDBIdps, getDBIdps,
        createIdp: createIdp,
        deleteIdp: deleteIdp,
        updateIdp: updateIdp,
        setNewIdpProcessor: setNewIdpProcessor,
        setRemoveIdpProcessor: setRemoveIdpProcessor
    }
})();

exports.idpService = idpService;
