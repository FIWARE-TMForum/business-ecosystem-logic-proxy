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

// TODO: Add more checkers

/////////////////////////////////////////////////////////////////////
/////////////////////////////// CONFIG //////////////////////////////
/////////////////////////////////////////////////////////////////////

// Default title for GUI
var DEFAULT_TITLE = 'TM Forum Portal';

// Get preferences and set up default values
config.sessionSecret = config.sessionSecret || 'keyboard cat';
config.https = config.https || {};
config.proxyPrefix = checkPrefix(config.proxyPrefix, '/proxy');
config.portalPrefix = checkPrefix(config.portalPrefix, '');

var PORT = config.https.enabled ? 
    config.https.port || 443 :      // HTTPS
    config.port || 80;           // HTTP

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

// Generic middlewares for handle requests
app.use(cookieParser());
app.use(bodyParser.text({
    type: '*/*'
}));


/////////////////////////////////////////////////////////////////////
////////////////////////////// PASSPORT /////////////////////////////
/////////////////////////////////////////////////////////////////////

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
app.all('/login', function(req, res) {

    var state = {};
    var refererPath = utils.getRefererPath(req);
    var encodedState = base64url((JSON.stringify(refererPath ? {'came_from_path': refererPath} : {} )));

    passport.authenticate('fiware', { scope: ['all_info'], state: encodedState })(req, res);
});

// Handler for the callback
app.get('/auth/fiware/callback', passport.authenticate('fiware', { failureRedirect: '/error' }), function(req, res) {

    var redirectPath = '/';
    var state = JSON.parse(base64url.decode(req.query.state));
    redirectPath = state.came_from_path !== undefined ? state.came_from_path : '/';

    res.redirect(redirectPath);
});

// Handler to destroy sessions
app.all('/logout', function(req, res) {
    // Destroy the session and redirect the user to the main page
    req.session.destroy();
    res.redirect(config.oauth2.server + '/auth/logout');
});


/////////////////////////////////////////////////////////////////////
/////////////////////////////// PORTAL //////////////////////////////
/////////////////////////////////////////////////////////////////////

var cssFilesToInject = [
    'bootstrap-3.3.5/css/bootstrap.css',
    'font-awesome-4.4.0/css/font-awesome.css',
    'core/css/default-theme.css'
].map(function(path) {
    return 'resources/' + path;
});

var jsDepFilesToInject = [
    // Dependencies:
    'jquery-1.11.3/js/jquery.js',
    'bootstrap-3.3.5/js/bootstrap.js',
    'moment-2.10.6/js/moment.js',
    'angular-1.4.7/js/angular.js',
    // Angular Dependencies:
    'angular-1.4.7/js/angular-messages.js',
    'angular-1.4.7/js/angular-moment.js',
    'angular-1.4.7/js/angular-resource.js',
    'angular-1.4.7/js/angular-route.js'
].map(function(path) {
    return 'resources/' + path;
});

var jsAppFilesToInject = [
    'app.js',
    'services/UserService.js',
    'services/ProductService.js',
    'services/ProductOfferingService.js',
    'services/ProductCatalogueService.js',
    'services/ProductCategoryService.js',
    'services/AssetService.js',
    'services/AssetTypeService.js',
    'controllers/MessageController.js',
    'controllers/UserController.js',
    'controllers/ProductController.js',
    'controllers/ProductOfferingController.js',
    'controllers/ProductCatalogueController.js',
    'controllers/ProductCategoryController.js',
    'routes.js'
].map(function(path) {
    return 'resources/core/js/' + path;
});

var renderTemplate = function(req, res, customTitle, viewName, userRole) {

    // TODO: Maybe an object with extra properties.
    // To be implemented if required!!

    var validCustomTitle = customTitle !== undefined && customTitle !== '';
    var title = validCustomTitle ? DEFAULT_TITLE + ' - ' + customTitle : DEFAULT_TITLE;

    var properties = {
        user: req.user,
        userRole: userRole,
        title: title,
        contextPath: config.portalPrefix,
        proxyPath: config.proxyPrefix,
        cssFilesToInject: cssFilesToInject,
        jsDepFilesToInject: jsDepFilesToInject,
        jsAppFilesToInject: jsAppFilesToInject,
        accountHost: config.oauth2.server
    };

    res.render(viewName, properties);
    res.end();

};

app.get(config.portalPrefix + '/', function(req, res) {
    renderTemplate(req, res, 'Marketplace', 'home-content', 'Customer');
});

app.get(config.portalPrefix + '/mystock', function(req, res) {
    renderTemplate(req, res, 'My Stock', 'mystock-content', 'Seller');
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

log.info('Starting PEP proxy in port ' + PORT + '.');

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