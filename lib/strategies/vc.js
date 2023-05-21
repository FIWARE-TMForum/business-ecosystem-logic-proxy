const VCStrategy = require('./passport-vc').Strategy;


function strategy(config) {
    function buildProfile(profile) {
        if (!profile.email) {
            profile.email = profile._json.email;
        }

        if (!profile.username) {
            profile.username = profile._json.username;
        }

        if (!profile.displayName) {
            profile.displayName = profile._json.displayName;
        }

        profile.roles = [{
            name: config.roles.seller,
            id: config.roles.seller
        }];

        profile.organizations = [];
    }

    function buildStrategy(callback){
        const params = {
            verifierTokenURL: config.server + config.verifierTokenPath,
            redirectURI: config.callbackURL
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