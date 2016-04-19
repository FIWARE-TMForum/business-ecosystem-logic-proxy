var AccountingService = require('../db/schemas/accountingService'),
    config = require('../config'),
    uuid = require('node-uuid');

var authorizeService = (function () {

    /**
     * Generates am aìKey.
     */
    var generateApiKey = function (callback) {
        var apiKey = uuid.v4();

        return callback(apiKey);
    };

    /**
     * Check if the remote cliente is the WStore; otherwise return an error.
     */
    var checkRemoteClient = function (req, callback) {
        var storeHostname = config.appHost + ':' + config.endpoints.charging.port;
        var reqIp = req.ip.replace(/^.*:/, ''); // Parse IPv4 embedded in IPv6
        var remoteHostname = reqIp + ':' + req.connection.remotePort;

        if (remoteHostname === storeHostname) {
            return callback(null);
        } else {
            return callback('Invalid remote client');
        }
    }

    /**
     * Generates and send an apiKey for the url service specifed in the request body. The apiKey is saved in "uncommitted" state.
     *
     * @param  {Object} req    Incoming request.
     * @param  {Object} res    Outgoing object.
     */
    var getApiKey = function (req, res) {
        // Check if request is from WStore
        checkRemoteClient(req, function (err) {

            if (err) {
                res.status(401).json({error: err});

            } else {
                // Check the request and extract the url
                var url = JSON.parse(req.body).url;

                if (url) {

                    // Generate and save apiKey
                    generateApiKey(function (apiKey) {

                        var service = new AccountingService();
                        service.url = url;
                        service.apiKey = apiKey;
                        service.state = 'UNCOMMITTED';

                        service.save(function (err) {

                            if (err) {
                                res.status(500).send();

                            } else {

                                res.status(202).json({apiKey: apiKey});
                            }
                        });
                    });

                } else {
                    res.status(400).json({error: 'Url missing'});
                }
            }
        });
    };

    /**
     * Change the apiKey state to "commited".
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing response.
     */
    var commitApiKey = function (req, res) {
        // Check if request is from WStore
        checkRemoteClient(req, function (err) {

            if (err) {
                res.status(401).json({error: err});

            } else {

                // Update the apiKey state
                var apiKey = JSON.parse(req.body).apiKey;

                if (apiKey) {

                    var service = new AccountingService();
                    service.update({apiKey: apiKey}, { $set: {state: 'COMMITTED'}}, function (err, rawResp) {
                        if (err) {
                            res.status(500).send();
                        } else {
                            res.status(201).send();
                        }
                    });

                } else {
                    res.status(400).json({error: 'ApiKey missing'});
                }
            }
        });
    };

    return {
        getApiKey: getApiKey,
        commitApiKey: commitApiKey
    };

})();

exports.authorizeService = authorizeService;