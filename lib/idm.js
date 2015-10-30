var config = require('../config.js'),
    httpClient = require('./HTTPClient.js');

var log = require('./logger').logger.getLogger("IDM-Client");

var idm = (function() {

    var //{token: {userInfo: {}, date: Date}}
        tokensCache = {};

    var checkNonCachedToken = function(token, callback, callbackError) {
        log.info('Token in cache expired or non existing');
        delete tokensCache[token];

        log.info('Checking token with IDM...');

        var options = {
            host: config.keystoneHost,
            port: config.keystonePort,
            path: '/v3/access-tokens/' + encodeURIComponent(token),
            method: 'GET',
            headers: {'Accept': 'application/json'}
        }

        httpClient.request('http', options, undefined, undefined, function (status, resp) {
            var userInfo = JSON.parse(resp);
            tokensCache[token] = {};
            tokensCache[token].date = new Date();
            tokensCache[token].userInfo = userInfo;
            callback(userInfo);
        }, callbackError);
    } 

    var checkToken = function(token, callback, callbackError) {
        
        if (tokensCache[token]) {
            
            log.info('Token in cache, checking timestamp...');
            var currentTime = (new Date()).getTime();
            var tokenTime = tokensCache[token].date.getTime();

            if (currentTime - tokenTime < config.chacheTime * 1000) {
                tokensCache[token].date = new Date();
                callback(tokensCache[token].userInfo); 
            } else {
                checkNonCachedToken(token, callback, callbackError);
            }
        } else {
            checkNonCachedToken(token, callback, callbackError);
        }
    };

    return {
        checkToken: checkToken
    }

})();

exports.idm = idm;