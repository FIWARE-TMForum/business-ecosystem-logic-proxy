const VCStrategy = require('./passport-vc').Strategy;


function strategy(config) {
    function buildProfile(profile, allowedRoles) {
        profile.organizations = [{
            id: config.provider,
            name: config.provider,
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
            allowedCredentialTypes: config.credentialTypes,
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