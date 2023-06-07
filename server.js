const authorizeService = require('./controllers/authorizeService').authorizeService;
const apiKeyService = require('./controllers/apiKeyService').apiKeyService;
const slaService = require('./controllers/slaService').slaService;
const reputationService = require('./controllers/reputationService').reputationService;
const recommendationService = require('./controllers/recommendationService').recommendationService;
const idpService = require('./controllers/idpsService').idpService;
const bodyParser = require('body-parser');
const base64url = require('base64url');
const config = require('./config');
const constants = require('constants');
const cookieParser = require('cookie-parser');
const express = require('express');
const fs = require('fs');
const https = require('https');
const i18n = require('i18n-2');
const indexes = require('./lib/indexes');
const inventorySubscription = require('./lib/inventory_subscription');
const logger = require('./lib/logger').logger.getLogger('Server');
const mongoose = require('mongoose');
const onFinished = require('on-finished');
const passport = require('passport');
const session = require('express-session');
const shoppingCart = require('./controllers/shoppingCart').shoppingCart;
const management = require('./controllers/management').management;
const tmf = require('./controllers/tmf').tmf();
const trycatch = require('trycatch');
const url = require('url');
const utils = require('./lib/utils');
const authModule = require('./lib/auth');
const uuidv4 = require('uuid').v4;

const debug = !(process.env.NODE_ENV == 'production');

// OAuth2 Came From Field
const OAUTH2_CAME_FROM_FIELD = 'came_from_path';

const VC_LOGIN_TYPE = 'vc';
const VC_POLL_URL = '/poll';

const PORT = config.https.enabled
    ? config.https.port || 443 // HTTPS
    : config.port || 80; // HTTP

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// External login enabled
const extLogin = config.extLogin == true;
const showLocal = config.showLocalLogin == true;
const editParty = config.editParty == true;

(async () => {

// Local auth method
const auth = await authModule.auth(config.oauth2);
    
/////////////////////////////////////////////////////////////////////
////////////////////////// MONGOOSE CONFIG //////////////////////////
/////////////////////////////////////////////////////////////////////

let mongoCredentials = '';

if (config.mongoDb.user && config.mongoDb.password) {
    mongoCredentials = config.mongoDb.user + ':' + config.mongoDb.password + '@';
}

const mongoUrl =
    'mongodb://' + mongoCredentials + config.mongoDb.server + ':' + config.mongoDb.port + '/' + config.mongoDb.db;

mongoose.connect(
    mongoUrl,
    function(err) {
        if (err) {
            logger.error('Cannot connect to MongoDB - ' + err.name + ' (' + err.code + '): ' + err.message);
        }
    }
);

mongoose.connection.on('disconnected', function() {
    logger.error('Connection with MongoDB lost');
});

mongoose.connection.on('reconnected', function() {
    logger.info('Connection with MongoDB reopened');
});

/////////////////////////////////////////////////////////////////////
////////////////////////////// EXPRESS //////////////////////////////
/////////////////////////////////////////////////////////////////////

var app = express();
app.set('port', PORT);

// Attach i18n to express
i18n.expressBind(app, {
    locales: ['en', 'es', 'de']
});

app.use(function(req, res, next) {
    trycatch(
        function() {
            next();
        },
        function(err) {
            // Call the default Express error handler
            next(err);
        }
    );
});

// Session
app.use(
    session({
        secret: config.sessionSecret,
        resave: true,
        saveUninitialized: true
    })
);

app.use(cookieParser());

app.use(
    bodyParser.text({
        type: '*/*',
        limit: '50mb'
    })
);

app.use(function(req, res, next) {
    req.i18n.setLocaleFromCookie();
    next();
});

// Logging Handler
app.use(function(req, res, next) {
    req.id = uuidv4();

    utils.log(logger, 'debug', req, 'Headers: ' + JSON.stringify(req.headers));
    utils.log(logger, 'debug', req, 'Body: ' + JSON.stringify(req.body));

    onFinished(res, function(err, res) {
        var logLevel = Math.floor(res.statusCode / 100) < 4 ? 'info' : 'warn';
        utils.log(logger, logLevel, req, 'Status: ' + res.statusCode);
    });

    next();
});

// Static files && templates

// Check if a theme has been loaded or the system is in production
var staticPath = config.theme || !debug ? '/static' : '';

app.use(config.portalPrefix + '/', express.static(__dirname + staticPath + '/public'));
app.set('views', __dirname + staticPath + '/views');
app.set('view engine', 'jade');

app.locals.taxRate = config.taxRate || 20;

/////////////////////////////////////////////////////////////////////
////////////////////////////// PASSPORT /////////////////////////////
/////////////////////////////////////////////////////////////////////

var getOAuth2State = function(path) {
    var state = {};
    state[OAUTH2_CAME_FROM_FIELD] = path;
    var encodedState = base64url(JSON.stringify(state));
    return encodedState;
};

var ensureAuthenticated = function(req, res, next) {
    if (!req.isAuthenticated()) {
        var encodedState = getOAuth2State(req.url);
        // This action will redirect the user the FIWARE Account portal,
        // so the next callback is not required to be called

        passport.authenticate(config.oauth2.provider, { scope: auth.getScope(), state: encodedState })(req, res);
    } else {
        next();
    }
};

var failIfNotAuthenticated = function(req, res, next) {
    if (!req.isAuthenticated()) {
        res.status(401);
        res.json({ error: 'You need to be authenticated to access this resource' });
        res.end();
    } else {
        next();
    }
};

// Configure Passport to use FIWARE as authentication strategy

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});
// Passport middlewares
app.use(passport.initialize());
app.use(passport.session());

