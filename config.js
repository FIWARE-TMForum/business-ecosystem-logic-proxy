var config = {};

// The PORT used by 
config.port = 8004;
config.host = 'proxy.docker';

config.proxy = {
    enabled: false,
    host: '',
    secured: false,
    port: 80
}

// Set this var to undefined if you don't want the server to listen on HTTPS
config.https = {
    enabled: false,
    certFile: 'cert/cert.crt',
    keyFile: 'cert/key.key',
    caFile: 'cert/ca.crt',
    port: 443
};

// Express configuration
config.proxyPrefix = '';
config.portalPrefix = '';
config.logInPath = '/login';
config.logOutPath = '/logOut';
config.sessionSecret = 'keyboard cat';
config.theme = '';

// OAuth2 configuration
config.oauth2 = {
    'server': 'http://idm.docker:8000',
    'clientID': '',
    'clientSecret': '',
    'callbackURL': 'http://proxy.docker:8004/auth/fiware/callback',
    'isLegacy': false,
    'roles': {
        'admin': 'provider',
        'customer': 'customer',
        'seller': 'seller',
        'orgAdmin': 'manager'
    }
};

// Customer Role Required to buy items
config.customerRoleRequired = false;

// MongoDB
config.mongoDb = {
    server: 'mongo',
    port: 27017,
    user: '',
    password: '',
    db: 'belp'
};

// Configure endpoints
config.endpoints = {
    'management': {
        'path': 'management',
        'host': 'localhost',
        'port': config.port,
        'appSsl': config.https.enabled
    },
    'catalog': {
        'path': 'DSProductCatalog',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    },
    'ordering': {
        'path': 'DSProductOrdering',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    },
    'inventory': {
        'path': 'DSProductInventory',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    },
    'charging': {
        'path': 'charging',
        'host': 'charging.docker',
        'port': '8006',
        'appSsl': false
    },
    'rss': {
        'path': 'DSRevenueSharing',
        'host': 'rss.docker',
        'port': '8080',
        'appSsl': false
    },
    'party': {
        'path': 'DSPartyManagement',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    },
    'billing':{
        'path': 'DSBillingManagement',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    },
    'customer': {
        'path': 'DSCustomerManagement',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    },
    'usage':  {
        'path': 'DSUsageManagement',
        'host': 'apis.docker',
        'port': '8080',
        'appSsl': false
    }
};

// Percentage of the generated revenues that belongs to the system
config.revenueModel = 30;

// Tax rate
config.taxRate = 50;

// Billing Account owner role
config.billingAccountOwnerRole = 'bill receiver';

// list of paths that will not check authentication/authorization
// example: ['/public/*', '/static/css/']
config.publicPaths = [];

config.indexes = {
    'indexFile': 'elastic_indexes.js',
    'elasticHost': 'elastic.docker:9200'
};

config.magicKey = undefined;

config.usageChartURL = '';

module.exports = config;
