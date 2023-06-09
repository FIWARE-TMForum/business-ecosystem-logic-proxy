const VCStrategy = require('./passport-vc').Strategy;


function strategy(config) {
    function buildProfile(profile, allowedRoles) {
        profile.organizations = [{
            id: profile.idpId,
            name: profile.idpId,
            roles: allowedRoles.map(role => ({
                'name': role,
                'id': role
            }))
        }];
    }

    function buildStrategy(callback){
        const params = {
            verifierTokenURL: config.verifierHost + config.verifierTokenPath,
            verifierJWKSURL: config.verifierHost + config.verifierJWKSPath,
            redirectURI: config.callbackURL,
            allowedRoles: config.allowedRoles
        };

        return new VCStrategy(params, (accessToken, refreshToken, profile, done) => {
            buildProfile(profile, config.allowedRoles);

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