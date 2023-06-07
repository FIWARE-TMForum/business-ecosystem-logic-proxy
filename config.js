const url = require('url');

var config = {};

// The PORT used by 
config.port = 8004;
config.host = 'proxy.docker';

config.proxy = {
    enabled: false,
    host: '',
    secured: false,
    port: 80
};

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
//'server': 'http://34.213.26.168:8000/',
config.oauth2 = {
    provider: 'fiware',
    server: 'http://idm.docker:3000',
    clientID: '19dd858c-328c-4642-93ab-da45e4d253ae',
    clientSecret: '09ffe023-a242-46a3-bd83-9277d36e2379',
    callbackURL: 'http://proxy.docker:8004/auth/fiware/callback',
    oidc: true,
    oidcScopes: "openid",
    oidcDiscoveryURI: null,
    oidcTokenEndpointAuthMethod: "client_secret_basic",
    key: '281e126aa35c80f2',
    defaultRole: null,
    roles: {
        admin: 'admin',
        customer: 'customer',
        seller: 'seller',
        orgAdmin: 'manager'
    }
};

/*config.oauth2 = {
    provider: 'keycloak',
    server: 'http://keycloak.docker:8080',
    clientID: 'bae',
    clientSecret: 'df68d1b9-f85f-4b5e-807c-c8be3ba27388',
    callbackURL: 'http://proxy.docker:8004/auth/keycloak/callback',
    realm: 'bae',
    oidc: true,
    key: '281e126aa35c80f2',
    roles: {
        admin: 'admin',
        customer: 'customer',
        seller: 'seller',
        orgAdmin: 'manager'
    }
}*/

/*config.oauth2 = {
    provider: 'github',
    clientID: '',
    clientSecret: '',
    callbackURL: 'http://proxy.docker:8004/auth/github/callback',
    roles: {
        admin: 'admin',
        customer: 'customer',
        seller: 'seller',
        orgAdmin: 'manager'
    }
}*/

config.oauth2 = {
    provider: 'vc',
    callbackURL: 'http://proxy.docker:8004/auth/vc/callback',
    clientID: 'some_id',
    server: 'https://verifier.apps.fiware.fiware.dev',
    verifierQRCodePath: '/api/v1/loginQR',
    verifierTokenPath: '/token',
    verifierJWKSPath: '/.well-known/jwks',
    credentialType: ['VerifiableCredential', 'MarketplaceUserCredential'],
    roles: {
        admin: 'admin',
        customer: 'customer',
        seller: 'seller',
        orgAdmin: 'orgAdmin'
    }
};

config.siop = {
    clientID: process.env.BAE_LP_CCS_CLIENT_ID || 'some_id'
};

config.extLogin = false;
config.showLocalLogin = false;
config.externalIdps = []
config.propagateToken = true;
config.allowLocalEORI = false;

