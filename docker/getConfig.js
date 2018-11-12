const config = require('./etc/config.js');

const secured = config.endpoints.inventory.appSsl;

if (!!process.env.BAE_LP_ENDPOINT_INVENTORY_SECURED) {
    secured = process.env.BAE_LP_ENDPOINT_INVENTORY_SECURED == 'true';
}

const availableConf = {
    mongohost: process.env.BAE_LP_MONGO_SERVER || config.mongoDb.server,
    mongoport: process.env.BAE_LP_MONGO_PORT || config.mongoDb.port,
    glasshost: process.env.BAE_LP_ENDPOINT_INVENTORY_HOST || config.endpoints.inventory.host,
    glassport: process.env.BAE_LP_ENDPOINT_INVENTORY_PORT || config.endpoints.inventory.port,
    glassprot: secured ? 'https' : 'http',
    glasspath: process.env.BAE_LP_ENDPOINT_INVENTORY_PATH || config.endpoints.inventory.path
};

console.log(availableConf[process.argv[2]]);

