var defaultConfig = {
    proxyPrefix: '',
    oauth2: {
        server: 'https://account.lab.fiware.org',
        roles: {
            admin: 'provider',
            seller: 'seller'
        }
    },
    appHost: 'example.com',
    endpoints: {
        'catalog': {
            'path': 'catalog',
            'port': '99'
        },
        'ordering': {
            'path': 'ordering',
            'port': '189'
        },
        'inventory': {
            'path': 'inventory',
            'port': '475'
        },
        'charging': {
            'path': 'charging',
            'port': '35'
        },
        'rss': {
            'path': 'rss',
            'port': '753'
        }
    }
};

exports.getDefaultConfig = function() {
    // Return a copy to avoid side effects
    return JSON.parse(JSON.stringify(defaultConfig));
};

var emptyFunction = function() {};
exports.emptyLogger = {
    logger: {
        getLogger: function() {
            return {
                'info': emptyFunction,
                'warn': emptyFunction,
                'err': emptyFunction
            }
        }
    }
};