config.editParty = true;

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
    management: {
        path: 'management',
        host: 'localhost',
        port: config.port,
        appSsl: config.https.enabled
    },
    catalog: {
        path: 'DSProductCatalog',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    ordering: {
        path: 'DSProductOrdering',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    inventory: {
        path: 'DSProductInventory',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    charging: {
        path: 'charging',
        host: 'charging.docker',
        port: '8006',
        appSsl: false
    },
    rss: {
        path: 'DSRevenueSharing',
        host: 'rss.docker',
        port: '8080',
        appSsl: false
    },
    party: {
        path: 'DSPartyManagement',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    billing: {
        path: 'DSBillingManagement',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    customer: {
        path: 'DSCustomerManagement',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    usage:  {
        path: 'DSUsageManagement',
        host: 'apis.docker',
        port: '8080',
        appSsl: false
    },
    sla: {
        path: 'SLAManagement',
        host: 'localhost',
        port: config.port,
        appSsl: false
    },
    reputation: {
        path: 'REPManagement',
        host: 'localhost',
        port: config.port,
        appSsl: false
    },
    idp: {
        path: 'IDP',
        host: 'localhost',
        port: config.port,
        appSsl: false
    }
};

// Percentage of the generated revenues that belongs to the system
config.revenueModel = 30;

// Tax rate
config.taxRate = 20;

// Billing Account owner role
config.billingAccountOwnerRole = 'bill receiver';

// list of paths that will not check authentication/authorization
// example: ['/public/*', '/static/css/']
config.publicPaths = [];

config.indexes = {
    'elasticHost': 'elastic.docker:9200',
    'apiVersion': '7.5'
};

config.magicKey = undefined;

config.usageChartURL = '';

// Override default config with environ
/////////////////////////////////////////////////////////////////////
////////////////////////// CONFIG CHECKERS //////////////////////////
/////////////////////////////////////////////////////////////////////
const checkPrefix = function(prefix, byDefault) {
    let finalPrefix = prefix === undefined ? byDefault : prefix;

    // Remove the last slash
    if (finalPrefix.slice(-1) == '/') {
        finalPrefix = finalPrefix.slice(0, -1);
    }

    // If a prefix is set, the prefix MUST start with a slash
    // When the prefix is not set, the slash is NOT required
    if (finalPrefix.length > 0 && finalPrefix.charAt(0) !== '/') {
        finalPrefix = '/' + finalPrefix;
    }

    return finalPrefix;
};

config.port = process.env.BAE_LP_PORT || config.port || 8004;
config.endpoints.management.port = config.port;

config.host = process.env.BAE_LP_HOST || config.host || 'localhost';

// Check proxy URL config config
if (!!process.env.BAE_SERVICE_HOST) {
    // If this var is enabled, the service is accessible in a different URL
    let parsedUrl = url.parse(process.env.BAE_SERVICE_HOST);
    let secured = parsedUrl.protocol == 'https:';
    let port = parsedUrl.port

    if (port == null) {
        port = secured ? 443 : 80;
    }

    config.proxy = {
        enabled: true,
        host: parsedUrl.hostname,
        port: port,
        secured: secured
    };
}

// HTTPS Configuration
config.https = config.https || {};
config.https.enabled = process.env.BAE_LP_HTTPS_ENABLED || config.https.enabled;
config.https.certFile = process.env.BAE_LP_HTTPS_CERT || config.https.certFile;
config.https.caFile = process.env.BAE_LP_HTTPS_CA || config.https.caFile;
config.https.keyFile = process.env.BAE_LP_HTTPS_KEY || config.https.keyFile;
config.https.port = process.env.BAE_LP_HTTPS_PORT || config.https.port;

// OAuth2 Configuration
if (!!process.env.BAE_LP_EXT_LOGIN) {
    config.extLogin = process.env.BAE_LP_EXT_LOGIN == 'true';
}

if (!!process.env.BAE_LP_SHOW_LOCAL_LOGIN) {
    config.showLocalLogin = process.env.BAE_LP_SHOW_LOCAL_LOGIN == 'true';
}

if (!!process.env.BAE_LP_PROPAGATE_TOKEN) {
    config.propagateToken = process.env.BAE_LP_PROPAGATE_TOKEN == 'true';
}

if (!!process.env.BAE_LP_ALLOW_LOCAL_EORI) {
    config.allowLocalEORI = process.env.BAE_LP_ALLOW_LOCAL_EORI == 'true';
}

if (!!process.env.BAE_LP_EDIT_PARTY) {
    config.editParty = process.env.BAE_LP_EDIT_PARTY == 'true';
}

config.oauth2.provider = process.env.BAE_LP_OAUTH2_PROVIDER || config.oauth2.provider;
config.oauth2.server = process.env.BAE_LP_OAUTH2_SERVER || config.oauth2.server;
config.oauth2.clientID = process.env.BAE_LP_OAUTH2_CLIENT_ID || config.oauth2.clientID;
config.oauth2.clientSecret = process.env.BAE_LP_OAUTH2_CLIENT_SECRET || config.oauth2.clientSecret;
config.oauth2.callbackURL = process.env.BAE_LP_OAUTH2_CALLBACK || config.oauth2.callbackURL;

if (process.env.BAE_LP_OAUTH2_DEFAULT_ROLE) {
    config.oauth2.defaultRole = process.env.BAE_LP_OAUTH2_DEFAULT_ROLE;
}

if (!!process.env.BAE_LP_OIDC_ENABLED) {
    config.oauth2.oidc = process.env.BAE_LP_OIDC_ENABLED == 'true';
}

config.oauth2.oidcScopes = process.env.BAE_LP_OIDC_SCOPES || config.oauth2.oidcScopes;
config.oauth2.oidcTokenEndpointAuthMethod = process.env.BAE_LP_OIDC_TOKEN_AUTH_METHOD || config.oauth2.oidcTokenEndpointAuthMethod;
if (process.env.BAE_LP_OIDC_DISCOVERY_URI) {
    config.oauth2.oidcDiscoveryURI = process.env.BAE_LP_OIDC_DISCOVERY_URI;
}

config.oauth2.key = process.env.BAE_LP_OIDC_KEY || config.oauth2.key;
config.oauth2.realm = process.env.BAE_LP_OIDC_REALM || config.oauth2.realm;

config.oauth2.tokenCrt = process.env.BAE_LP_OIDC_TOKEN_CRT || config.oauth2.tokenCrt;
config.oauth2.tokenKey = process.env.BAE_LP_OIDC_TOKEN_KEY || config.oauth2.tokenKey;

config.oauth2.roles.admin = process.env.BAE_LP_OAUTH2_ADMIN_ROLE || config.oauth2.roles.admin;
config.oauth2.roles.seller = process.env.BAE_LP_OAUTH2_SELLER_ROLE || config.oauth2.roles.seller;
config.oauth2.roles.customer = process.env.BAE_LP_OAUTH2_CUSTOMER_ROLE || config.oauth2.roles.customer;
config.oauth2.roles.orgAdmin = process.env.BAE_LP_OAUTH2_ORG_ADMIN_ROLE || config.oauth2.roles.orgAdmin;

if (!!process.env.BAE_LP_OAUTH2_IS_LEGACY) {
    config.oauth2.isLegacy = process.env.BAE_LP_OAUTH2_IS_LEGACY == 'true';
}

// Theme config
config.theme = process.env.BAE_LP_THEME || config.theme;

// URL config
config.sessionSecret = config.sessionSecret || 'keyboard cat';
config.proxyPrefix = checkPrefix(config.proxyPrefix, '');
config.portalPrefix = checkPrefix(config.portalPrefix, '');
config.shoppingCartPath = checkPrefix(config.shoppingCartPath, '/shoppingCart');
config.authorizeServicePath = checkPrefix(config.authorizeServicePath, '/authorizeService');
config.apiKeyServicePath = checkPrefix(config.apiKeyServicePath, '/apiKeyService');
config.slaServicePath = checkPrefix(config.slaServicePath, '/SLAManagement');
config.reputationServicePath = checkPrefix(config.reputationServicePath, '/REPManagement');
config.recommendationServicePath = checkPrefix(config.recommendationServicePath, '/RECManagement');
config.idpServicePath = checkPrefix(config.idpServicePath, '/IDP');
config.logInPath = config.logInPath || '/login';
config.logOutPath = config.logOutPath || '/logout';


// Endpoint config
// =====

// Catalog
config.endpoints.catalog.path = process.env.BAE_LP_ENDPOINT_CATALOG_PATH || config.endpoints.catalog.path;
config.endpoints.catalog.port = process.env.BAE_LP_ENDPOINT_CATALOG_PORT || config.endpoints.catalog.port;
config.endpoints.catalog.host = process.env.BAE_LP_ENDPOINT_CATALOG_HOST || config.endpoints.catalog.host;

if (!!process.env.BAE_LP_ENDPOINT_CATALOG_SECURED) {
    config.endpoints.catalog.appSsl = process.env.BAE_LP_ENDPOINT_CATALOG_SECURED == 'true';
}

// Ordering
config.endpoints.ordering.path = process.env.BAE_LP_ENDPOINT_ORDERING_PATH || config.endpoints.ordering.path;
config.endpoints.ordering.port = process.env.BAE_LP_ENDPOINT_ORDERING_PORT || config.endpoints.ordering.port;
config.endpoints.ordering.host = process.env.BAE_LP_ENDPOINT_ORDERING_HOST || config.endpoints.ordering.host;

if (!!process.env.BAE_LP_ENDPOINT_ORDERING_SECURED) {
    config.endpoints.ordering.appSsl = process.env.BAE_LP_ENDPOINT_ORDERING_SECURED == 'true';
}

// Inventory
config.endpoints.inventory.path = process.env.BAE_LP_ENDPOINT_INVENTORY_PATH || config.endpoints.inventory.path;
config.endpoints.inventory.port = process.env.BAE_LP_ENDPOINT_INVENTORY_PORT || config.endpoints.inventory.port;
config.endpoints.inventory.host = process.env.BAE_LP_ENDPOINT_INVENTORY_HOST || config.endpoints.inventory.host;

if (!!process.env.BAE_LP_ENDPOINT_INVENTORY_SECURED) {
    config.endpoints.inventory.appSsl = process.env.BAE_LP_ENDPOINT_INVENTORY_SECURED == 'true';
}

// Charging
config.endpoints.charging.path = process.env.BAE_LP_ENDPOINT_CHARGING_PATH || config.endpoints.charging.path;
config.endpoints.charging.port = process.env.BAE_LP_ENDPOINT_CHARGING_PORT || config.endpoints.charging.port;
config.endpoints.charging.host = process.env.BAE_LP_ENDPOINT_CHARGING_HOST || config.endpoints.charging.host;

if (!!process.env.BAE_LP_ENDPOINT_CHARGING_SECURED) {
    config.endpoints.charging.appSsl = process.env.BAE_LP_ENDPOINT_CHARGING_SECURED == 'true';
}

// RSS
config.endpoints.rss.path = process.env.BAE_LP_ENDPOINT_RSS_PATH || config.endpoints.rss.path;
config.endpoints.rss.port = process.env.BAE_LP_ENDPOINT_RSS_PORT || config.endpoints.rss.port;
config.endpoints.rss.host = process.env.BAE_LP_ENDPOINT_RSS_HOST || config.endpoints.rss.host;

if (!!process.env.BAE_LP_ENDPOINT_RSS_SECURED) {
    config.endpoints.rss.appSsl = process.env.BAE_LP_ENDPOINT_RSS_SECURED == 'true';
}

// Party
config.endpoints.party.path = process.env.BAE_LP_ENDPOINT_PARTY_PATH || config.endpoints.party.path;
config.endpoints.party.port = process.env.BAE_LP_ENDPOINT_PARTY_PORT || config.endpoints.party.port;
config.endpoints.party.host = process.env.BAE_LP_ENDPOINT_PARTY_HOST || config.endpoints.party.host;

if (!!process.env.BAE_LP_ENDPOINT_PARTY_SECURED) {
    config.endpoints.party.appSsl = process.env.BAE_LP_ENDPOINT_PARTY_SECURED == 'true';
}

// Billing
config.endpoints.billing.path = process.env.BAE_LP_ENDPOINT_BILLING_PATH || config.endpoints.billing.path;
config.endpoints.billing.port = process.env.BAE_LP_ENDPOINT_BILLING_PORT || config.endpoints.billing.port;
config.endpoints.billing.host = process.env.BAE_LP_ENDPOINT_BILLING_HOST || config.endpoints.billing.host;

if (!!process.env.BAE_LP_ENDPOINT_BILLING_SECURED) {
    config.endpoints.billing.appSsl = process.env.BAE_LP_ENDPOINT_BILLING_SECURED == 'true';
}

// Customer
config.endpoints.customer.path = process.env.BAE_LP_ENDPOINT_CUSTOMER_PATH || config.endpoints.customer.path;
config.endpoints.customer.port = process.env.BAE_LP_ENDPOINT_CUSTOMER_PORT || config.endpoints.customer.port;
config.endpoints.customer.host = process.env.BAE_LP_ENDPOINT_CUSTOMER_HOST || config.endpoints.customer.host;

if (!!process.env.BAE_LP_ENDPOINT_CUSTOMER_SECURED) {
    config.endpoints.customer.appSsl = process.env.BAE_LP_ENDPOINT_CUSTOMER_SECURED == 'true';
}

// Usage
config.endpoints.usage.path = process.env.BAE_LP_ENDPOINT_USAGE_PATH || config.endpoints.usage.path;
config.endpoints.usage.port = process.env.BAE_LP_ENDPOINT_USAGE_PORT || config.endpoints.usage.port;
config.endpoints.usage.host = process.env.BAE_LP_ENDPOINT_USAGE_HOST || config.endpoints.usage.host;

if (!!process.env.BAE_LP_ENDPOINT_USAGE_SECURED) {
    config.endpoints.usage.appSsl = process.env.BAE_LP_ENDPOINT_USAGE_SECURED == 'true';
}

// ======
// MongoDB Config
config.mongoDb = config.mongoDb || {};
config.mongoDb.user = process.env.BAE_LP_MONGO_USER || config.mongoDb.user || '';
config.mongoDb.password = process.env.BAE_LP_MONGO_PASS || config.mongoDb.password || '';
config.mongoDb.server = process.env.BAE_LP_MONGO_SERVER || config.mongoDb.server || 'localhost';
config.mongoDb.port = process.env.BAE_LP_MONGO_PORT || config.mongoDb.port || 27017;
config.mongoDb.db = process.env.BAE_LP_MONGO_DB || config.mongoDb.db || 'belp';

// Revenue Sharing and tax rate
config.revenueModel =
    (config.revenueModel !== undefined && config.revenueModel !== null && config.revenueModel >= 0 && config.revenueModel <= 100) ? config.revenueModel : 30;

config.revenueModel =
    !!process.env.BAE_LP_REVENUE_MODEL &&
    Number(process.env.BAE_LP_REVENUE_MODEL) >= 0 &&
    Number(process.env.BAE_LP_REVENUE_MODEL) <= 100
        ? Number(process.env.BAE_LP_REVENUE_MODEL)
        : config.revenueModel;

config.taxRate =
    (config.taxRate !== undefined && config.taxRate !== null && config.taxRate >= 0 && config.taxRate <= 100) ? config.taxRate : 30;

config.taxRate =
    !!process.env.BAE_LP_TAX_RATE &&
    Number(process.env.BAE_LP_TAX_RATE) >= 0 &&
    Number(process.env.BAE_LP_TAX_RATE) <= 100
        ? Number(process.env.BAE_LP_TAX_RATE)
        : config.taxRate;

config.usageChartURL = process.env.BAE_LP_USAGE_CHART || config.usageChartURL;

// Index engine
config.indexes.elasticHost = process.env.BAE_LP_INDEX_URL || config.indexes.elasticHost;
config.indexes.apiVersion = process.env.BAE_LP_INDEX_API_VERSION || config.indexes.apiVersion;

// External IDPs configs
if (config.extLogin) {
    config.localEORI = process.env.BAE_EORI;
    config.ishareKey = process.env.BAE_TOKEN_KEY;
    config.ishareCrt = process.env.BAE_TOKEN_CRT;
}
module.exports = config;