// Load local strategy
passport.use(config.oauth2.provider, auth.STRATEGY);

// Handler for default logging
app.all(config.logInPath, function(req, res) {
    var encodedState = getOAuth2State(utils.getCameFrom(req));

    passport.authenticate(config.oauth2.provider, { scope: auth.getScope(), state: encodedState })(req, res);
});

// Handler for the callback
app.get('/auth/' + config.oauth2.provider + '/callback', passport.authenticate(config.oauth2.provider, { failureRedirect: '/error' }), function(req, res) {
    var state = JSON.parse(base64url.decode(req.query.state));
    var redirectPath = state[OAUTH2_CAME_FROM_FIELD] !== undefined ? state[OAUTH2_CAME_FROM_FIELD] : '/';

    res.redirect(redirectPath);
});

let idps = {
    'local': auth
};

const addIdpStrategy = async (idp) => {
    let extAuth = await authModule.auth(idp);
    passport.use(idp.idpId, extAuth.STRATEGY);

    // Handler for default logging
    console.log(`/login/${idp.idpId}`);
    app.all(`/login/${idp.idpId}`, function(req, res) {
        console.log("--------------------------- Loggin");
        console.log(idp);
        console.log(extAuth);
        const encodedState = getOAuth2State(utils.getCameFrom(req));

        passport.authenticate(idp.idpId, { scope: extAuth.getScope(), state: encodedState })(req, res);
    });

    // Handler for the callback
    console.log(`/auth/${idp.idpId}/callback`);
    app.get(`/auth/${idp.idpId}/callback`, passport.authenticate(idp.idpId, { failureRedirect: '/error' }), function(req, res) {
        const state = JSON.parse(base64url.decode(req.query.state));
        const redirectPath = state[OAUTH2_CAME_FROM_FIELD] !== undefined ? state[OAUTH2_CAME_FROM_FIELD] : '/';

        res.redirect(redirectPath);
    });

    return extAuth;
}

if (config.oauth2.provider === VC_LOGIN_TYPE) {
    app.get(`/login/${config.oauth2.provider}`, (req, res) => {
        const encodedState = getOAuth2State(utils.getCameFrom(req));
        res.render("siop.jade",  {
            title: 'Login Q',
            verifierQRCodeURL: config.oauth2.server + config.oauth2.verifierQRCodePath,
            statePair: `state=${encodedState}`,
            callbackURLPair: `client_callback=${config.oauth2.callbackURL}`,
            clientIDPair: `client_id=${config.siop.clientID}`,
            pollURL: VC_POLL_URL
        });
    });

    app.get(VC_POLL_URL, (req, res, next) => {
        const encodedState = getOAuth2State(utils.getCameFrom(req));
        passport.authenticate(config.oauth2.provider, { poll: true, state: encodedState })(req, res, next);
    });
}

// Load other stragies if external IDPs are enabled
if (extLogin) {
    // Load IDPs from database
    const externalIdps = await idpService.getDBIdps();

    externalIdps.forEach(async (idp) => {
        console.log("===========================");
        console.log(idp);

        const extAuth = await addIdpStrategy(idp);
        //authMiddleware.addIdp(idp, extAuth);
        idps[idp.idpId] = extAuth;
    });
}

