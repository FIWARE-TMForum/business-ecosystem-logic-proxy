const VCStrategy = require('./passport-vc').Strategy;


function strategy(config) {

    function buildStrategy(callback){
        const params = {
            verifierTokenURL: config.verifierHost + config.verifierTokenPath,
            verifierJWKSURL: config.verifierHost + config.verifierJWKSPath,
            redirectURI: config.callbackURL,
            allowedRoles: config.allowedRoles
        };

        return new VCStrategy(params, (accessToken, refreshToken, profile, done) => {
            callback(accessToken, refreshToken, profile, done);
        });
    }

    const getScope = () => {
        return [''];
    };

    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

exports.strategy = strategy;