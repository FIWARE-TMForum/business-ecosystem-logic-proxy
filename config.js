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
	defaultRole: null
};

config.roles = {
    admin: 'admin',
    customer: 'Buyer',
    seller: 'Seller',
    orgAdmin: 'orgAdmin',
    certifier: 'certifier',
    sellerOperator: 'SellerOperator',
    buyerOperator: 'BuyerOperator'
}

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

config.siop = {
    enabled: process.env.BAE_LP_SIOP_ENABLED === 'true',
    provider: 'vc',
    isRedirection: process.env.BAE_LP_SIOP_IS_REDIRECTION === 'true',
    pollPath: '/poll',
    pollCertPath: '/cert/poll',
    clientID: process.env.BAE_LP_SIOP_CLIENT_ID || 'some_id',
    privateKey: process.env.BAE_LP_SIOP_PRIVATE_KEY,
    privateKeyPem: process.env.BAE_LP_SIOP_PRIVATE_KEY_PEM,
    callbackURL: process.env.BAE_LP_SIOP_CALLBACK_PATH || 'http://proxy.docker:8004/auth/vc/callback',
    requestUri: process.env.BAE_LP_SIOP_REQUEST_URI || '/auth/vc/request.jwt',
    verifierHost: process.env.BAE_LP_SIOP_VERIFIER_HOST || 'https://verifier.apps.fiware.fiware.dev',
    verifierQRCodePath: process.env.BAE_LP_SIOP_VERIFIER_QRCODE_PATH || '/api/v1/loginQR',
    verifierTokenPath: process.env.BAE_LP_SIOP_VERIFIER_TOKEN_PATH || '/token',
    verifierJWKSPath: process.env.BAE_LP_SIOP_VERIFIER_JWKS_PATH || '/.well-known/jwks',
    allowedRoles: process.env.BAE_LP_SIOP_ALLOWED_ROLES
        ? process.env.BAE_LP_SIOP_ALLOWED_ROLES.split(',')
        : {
              customer: 'customer',
              seller: 'seller'
          },
    operators: process.env.BAE_LP_SIOP_OPERATORS ? process.env.BAE_LP_SIOP_OPERATORS.split(',') : [],
    signAlgorithm: process.env.BAE_LP_SIO_SIGN_ALGORITHM || 'ES256'
};

config.extLogin = false;
config.showLocalLogin = false;
config.showVCLogin = process.env.BAE_LP_SIOP_ENABLED === 'true';
config.externalIdps = [];
config.propagateToken = true;
config.allowLocalEORI = false;

config.editParty = true;

config.domeTrust = process.env.BAE_LP_DOME_TRUST;

config.domeAbout = process.env.BAE_LP_DOME_ABOUT || 'https://dome-marketplace.eu/about/';
config.domeRegister = process.env.BAE_LP_DOME_REGISTER || 'https://dome-marketplace.github.io/onboarding/';
config.domePublish =
    process.env.BAE_LP_DOME_PUBLISH || 'https://knowledgebase.dome-marketplace.org/shelves/company-onboarding-process';

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
        apiPath: '',
        host: 'localhost',
        port: config.port,
        appSsl: config.https.enabled
    },
    catalog: {
        path: 'catalog',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8632',
        appSsl: false
    },
    resource: {
        path: 'resource',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8636',
        appSsl: false
    },
    service: {
        path: 'service',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8637',
        appSsl: false
    },
    ordering: {
        path: 'ordering',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8634',
        appSsl: false
    },
    inventory: {
        path: 'inventory',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8635',
        appSsl: false
    },
    serviceInventory: {
        path: 'serviceInventory',
        apiPath: '',
        //host: 'charging.docker',
        host: 'bae-marketplace-biz-ecosystem-charging-backend.marketplace.svc.cluster.local',
        port: '8006',
        appSsl: false
    },
    resourceInventory: {
        path: 'resourceInventory',
        apiPath: '',
        //host: 'host.docker.internal',
        //port: '8641',
        host: 'tmforum-tm-forum-api-resource-inventory',
        port: '8080',
        appSsl: false
    },
    charging: {
        path: 'charging',
        apiPath: '',
        host: 'charging.docker',
        port: '8006',
        appSsl: false
    },
    rss: {
        path: 'rss',
        apiPath: '',
        host: 'charging.docker',
        port: '8006',
        appSsl: false
    },
    party: {
        path: 'party',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8633',
        appSsl: false
    },
    account: {
        path: 'account',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8639',
        appSsl: false
    },
    customer: {
        path: 'customer',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8637',
        appSsl: false
    },
    usage: {
        path: 'usage',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8638',
        appSsl: false
    },
    billing: {
        path: 'billing',
        apiPath: '',
        host: 'host.docker.internal',
        port: '8640'
    },
    sla: {
        path: 'SLAManagement',
        apiPath: '',
        host: 'localhost',
        port: config.port,
        appSsl: false
    },
    reputation: {
        path: 'REPManagement',
        apiPath: '',
        host: 'localhost',
        port: config.port,
        appSsl: false
    },
    idp: {
        path: 'IDP',
        apiPath: '',
        host: 'localhost',
        port: config.port,
        appSsl: false
    },
    quote: {
        path: 'quote',
        apiPath: '',
        host: 'quote-management.marketplace.svc.cluster.local',
        port: '8080'
    },
    revenue: {
        path: 'revenue',
        apiPath: '/revenue',
        host: 'revenue-engine-svc.billing.svc.cluster.local',
        port: '8080'
    },
    invoicing: {
        path: 'invoicing',
        apiPath: '/invoicing',
        host: 'invoicing-service-svc.billing.svc.cluster.local',
        port: '8080'
    },
    search: {
        path: 'search-bck',
        apiPath: '',
        host: 'search-service-svc.billing.svc.cluster.local',
        port: '8080'
    },
    ai: {
        path: 'ai',
        apiPath: '',
        host: 'dome.expertcustomers.ai',
        port: '443',
        appSsl: true
    }
};