const authMiddleware = authModule.authMiddleware(idps);
// Handler to destroy sessions
app.all(config.logOutPath, function(req, res) {
    // Destroy the session and redirect the user to the main page
    req.session.destroy();
    res.redirect(config.portalPrefix + '/');
});

/////////////////////////////////////////////////////////////////////
/////////////////////////// SHOPPING CART ///////////////////////////
/////////////////////////////////////////////////////////////////////

var checkMongoUp = function(req, res, next) {
    // We lost connection!
    if (mongoose.connection.readyState !== 1) {
        // Connection is down!

        res.status(500);
        res.json({ error: 'It was impossible to connect with the database. Please, try again in a few seconds.' });
        res.end();
    } else {
        next();
    }
};

app.use(
    config.shoppingCartPath + '/*',
    checkMongoUp,
    authMiddleware.headerAuthentication,
    authMiddleware.checkOrganizations,
    authMiddleware.setPartyObj,
    failIfNotAuthenticated
);
app.get(config.shoppingCartPath + '/item/', shoppingCart.getCart);
app.post(config.shoppingCartPath + '/item/', shoppingCart.add);
app.get(config.shoppingCartPath + '/item/:id', shoppingCart.getItem);
app.delete(config.shoppingCartPath + '/item/:id', shoppingCart.remove);
app.post(config.shoppingCartPath + '/empty', shoppingCart.empty);

/////////////////////////////////////////////////////////////////////
////////////////////////// MANAGEMENT API ///////////////////////////
/////////////////////////////////////////////////////////////////////

app.get('/version', management.getVersion);
app.get('/' + config.endpoints.management.path + '/count/:size', management.getCount);

/////////////////////////////////////////////////////////////////////
///////////////////////// AUTHORIZE SERVICE /////////////////////////
/////////////////////////////////////////////////////////////////////

app.use(config.apiKeyServicePath + '/*', checkMongoUp);
app.post(config.apiKeyServicePath + '/apiKeys', apiKeyService.getApiKey);
app.post(config.apiKeyServicePath + '/apiKeys/:apiKey/commit', apiKeyService.commitApiKey);

app.use(config.authorizeServicePath + '/*', checkMongoUp, authMiddleware.headerAuthentication, authMiddleware.checkOrganizations, authMiddleware.setPartyObj, failIfNotAuthenticated);
app.post(config.authorizeServicePath + '/token', authorizeService.saveAppToken);
app.post(config.authorizeServicePath + '/read', authorizeService.getAppToken);

/////////////////////////////////////////////////////////////////////
///////////////////////// SLA SERVICE ///////////////////////////////
/////////////////////////////////////////////////////////////////////

app.use(config.slaServicePath + '/*', checkMongoUp, authMiddleware.headerAuthentication, authMiddleware.checkOrganizations, authMiddleware.setPartyObj);
app.get(config.slaServicePath + '/sla/:id', slaService.getSla);
app.post(config.slaServicePath + '/sla', failIfNotAuthenticated, slaService.saveSla);

/////////////////////////////////////////////////////////////////////
///////////////////////// RECOMMENDATIONS ///////////////////////////
/////////////////////////////////////////////////////////////////////

app.use(config.recommendationServicePath + "/*", checkMongoUp, authMiddleware.headerAuthentication, authMiddleware.checkOrganizations, authMiddleware.setPartyObj);
app.get(config.recommendationServicePath + '/recommendations/:id', recommendationService.getRecomList);
app.post(config.recommendationServicePath + '/recommendations', failIfNotAuthenticated, recommendationService.setRecomList);

/////////////////////////////////////////////////////////////////////
///////////////////////// REPUTAION SERVICE /////////////////////////
/////////////////////////////////////////////////////////////////////
app.use(config.reputationServicePath + '/*', checkMongoUp);
app.use(config.reputationServicePath + '/reputation/set', checkMongoUp, authMiddleware.headerAuthentication, authMiddleware.checkOrganizations, authMiddleware.setPartyObj, failIfNotAuthenticated);
app.get(config.reputationServicePath + '/reputation', reputationService.getOverallReputation);
app.get(config.reputationServicePath + '/reputation/:id/:consumerId', reputationService.getReputation);
app.post(config.reputationServicePath + '/reputation/set', reputationService.saveReputation);

/////////////////////////////////////////////////////////////////////
//////////////////////////// IDP SERVICE ////////////////////////////
/////////////////////////////////////////////////////////////////////

