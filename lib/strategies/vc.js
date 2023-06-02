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
        const allowedRoles = [config.roles.seller, config.roles.customer]
        const params = {
            verifierTokenURL: config.server + config.verifierTokenPath,
            verifierJWKSURL: config.server + config.verifierJWKSPath,
            redirectURI: config.callbackURL,
            allowedCredentialType: config.credentialType,
            allowedRoles: allowedRoles
        };

        return new VCStrategy(params, (accessToken, refreshToken, profile, done) => {
            buildProfile(profile, allowedRoles);

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