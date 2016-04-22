var AccountingService = require('../db/schemas/accountingService'),
    config = require('../config'),
    uuid = require('node-uuid');

var authorizeService = (function () {

    /**
     * Generates am aìKey.
     */
    var generateApiKey = function () {
        var apiKey = uuid.v4();

        return apiKey;
    };

    /**
     * Check if the remote cliente is the WStore; otherwise return an error.
     */
    var checkRemoteClient = function (ip) {
        var storeHostname = config.appHost;
        var remoteHostname = ip.replace(/^.*:/, ''); // Parse IPv4 embedded in IPv6

        return remoteHostname === storeHostname;
    }

    /**
     * Generates and send an apiKey for the url service specifed in the request body. The apiKey is saved in "uncommitted" state.
     *
     * @param  {Object} req    Incoming request.
     * @param  {Object} res    Outgoing object.
     */
    var getApiKey = function (req, res) {
        // Check if request is from WStore
        var fromWStore = checkRemoteClient(req.ip);

        if (!fromWStore) {
            res.status(401).json({error: 'Invalid remote client'});

        } else {
            // Check the request and extract the url
            var url = JSON.parse(req.body).url;

            if (url) {

                // Generate and save apiKey
                var apiKey = generateApiKey();
                var service = new AccountingService();
                service.url = url;
                service.apiKey = apiKey;
                service.state = 'UNCOMMITTED';

                service.save(function (err) {

                    if (err) {
                        res.status(500).send();

                    } else {

                        res.status(201).json({apiKey: apiKey});
                    }
                });

            } else {
                res.status(400).json({error: 'Url missing'});
            }
        }
    };

    /**
     * Change the apiKey state to "commited".
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing response.
     */
    var commitApiKey = function (req, res) {
        // Check if request is from WStore
        var fromWStore = checkRemoteClient(req.ip);

        if (!fromWStore) {
            res.status(401).json({error: 'Invalid remote client'});

        } else {

            // Update the apiKey state
            var apiKey = req.params.apiKey;

            AccountingService.update({apiKey: apiKey}, { $set: {state: 'COMMITTED'}}, function (err, rawResp) {
                if (err) {
                    res.status(500).send();
                } else {
                    res.status(200).send();
                }
            });
        }
    };

    return {
        getApiKey: getApiKey,
        commitApiKey: commitApiKey
    };

})();

exports.authorizeService = authorizeService;