// Percentage of the generated revenues that belongs to the system
config.revenueModel = 30;

// Tax rate
config.taxRate = 20;

// list of paths that will not check authentication/authorization
// example: ['/public/*', '/static/css/']
config.publicPaths = [];

config.indexes = {
    elasticHost: 'https://elastic.docker:9200',
    user: 'elastic',
    password: '+S284gwQI+U1THU--C29'
};

config.magicKey = undefined;

config.usageChartURL = '';

// Override default config with environ
/////////////////////////////////////////////////////////////////////
////////////////////////// CONFIG CHECKERS //////////////////////////
/////////////////////////////////////////////////////////////////////
const checkPrefix = function (prefix, byDefault) {
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
    let port = parsedUrl.port;

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
config.oauth2.oidcTokenEndpointAuthMethod =
    process.env.BAE_LP_OIDC_TOKEN_AUTH_METHOD || config.oauth2.oidcTokenEndpointAuthMethod;
if (process.env.BAE_LP_OIDC_DISCOVERY_URI) {
    config.oauth2.oidcDiscoveryURI = process.env.BAE_LP_OIDC_DISCOVERY_URI;
}

config.oauth2.key = process.env.BAE_LP_OIDC_KEY || config.oauth2.key;
config.oauth2.realm = process.env.BAE_LP_OIDC_REALM || config.oauth2.realm;

config.oauth2.tokenCrt = process.env.BAE_LP_OIDC_TOKEN_CRT || config.oauth2.tokenCrt;
config.oauth2.tokenKey = process.env.BAE_LP_OIDC_TOKEN_KEY || config.oauth2.tokenKey;

config.roles.admin = process.env.BAE_LP_OAUTH2_ADMIN_ROLE || config.roles.admin;
config.roles.seller = process.env.BAE_LP_OAUTH2_SELLER_ROLE || config.roles.seller;
config.roles.customer = process.env.BAE_LP_OAUTH2_CUSTOMER_ROLE || config.roles.customer;
config.roles.orgAdmin = process.env.BAE_LP_OAUTH2_ORG_ADMIN_ROLE || config.roles.orgAdmin;
config.roles.certifier = process.env.BAE_LP_OAUTH2_ORG_CERTIFIER_ROLE || config.roles.certifier;

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
config.promotionServicePath = checkPrefix(config.promotionServicePath, '/PromManagement');
config.idpServicePath = checkPrefix(config.idpServicePath, '/IDP');
config.logInPath = config.logInPath || '/login';
config.logOutPath = config.logOutPath || '/logout';

// Endpoint config
// =====

// Catalog
config.endpoints.catalog.apiPath = process.env.BAE_LP_ENDPOINT_CATALOG_PATH || config.endpoints.catalog.apiPath;
config.endpoints.catalog.port = process.env.BAE_LP_ENDPOINT_CATALOG_PORT || config.endpoints.catalog.port;
config.endpoints.catalog.host = process.env.BAE_LP_ENDPOINT_CATALOG_HOST || config.endpoints.catalog.host;

if (!!process.env.BAE_LP_ENDPOINT_CATALOG_SECURED) {
    config.endpoints.catalog.appSsl = process.env.BAE_LP_ENDPOINT_CATALOG_SECURED == 'true';
}

// Resource Catalog
config.endpoints.resource.apiPath = process.env.BAE_LP_ENDPOINT_RESOURCE_PATH || config.endpoints.resource.apiPath;
config.endpoints.resource.port = process.env.BAE_LP_ENDPOINT_RESOURCE_PORT || config.endpoints.resource.port;
config.endpoints.resource.host = process.env.BAE_LP_ENDPOINT_RESOURCE_HOST || config.endpoints.resource.host;

if (!!process.env.BAE_LP_ENDPOINT_RESOURCE_SECURED) {
    config.endpoints.resource.appSsl = process.env.BAE_LP_ENDPOINT_RESOURCE_SECURED == 'true';
}

// Service Catalog
config.endpoints.service.apiPath = process.env.BAE_LP_ENDPOINT_SERVICE_PATH || config.endpoints.service.apiPath;
config.endpoints.service.port = process.env.BAE_LP_ENDPOINT_SERVICE_PORT || config.endpoints.service.port;
config.endpoints.service.host = process.env.BAE_LP_ENDPOINT_SERVICE_HOST || config.endpoints.service.host;

if (!!process.env.BAE_LP_ENDPOINT_SERVICE_SECURED) {
    config.endpoints.service.appSsl = process.env.BAE_LP_ENDPOINT_SERVICE_SECURED == 'true';
}

// Ordering
config.endpoints.ordering.apiPath = process.env.BAE_LP_ENDPOINT_ORDERING_PATH || config.endpoints.ordering.apiPath;
config.endpoints.ordering.port = process.env.BAE_LP_ENDPOINT_ORDERING_PORT || config.endpoints.ordering.port;
config.endpoints.ordering.host = process.env.BAE_LP_ENDPOINT_ORDERING_HOST || config.endpoints.ordering.host;

if (!!process.env.BAE_LP_ENDPOINT_ORDERING_SECURED) {
    config.endpoints.ordering.appSsl = process.env.BAE_LP_ENDPOINT_ORDERING_SECURED == 'true';
}

// Inventory
config.endpoints.inventory.apiPath = process.env.BAE_LP_ENDPOINT_INVENTORY_PATH || config.endpoints.inventory.apiPath;
config.endpoints.inventory.port = process.env.BAE_LP_ENDPOINT_INVENTORY_PORT || config.endpoints.inventory.port;
config.endpoints.inventory.host = process.env.BAE_LP_ENDPOINT_INVENTORY_HOST || config.endpoints.inventory.host;

if (!!process.env.BAE_LP_ENDPOINT_INVENTORY_SECURED) {
    config.endpoints.inventory.appSsl = process.env.BAE_LP_ENDPOINT_INVENTORY_SECURED == 'true';
}

// Service Inventory
config.endpoints.serviceInventory.apiPath =
    process.env.BAE_LP_ENDPOINT_SERVICE_INVENTORY_PATH || config.endpoints.serviceInventory.apiPath;
config.endpoints.serviceInventory.port =
    process.env.BAE_LP_ENDPOINT_SERVICE_INVENTORY_PORT || config.endpoints.serviceInventory.port;
config.endpoints.serviceInventory.host =
    process.env.BAE_LP_ENDPOINT_SERVICE_INVENTORY_HOST || config.endpoints.serviceInventory.host;

if (!!process.env.BAE_LP_ENDPOINT_SERVICE_INVENTORY_SECURED) {
    config.endpoints.serviceInventory.appSsl = process.env.BAE_LP_ENDPOINT_SERVICE_INVENTORY_SECURED == 'true';
}

// Resource Intentory
config.endpoints.resourceInventory.apiPath =
    process.env.BAE_LP_ENDPOINT_RESOURCE_INVENTORY_PATH || config.endpoints.resourceInventory.apiPath;
config.endpoints.resourceInventory.port =
    process.env.BAE_LP_ENDPOINT_RESOURCE_INVENTORY_PORT || config.endpoints.resourceInventory.port;
config.endpoints.resourceInventory.host =
    process.env.BAE_LP_ENDPOINT_RESOURCE_INVENTORY_HOST || config.endpoints.resourceInventory.host;

if (!!process.env.BAE_LP_ENDPOINT_RESOURCE_INVENTORY_SECURED) {
    config.endpoints.resourceInventory.appSsl = process.env.BAE_LP_ENDPOINT_RESOURCE_INVENTORY_SECURED == 'true';
}

// Charging
config.endpoints.charging.apiPath = process.env.BAE_LP_ENDPOINT_CHARGING_PATH || config.endpoints.charging.apiPath;
config.endpoints.charging.port = process.env.BAE_LP_ENDPOINT_CHARGING_PORT || config.endpoints.charging.port;
config.endpoints.charging.host = process.env.BAE_LP_ENDPOINT_CHARGING_HOST || config.endpoints.charging.host;

if (!!process.env.BAE_LP_ENDPOINT_CHARGING_SECURED) {
    config.endpoints.charging.appSsl = process.env.BAE_LP_ENDPOINT_CHARGING_SECURED == 'true';
}

// RSS
config.endpoints.rss.apiPath = process.env.BAE_LP_ENDPOINT_RSS_PATH || config.endpoints.rss.apiPath;
config.endpoints.rss.port = process.env.BAE_LP_ENDPOINT_RSS_PORT || config.endpoints.rss.port;
config.endpoints.rss.host = process.env.BAE_LP_ENDPOINT_RSS_HOST || config.endpoints.rss.host;

if (!!process.env.BAE_LP_ENDPOINT_RSS_SECURED) {
    config.endpoints.rss.appSsl = process.env.BAE_LP_ENDPOINT_RSS_SECURED == 'true';
}

// Party
config.endpoints.party.apiPath = process.env.BAE_LP_ENDPOINT_PARTY_PATH || config.endpoints.party.apiPath;
config.endpoints.party.port = process.env.BAE_LP_ENDPOINT_PARTY_PORT || config.endpoints.party.port;
config.endpoints.party.host = process.env.BAE_LP_ENDPOINT_PARTY_HOST || config.endpoints.party.host;

if (!!process.env.BAE_LP_ENDPOINT_PARTY_SECURED) {
    config.endpoints.party.appSsl = process.env.BAE_LP_ENDPOINT_PARTY_SECURED == 'true';
}

// Billing
config.endpoints.account.apiPath = process.env.BAE_LP_ENDPOINT_BILLING_PATH || config.endpoints.account.apiPath;
config.endpoints.account.port = process.env.BAE_LP_ENDPOINT_BILLING_PORT || config.endpoints.account.port;
config.endpoints.account.host = process.env.BAE_LP_ENDPOINT_BILLING_HOST || config.endpoints.account.host;

if (!!process.env.BAE_LP_ENDPOINT_BILLING_SECURED) {
    config.endpoints.account.appSsl = process.env.BAE_LP_ENDPOINT_BILLING_SECURED == 'true';
}

// Customer
config.endpoints.customer.apiPath = process.env.BAE_LP_ENDPOINT_CUSTOMER_PATH || config.endpoints.customer.apiPath;
config.endpoints.customer.port = process.env.BAE_LP_ENDPOINT_CUSTOMER_PORT || config.endpoints.customer.port;
config.endpoints.customer.host = process.env.BAE_LP_ENDPOINT_CUSTOMER_HOST || config.endpoints.customer.host;

if (!!process.env.BAE_LP_ENDPOINT_CUSTOMER_SECURED) {
    config.endpoints.customer.appSsl = process.env.BAE_LP_ENDPOINT_CUSTOMER_SECURED == 'true';
}

// Usage
config.endpoints.usage.apiPath = process.env.BAE_LP_ENDPOINT_USAGE_PATH || config.endpoints.usage.apiPath;
config.endpoints.usage.port = process.env.BAE_LP_ENDPOINT_USAGE_PORT || config.endpoints.usage.port;
config.endpoints.usage.host = process.env.BAE_LP_ENDPOINT_USAGE_HOST || config.endpoints.usage.host;

if (!!process.env.BAE_LP_ENDPOINT_USAGE_SECURED) {
    config.endpoints.usage.appSsl = process.env.BAE_LP_ENDPOINT_USAGE_SECURED == 'true';
}

// Customer Bill
config.endpoints.billing.apiPath = process.env.BAE_LP_ENDPOINT_CUSTOMER_BILL_PATH || config.endpoints.billing.apiPath;
config.endpoints.billing.port = process.env.BAE_LP_ENDPOINT_CUSTOMER_BILL_PORT || config.endpoints.billing.port;
config.endpoints.billing.host = process.env.BAE_LP_ENDPOINT_CUSTOMER_BILL_HOST || config.endpoints.billing.host;

if (!!process.env.BAE_LP_ENDPOINT_CUSTOMER_BILL_SECURED) {
    config.endpoints.billing.appSsl = process.env.BAE_LP_ENDPOINT_CUSTOMER_BILL_SECURED == 'true';
}

// Quote
config.endpoints.quote.apiPath = process.env.BAE_LP_ENDPOINT_QUOTE_PATH || config.endpoints.quote.apiPath;
config.endpoints.quote.port = process.env.BAE_LP_ENDPOINT_QUOTE_PORT || config.endpoints.quote.port;
config.endpoints.quote.host = process.env.BAE_LP_ENDPOINT_QUOTE_HOST || config.endpoints.quote.host;

if (!!process.env.BAE_LP_ENDPOINT_QUOTE_SECURED) {
    config.endpoints.quote.appSsl = process.env.BAE_LP_ENDPOINT_QUOTE_SECURED == 'true';
}

// Revenue
config.endpoints.revenue.apiPath = process.env.BAE_LP_ENDPOINT_REVENUE_PATH || config.endpoints.revenue.apiPath;
config.endpoints.revenue.port = process.env.BAE_LP_ENDPOINT_REVENUE_PORT || config.endpoints.revenue.port;
config.endpoints.revenue.host = process.env.BAE_LP_ENDPOINT_REVENUE_HOST || config.endpoints.revenue.host;

if (!!process.env.BAE_LP_ENDPOINT_REVENUE_SECURED) {
    config.endpoints.revenue.appSsl = process.env.BAE_LP_ENDPOINT_REVENUE_SECURED == 'true';
}

// Invoicing
config.endpoints.invoicing.apiPath = process.env.BAE_LP_ENDPOINT_INVOICING_PATH || config.endpoints.invoicing.apiPath;
config.endpoints.invoicing.port = process.env.BAE_LP_ENDPOINT_INVOICING_PORT || config.endpoints.invoicing.port;
config.endpoints.invoicing.host = process.env.BAE_LP_ENDPOINT_INVOICING_HOST || config.endpoints.invoicing.host;

if (!!process.env.BAE_LP_ENDPOINT_INVOICING_SECURED) {
    config.endpoints.invoicing.appSsl = process.env.BAE_LP_ENDPOINT_INVOICING_SECURED == 'true';
}

// Search
config.endpoints.search.apiPath = process.env.BAE_LP_ENDPOINT_SEARCH_PATH || config.endpoints.search.apiPath;
config.endpoints.search.port = process.env.BAE_LP_ENDPOINT_SEARCH_PORT || config.endpoints.search.port;
config.endpoints.search.host = process.env.BAE_LP_ENDPOINT_SEARCH_HOST || config.endpoints.search.host;

if (!!process.env.BAE_LP_ENDPOINT_SEARCH_SECURED) {
    config.endpoints.search.appSsl = process.env.BAE_LP_ENDPOINT_SEARCH_SECURED == 'true';
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
    config.revenueModel !== undefined &&
    config.revenueModel !== null &&
    config.revenueModel >= 0 &&
    config.revenueModel <= 100
        ? config.revenueModel
        : 30;

config.revenueModel =
    !!process.env.BAE_LP_REVENUE_MODEL &&
    Number(process.env.BAE_LP_REVENUE_MODEL) >= 0 &&
    Number(process.env.BAE_LP_REVENUE_MODEL) <= 100
        ? Number(process.env.BAE_LP_REVENUE_MODEL)
        : config.revenueModel;

config.taxRate =
    config.taxRate !== undefined && config.taxRate !== null && config.taxRate >= 0 && config.taxRate <= 100
        ? config.taxRate
        : 30;

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

// External Portal config
//config.externalPortal = 'http://localhost:4200';
config.externalPortal = '';
config.externalPortal = process.env.BAE_LP_EXTERNAL_PORTAL || config.externalPortal;

// Chatbot
config.chatUrl = '';
config.chatUrl = process.env.BAE_LP_CHAT_URL || config.chatUrl;

// Matomo
config.matomoId = '';
config.matomoId = process.env.BAE_LP_MATOMO_ID || config.matomoId;

config.matomoUrl = '';
config.matomoUrl = process.env.BAE_LP_MATOMO_URL || config.matomoUrl;

config.knowledgeUrl = '';
config.knowledgeUrl = process.env.BAE_LP_KNOWLEDGE_BASE_URL || config.knowledgeUrl;

config.ticketingUrl = '';
config.ticketingUrl = process.env.BAE_LP_TICKETING_URL || config.ticketingUrl;

config.searchUrl = '';
config.searchUrl = process.env.BAE_LP_SEARCH_URL || config.searchUrl;

config.billingEngineUrl = '';
config.billingEngineUrl = process.env.BAE_LP_BILLING_ENGINE_URL || config.billingEngineUrl;

config.domeRegistrationForm = '';
config.domeRegistrationForm = process.env.BAE_LP_DOME_REGISTRATION_FORM || config.domeRegistrationForm;

config.domeOnboardingGuidelines = '';
config.domeOnboardingGuidelines = process.env.BAE_LP_DOME_ONBOARDING_GUIDELINES || config.domeOnboardingGuidelines;

config.domeGuidelines = '';
config.domeGuidelines = process.env.BAE_LP_DOME_GUIDELINES || config.domeGuidelines;

config.quoteApi = '/quote/quoteManagement';
config.quoteApi = process.env.BAE_LP_QUOTE_API || config.quoteApi;

config.learUrl = '';
config.learUrl = process.env.BAE_LP_LEAR_URL || config.learUrl;

config.quoteEnabled = true;
if (!!process.env.BAE_LP_QUOTE_ENABLED) {
    config.quoteEnabled = process.env.BAE_LP_QUOTE_ENABLED == 'true';
}

config.tenderingEnabled = true;
if (!!process.env.BAE_LP_TENDERING_ENABLED) {
    config.tenderingEnabled = process.env.BAE_LP_TENDERING_ENABLED == 'true';
}

config.paymentGateway = 'https://dpas-sbx.egroup.hu';
config.paymentGateway = process.env.BAE_LP_PAYMENT_GATEWAY || config.paymentGateway;

config.analytics = '';
config.analytics = process.env.BAE_LP_ANALYTICS_URL || config.analytics;

config.defaultId = '';

// Purchase enabled
config.purchaseEnabled = true
if (!!process.env.BAE_LP_PURCHASE_ENABLED) {
    config.purchaseEnabled = process.env.BAE_LP_PURCHASE_ENABLED == 'true';
}

config.operatorId = '64322eda-41a7-44eb-946a-223fef6e3183'
config.operatorId = process.env.BAE_LP_OPERATOR_ID || config.operatorId;

//config.partyLocation = 'https://raw.githubusercontent.com/Ficodes/tmf-schemas/refs/heads/main/schemas/relatedPartyRef.schema.json'
config.partyLocation = 'https://raw.githubusercontent.com/DOME-Marketplace/tmf-api/refs/heads/main/schemas/EngagedParty/RelatedParty.schema.json'
config.partyLocation = process.env.BAE_LP_PARTY_LOCATION || config.partyLocation;



// AI Search configuration
config.aiEnabled = false;
if (!!process.env.BAE_LP_AI_ENABLED) {
    config.aiEnabled = process.env.BAE_LP_AI_ENABLED == 'true';
}

config.aiApiKey = '28791420a51be86495cab108f32221fa458469e29a04b33567b057c95878bd72'
config.aiApiKey = process.env.BAE_LP_AI_API_KEY || config.aiApiKey;

config.aiApiUrl = '/ai/rag/'
config.aiApiUrl = process.env.BAE_LP_AI_API_PATH || config.aiApiUrl;

config.aiSearchProfile = 'dome_prod'
config.aiSearchProfile = process.env.BAE_LP_AI_SEARCH_PROFILE || config.aiSearchProfile;

// Proxy redirect for AI service
config.endpoints.ai.apiPath = process.env.BAE_LP_ENDPOINT_AI_PATH || config.endpoints.ai.apiPath;
config.endpoints.ai.port = process.env.BAE_LP_ENDPOINT_AI_PORT || config.endpoints.ai.port;
config.endpoints.ai.host = process.env.BAE_LP_ENDPOINT_AI_HOST || config.endpoints.ai.host;

if (!!process.env.BAE_LP_ENDPOINT_AI_SECURED) {
    config.endpoints.ai.appSsl = process.env.BAE_LP_ENDPOINT_AI_SECURED == 'true';
}
