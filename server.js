var config = require('./config'),
    errorhandler = require('errorhandler'),
    fs = require('fs'),
    https = require('https'),
    root = require('./controllers/root').root,
    log = require('./lib/logger').logger.getLogger("Server");
    express = require('express');

config.azf = config.azf || {};
config.https = config.https || {};

var port = config.https.enabled ? 
    config.https.port || 443 :      // HTTPS
    config.pepPort || 80;           // HTTP

// Avoid existing on uncaught Exceptions
process.on('uncaughtException', function (err) {
  log.error('Caught exception: ' + err);
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Express Server
var app = express();
app.set('port', port);

// Middleware to handle unhandled exceptions
app.use(errorhandler({ dumpExceptions: true, showStack: true }));

// Middleware: add body field to the request
app.use (function(req, res, next) {
    
    var data='';
    req.setEncoding('utf8');
    
    req.on('data', function(chunk) { 
       data += chunk;
    });

    req.on('end', function() {
        req.body = data;
        next();
    });
});

// Middleware: Add CORS headers. Handle OPTIONS requests.
app.use(function (req, res, next) {
    'use strict';
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'HEAD, POST, GET, OPTIONS, DELETE');
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
    app.all(config.publicPaths[p], root.public);
}

// The rest of the paths are protected by the Proxy
app.all('/*', root.pep);

// Start Server on the configured PORT
log.info('Starting PEP http in port ' + port + '.');

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