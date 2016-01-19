var bodyParser = require('body-parser'),
    base64url = require('base64url'),
    config = require('./config'),
    cookieParser = require('cookie-parser'),
    errorhandler = require('errorhandler'),
    express = require('express'),
    FIWAREStrategy = require('passport-fiware-oauth').OAuth2Strategy,
    fs = require('fs'),
    https = require('https'),
    log = require('./lib/logger').logger.getLogger("Server"),
    passport = require('passport'),
    tmf = require('./controllers/tmf').tmf,
    session = require('express-session'),
    utils = require('./lib/utils');


/////////////////////////////////////////////////////////////////////
////////////////////////// CONFIG CHECKERS //////////////////////////
/////////////////////////////////////////////////////////////////////

var checkPrefix = function(prefix, byDefault) {
    var finalPrefix = prefix === undefined ? byDefault : prefix;

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

// TODO: Add more checkers (if required)

/////////////////////////////////////////////////////////////////////
/////////////////////////////// CONFIG //////////////////////////////
/////////////////////////////////////////////////////////////////////

// OAuth2 Came From Field
var OAUTH2_CAME_FROM_FIELD = 'came_from_path';

// Get preferences and set up default values
config.sessionSecret = config.sessionSecret || 'keyboard cat';
config.https = config.https || {};
config.proxyPrefix = checkPrefix(config.proxyPrefix, '/proxy');
config.portalPrefix = checkPrefix(config.portalPrefix, '');
config.logInPath = config.logInPath || '/login';
config.logOutPath = config.logOutPath || '/logout';

var PORT = config.https.enabled ? 
    config.https.port || 443 :      // HTTPS
    config.port || 80;              // HTTP

var FIWARE_STRATEGY = new FIWAREStrategy({
        clientID: config.oauth2.clientID,
        clientSecret: config.oauth2.clientSecret,
        callbackURL: config.oauth2.callbackURL
    },

    function(accessToken, refreshToken, profile, done) {
        profile['accessToken'] = accessToken;
        done(null, profile);
    }
);

// Avoid existing on uncaught Exceptions
process.on('uncaughtException', function (err) {
    log.error('Caught exception: ' + err);
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


/////////////////////////////////////////////////////////////////////
////////////////////////////// EXPRESS //////////////////////////////
/////////////////////////////////////////////////////////////////////

var app = express();
app.set('port', PORT);

app.use(errorhandler({ dumpExceptions: true, showStack: true }));

// Static files && templates
app.use(config.portalPrefix + '/', express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Session
app.use(session({
    secret: config.sessionSecret,
    resave: true,
    saveUninitialized: true
}));


app.use(cookieParser());
app.use(bodyParser.text({
    type: '*/*',
    limit: '50mb'
}));

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
        var encodedState = getOAuth2State(req.path);
        // This action will redirect the user the FIWARE Account portal,
        // so the next callback is not required to be called
        passport.authenticate('fiware', { scope: ['all_info'], state: encodedState })(req, res);
    } else {
        next();
    }
};

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

passport.use(FIWARE_STRATEGY);

// Passport middlewares
app.use(passport.initialize());
app.use(passport.session());

// Handler for logging in...
app.all(config.logInPath, function(req, res) {
    var encodedState = getOAuth2State(utils.getRefererPath(req));
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
/////////////////////////////// PORTAL //////////////////////////////
/////////////////////////////////////////////////////////////////////

var cssFilesToInject = [
    'bootstrap-3.3.5/css/bootstrap',
    'font-awesome-4.4.0/css/font-awesome',
    'core/css/default-theme'
].map(function (path) {
    return 'resources/' + path + '.css';
});

var jsDepFilesToInject = [
    // Dependencies:
    'jquery-1.11.3/js/jquery',
    'bootstrap-3.3.5/js/bootstrap',
    'moment-2.10.6/js/moment',
    'angular-1.4.7/js/angular',
    // Angular Dependencies:
    'angular-1.4.7/js/angular-messages',
    'angular-1.4.7/js/angular-moment',
    'angular-1.4.7/js/angular-resource',
    'angular-1.4.7/js/angular-ui-router'
].map(function (path) {
    return 'resources/' + path + '.js';
});

var jsAppFilesToInject = [
    'app.config',
    'app.filters',
    'app.directives',
    'services/user.service',
    'services/payment.service',
    'services/product.service',
    'services/product-category.service',
    'services/product-offering.service',
    'services/product-catalogue.service',
    'services/asset.service',
    'services/asset-type.service',
    'services/order.service',
    'services/shopping-cart.service',
    'services/inventory-product.service',
    'services/utils.service',
    'controllers/form-wizard.controller',
    'controllers/flash-message.controller',
    'controllers/user.controller',
    'controllers/search-filter.controller',
    'controllers/payment.controller',
    'controllers/product.controller',
    'controllers/product-category.controller',
    'controllers/product-offering.controller',
    'controllers/product-catalogue.controller',
    'controllers/purchase-options.controller',
    'controllers/order.controller',
    'controllers/message.controller',
    'controllers/inventory-product.controller',
    'routes/offering.routes',
    'routes/stock.routes',
    'routes/stock.product.routes',
    'routes/stock.product-offering.routes',
    'routes/stock.product-catalogue.routes',
    'routes/inventory.routes',
    'routes/inventory.order.routes',
    'routes/inventory.product.routes',
    'routes/shopping-cart.routes'
].map(function (path) {
    return 'resources/core/js/' + path + '.js';
});

var renderTemplate = function(req, res, viewName) {

    // TODO: Maybe an object with extra properties (if required)
    res.render(viewName, {
        user: req.user,
        contextPath: config.portalPrefix,
        proxyPath: config.proxyPrefix,
        cssFilesToInject: cssFilesToInject,
        jsDepFilesToInject: jsDepFilesToInject,
        jsAppFilesToInject: jsAppFilesToInject,
        accountHost: config.oauth2.server
    });

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

var headerAuthentication = function(req, res, next) {

    try {
        var authToken = utils.getAuthToken(req.headers);
        FIWARE_STRATEGY.userProfile(authToken, function(err, userProfile) {
            if (err) {
                log.warn('The provider auth-token is not valid');
                utils.sendUnauthorized(res, 'invalid auth-token')
            } else {
                // Check that the provided access token is valid for the given application
                if (userProfile.appId !== config.oauth2.clientID) {
                    log.warn('The provider auth-token scope is not valid for the current application');
                    utils.sendUnauthorized(res, 'The auth-token scope is not valid for the current application');
                } else {
                    req.user = userProfile;
                    next();
                }
            }
        });

    } catch (err) {
        log.warn(err);

        if (err.name === 'AuthorizationTokenNotFound') {
            next();
        } else {
            utils.sendUnauthorized(res, err.message);
        }
    }
};

// Middleware: Add CORS headers. Handle OPTIONS requests.
app.use(function (req, res, next) {
    'use strict';
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'HEAD, POST, GET, PATCH, PUT, OPTIONS, DELETE');
    res.header('Access-Control-Allow-Headers', 'origin, content-type, X-Auth-Token, Tenant-ID, Authorization');
    //log.debug("New Request: ", req.method);
    
    if (req.method == 'OPTIONS') {
        log.debug("CORS request");
        res.statusCode = 200;
        res.header('Content-Length', '0');
        res.send();
        res.end();
    } else {
        next();
    }
});

// Public Paths are not protected by the Proxy
for (var p in config.publicPaths) {
    log.debug('Public Path', config.publicPaths[p]);
    app.all(config.proxyPrefix + '/' + config.publicPaths[p], tmf.public);
}

app.all(config.proxyPrefix + '/*', headerAuthentication, tmf.checkPermissions);


/////////////////////////////////////////////////////////////////////
//////////////////////////// START SERVER ///////////////////////////
/////////////////////////////////////////////////////////////////////

log.info('Starting BELP in port ' + PORT + '.');

if (config.https.enabled === true) {
    
    var options = {
        key: fs.readFileSync(config.https.keyFile),
        cert: fs.readFileSync(config.https.certFile)
    };

    https.createServer(options, function(req,res) {
        app.handle(req, res);
    }).listen(app.get('port'));

} else {
    app.listen(app.get('port'));
}