if (extLogin) {
    const setNewIdp = async function(idp) {
        const extAuth = await addIdpStrategy(idp);
        authMiddleware.addIdp(idp.idpId, extAuth);
    }

    const removeIdp = function(idp) {
        authMiddleware.removeIdp(idp.idpId);
    }

    idpService.setNewIdpProcessor(setNewIdp);
    idpService.setRemoveIdpProcessor(removeIdp);

    app.use(config.idpServicePath + '/*', checkMongoUp, authMiddleware.headerAuthentication, authMiddleware.checkOrganizations, authMiddleware.setPartyObj, failIfNotAuthenticated);
    app.get(config.idpServicePath + '/', idpService.getIdps);
    app.post(config.idpServicePath + '/', idpService.createIdp);
    app.get(config.idpServicePath + '/:idpId', idpService.getIdp);
    app.delete(config.idpServicePath + '/:idpId', idpService.deleteIdp);
    app.put(config.idpServicePath + '/:idpId', idpService.updateIdp);
}

/////////////////////////////////////////////////////////////////////
/////////////////////////////// PORTAL //////////////////////////////
/////////////////////////////////////////////////////////////////////

// Load active file imports
var importPath = config.theme || !debug ? './static/public/imports' : './public/imports';
var imports = require(importPath).imports;

var renderTemplate = function(req, res, viewName) {
    var options = {
        user: req.user,
        contextPath: config.portalPrefix,
        proxyPath: config.proxyPrefix,
        catalogPath: config.endpoints.catalog.path,
        orderingPath: config.endpoints.ordering.path,
        inventoryPath: config.endpoints.inventory.path,
        chargingPath: config.endpoints.charging.path,
        partyPath: config.endpoints.party.path,
        billingPath: config.endpoints.billing.path,
        customerPath: config.endpoints.customer.path,
        shoppingCartPath: config.shoppingCartPath,
        authorizeServicePath: config.authorizeServicePath,
        rssPath: config.endpoints.rss.path,
        platformRevenue: config.revenueModel,
        cssFilesToInject: imports.cssFilesToInject,
        jsDepFilesToInject: imports.jsDepFilesToInject,
        jsAppFilesToInject: imports.jsAppFilesToInject,
        accountHost: config.oauth2.server,
        usageChartURL: config.usageChartURL,
        orgAdmin: config.oauth2.roles.orgAdmin,
        seller: config.oauth2.roles.seller,
        customer: config.oauth2.roles.customer,
        admin: config.oauth2.roles.admin,
        extLogin: extLogin,
        showLocal: showLocal,
        editParty: editParty
    };

    if (extLogin) {
        options.externalIdps = config.externalIdps;
    }

    if (utils.isAdmin(req.user)) {
        options.jsAppFilesToInject = options.jsAppFilesToInject.concat(imports.jsAdminFilesToInject);
    }

    options.jsAppFilesToInject = options.jsAppFilesToInject.concat(imports.jsStockFilesToInject);

    res.render(viewName, options);
    res.end();
};

app.get(config.portalPrefix + '/', function(req, res) {
    renderTemplate(req, res, 'app');
});

app.get(config.portalPrefix + '/payment', ensureAuthenticated, function(req, res) {
    renderTemplate(req, res, 'app-payment');
});

/////////////////////////////////////////////////////////////////////
//////////////////////////////// APIs ///////////////////////////////
/////////////////////////////////////////////////////////////////////

var inventorySubscriptionPath = config.proxyPrefix + '/create/inventory';
app.post(config.proxyPrefix + inventorySubscriptionPath, inventorySubscription.postNotification);
inventorySubscription
    .createSubscription(inventorySubscriptionPath)
    .then(() => {
        console.log('Subscribed to inventory hub!');
    })
    .catch((e) => {
        console.log(e);
    });

/////////////////////////////////////////////////////////////////////
//////////////////////////////// APIs ///////////////////////////////
/////////////////////////////////////////////////////////////////////

// Middleware: Add CORS headers. Handle OPTIONS requests.
app.use(function(req, res, next) {
    'use strict';
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'HEAD, POST, GET, PATCH, PUT, OPTIONS, DELETE');
    res.header('Access-Control-Allow-Headers', 'origin, content-type, X-Auth-Token, Tenant-ID, Authorization');

    if (req.method == 'OPTIONS') {
        utils.log(logger, 'debug', req, 'CORS request');

        res.status(200);
        res.header('Content-Length', '0');
        res.send();
        res.end();
    } else {
        next();
    }
});

