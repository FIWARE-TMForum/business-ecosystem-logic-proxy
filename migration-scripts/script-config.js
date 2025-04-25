const config = require('../config')


const db_name = config.mongoDb.db
const mongo_host = config.mongoDb.server
const mongo_port = config.mongoDb.port
const user = config.mongoDb.user
const pass = config.mongoDb.password

const product_catalog_path = `http://${config.endpoints.catalog.host}:${config.endpoints.catalog.port}`
const category_api = `${product_catalog_path}/category`
const catalog_api = `${product_catalog_path}/catalog`
const p_offering_api = `${product_catalog_path}/productOffering`
const p_spec_api = `${product_catalog_path}/productSpecification`


let url
if (user != null && user.length > 0) {
    url = `mongodb://${user}:${pass}@${mongo_host}:${mongo_port}/${db_name}?authSource=${db_name}`
} else {
    url = `mongodb://${mongo_host}:${mongo_port}/${db_name}`
}

function success(text){
    console.log(`\u001b[32m${text}\u001b[37m`)
}
function info(text){
    console.log(`\u001b[33m${text}\u001b[37m`)
}
function data(text){
    console.log(`\u001b[35m${text}\u001b[37m`)
}
function error(text){
    console.log(`\u001b[31merror: ${text}\u001b[37m`)
}

module.exports = {
    db_name,
    category_api,
    catalog_api,
    p_offering_api,
    p_spec_api,
    url,
    error,
    info,
    data,
    success
  };