const VCStrategy = require('./passport-vc').Strategy;


function strategy(config) {
    function buildProfile(profile) {
        profile.organizations = [{
            id: config.provider,
            name: config.provider,
            roles: [{
                'name': config.roles.seller,
                'id': config.roles.seller
            }, {
                'name': config.roles.customer,
                'id': config.roles.customer
            }, {
                'name': config.roles.orgAdmin,
                'id': config.roles.orgAdmin
            }]
        }];
    }

    function buildStrategy(callback){
        const params = {
            verifierTokenURL: config.server + config.verifierTokenPath,
            redirectURI: config.callbackURL,
            credentialType: config.credentialType
        };

        return new VCStrategy(params, (accessToken, refreshToken, profile, done) => {
            buildProfile(profile);

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