// Public Paths are not protected by the Proxy
for (var p in config.publicPaths) {
    logger.debug('Public Path', config.publicPaths[p]);
    app.all(config.proxyPrefix + '/' + config.publicPaths[p], tmf.public);
}

console.log('Now the paths ==== ');
app.all(/^\/(?!(login|auth))(.*)\/?$/, authMiddleware.headerAuthentication, authMiddleware.checkOrganizations, authMiddleware.setPartyObj, function(
    req,
    res,
    next
) {
    // The API path is the actual path that should be used to access the resource
    // This path contains the query string!!
    req.apiUrl = url.parse(req.url).path.substring(config.proxyPrefix.length);
    tmf.checkPermissions(req, res);
});

/////////////////////////////////////////////////////////////////////
/////////////////////////// ERROR HANDLER ///////////////////////////
/////////////////////////////////////////////////////////////////////

app.use(function(err, req, res, next) {
    utils.log(
        logger,
        'fatal',
        req,
        'Unexpected unhandled exception - ' + err.name + ': ' + err.message + '. Stack trace:\n' + err.stack
    );

    var applicationJSON = 'application/json';
    var textHtml = 'text/html';

    res.status(500);

    switch (req.accepts([applicationJSON, textHtml])) {
        case applicationJSON:
            res.header('Content-Type', applicationJSON);
            res.json({ error: 'Unexpected error. The error has been notified to the administrators.' });
            res.end();

            break;
        case 'text/html':
            res.header('Content-Type', textHtml);
            renderTemplate(req, res, 'unexpected-error');

            break;
        default:
            res.status(406); // Not Accepted
            res.end();
    }
});

/////////////////////////////////////////////////////////////////////
//////////////////////////// START SERVER ///////////////////////////
/////////////////////////////////////////////////////////////////////

// Initialize indexes
indexes.init().then(function() {
    logger.info('Business Ecosystem Logic Proxy starting on port ' + PORT);
    if (config.https.enabled === true) {

        var options = {
            secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_SSLv2,
            ciphers: [
                "ECDHE-RSA-AES256-SHA384",
                "DHE-RSA-AES256-SHA384",
                "ECDHE-RSA-AES256-SHA256",
                "DHE-RSA-AES256-SHA256",
                "ECDHE-RSA-AES128-SHA256",
                "DHE-RSA-AES128-SHA256",
                "HIGH",
                "!aNULL",
                "!eNULL",
                "!EXPORT",
                "!DES",
                "!RC4",
                "!MD5",
                "!PSK",
                "!SRP",
                "!CAMELLIA"
            ].join(':'),
            honorCipherOrder: true,
            key: fs.readFileSync(config.https.keyFile),
            cert: fs.readFileSync(config.https.certFile),
            ca: fs.readFileSync(config.https.caFile)
        };

        https.createServer(options, function(req,res) {
            app.handle(req, res);
        }).listen(app.get('port'), onlistening);
    } else {
        app.listen(app.get('port'), onlistening);
    }
}).catch(function() {
    logger.error('CRITICAL: The indexes could not be created, the server is not starting');
});


function onlistening() {
    var request = require('request');
    var urldata = config.endpoints.charging;

    Promise.all([
        new Promise(function(resolve, reject) {
            var uri = url.format({
                protocol: urldata.appSsl ? 'https' : 'http',
                hostname: urldata.host,
                port: urldata.port,
                pathname: '/' + urldata.path + '/api/assetManagement/chargePeriods/'
            });

            request(uri, function(err, res, body) {
                if (err || res.statusCode != 200) {
                    reject('Failed to retrieve charge periods');
                } else {
                    resolve(JSON.parse(body));
                }
            });
        }),
        new Promise(function(resolve, reject) {
            var uri = url.format({
                protocol: urldata.appSsl ? 'https' : 'http',
                hostname: urldata.host,
                port: urldata.port,
                pathname: '/' + urldata.path + '/api/assetManagement/currencyCodes/'
            });

            request(uri, function(err, res, body) {
                if (err || res.statusCode != 200) {
                    reject('Failed to retrieve currency codes');
                } else {
                    resolve(JSON.parse(body));
                }
            });
        })
    ]).then(
        function(result) {
            app.locals.chargePeriods = result[0].map(function(cp) {
                return cp.title + ':' + cp.value;
            });
            app.locals.currencyCodes = result[1].map(function(cc) {
                return cc.value + ':' + cc.title;
            });
        },
        function(reason) {
            logger.error(reason);
        }
    );
}
})();
