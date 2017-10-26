const config = require('./etc/config.js');

if (process.argv[2] == 'mongohost') {
    console.log(config.mongoDb.server);
} else if (process.argv[2] == 'mongoport') {
    console.log(config.mongoDb.port);
} else if (process.argv[2] == 'glasshost') {
    console.log(config.endpoints.catalog.host);
} else if (process.argv[2] == 'glassport') {
    console.log(config.endpoints.catalog.port);
}
