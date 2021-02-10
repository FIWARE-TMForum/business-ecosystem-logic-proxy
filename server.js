var authorizeService = require('./controllers/authorizeService').authorizeService,
    apiKeyService = require('./controllers/apiKeyService').apiKeyService,
    slaService = require('./controllers/slaService').slaService,
    reputationService = require('./controllers/reputationService').reputationService,
    bodyParser = require('body-parser'),
    base64url = require('base64url'),
    config = require('./config'),
    constants = require('constants'),
    cookieParser = require('cookie-parser'),
    express = require('express'),
    fs = require('fs'),
    https = require('https'),
    i18n = require('i18n-2'),
    indexes = require('./lib/indexes'),
    inventorySubscription = require('./lib/inventory_subscription'),
    logger = require('./lib/logger').logger.getLogger('Server'),
    mongoose = require('mongoose'),
    onFinished = require('on-finished'),
    passport = require('passport'),
    session = require('express-session'),
    shoppingCart = require('./controllers/shoppingCart').shoppingCart,
    management = require('./controllers/management').management,
    tmf = require('./controllers/tmf'),
    trycatch = require('trycatch'),
    url = require('url'),
    utils = require('./lib/utils'),
    auth = require('./lib/auth'),
    uuidv4 = require('uuid/v4');

const debug = !(process.env.NODE_ENV == 'production');

// OAuth2 Came From Field
const OAUTH2_CAME_FROM_FIELD = 'came_from_path';

const PORT = config.https.enabled
    ? config.https.port || 443 // HTTPS
    : config.port || 80; // HTTP

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


auth = auth.auth();
tmf = tmf.tmf();

/////////////////////////////////////////////////////////////////////
////////////////////////// MONGOOSE CONFIG //////////////////////////
/////////////////////////////////////////////////////////////////////

var mongoCredentials = '';

if (config.mongoDb.user && config.mongoDb.password) {
    mongoCredentials = config.mongoDb.user + ':' + config.mongoDb.password + '@';
}

var mongoUrl =
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
    locales: ['en', 'es']
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
        passport.authenticate('fiware', { scope: ['all_info'], state: encodedState })(req, res);
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

passport.use(auth.FIWARE_STRATEGY);

// Passport middlewares
app.use(passport.initialize());
app.use(passport.session());

// Handler for logging in...
app.all(config.logInPath, function(req, res) {
    var encodedState = getOAuth2State(utils.getCameFrom(req));
    passport.authenticate('fiware', { scope: ['all_info'], state: encodedState })(req, res);
});

// Handler for the callback
app.get('/auth/fiware/callback', passport.authenticate('fiware', { failureRedirect: '/error' }), function(req, res) {
    var state = JSON.parse(base64url.decode(req.query.state));
    var redirectPath = state[OAUTH2_CAME_FROM_FIELD] !== undefined ? state[OAUTH2_CAME_FROM_FIELD] : '/';

    res.redirect(redirectPath);
});

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
    auth.headerAuthentication,
    auth.checkOrganizations,
    auth.setPartyObj,
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

app.use(config.authorizeServicePath + '/*', checkMongoUp, auth.headerAuthentication, auth.checkOrganizations, auth.setPartyObj, failIfNotAuthenticated);
app.post(config.authorizeServicePath + '/token', authorizeService.saveAppToken);
app.post(config.authorizeServicePath + '/read', authorizeService.getAppToken);

/////////////////////////////////////////////////////////////////////
///////////////////////// SLA SERVICE ///////////////////////////////
/////////////////////////////////////////////////////////////////////

app.use(config.slaServicePath + '/*', checkMongoUp, auth.headerAuthentication, auth.checkOrganizations, auth.setPartyObj);
app.get(config.slaServicePath + '/sla/:id', slaService.getSla);
app.post(config.slaServicePath + '/sla', failIfNotAuthenticated, slaService.saveSla);

/////////////////////////////////////////////////////////////////////
///////////////////////// REPUTAION SERVICE /////////////////////////
/////////////////////////////////////////////////////////////////////
app.use(config.reputationServicePath + '/*', checkMongoUp);
app.use(config.reputationServicePath + '/reputation/set', checkMongoUp, auth.headerAuthentication, auth.checkOrganizations, auth.setPartyObj, failIfNotAuthenticated);
app.get(config.reputationServicePath + '/reputation', reputationService.getOverallReputation);
app.get(config.reputationServicePath + '/reputation/:id/:consumerId', reputationService.getReputation);
app.post(config.reputationServicePath + '/reputation/set', reputationService.saveReputation);

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
        admin: config.oauth2.roles.admin
    };

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

app.all(config.proxyPrefix + '/*', auth.headerAuthentication, auth.checkOrganizations, auth.setPartyObj, function(
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
