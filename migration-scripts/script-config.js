const db_name = "belp"
const product_catalog_path = "http://host.docker.internal:8632"
const category_api = `${product_catalog_path}/category`
const catalog_api = `${product_catalog_path}/catalog`
const p_offering_api = `${product_catalog_path}/productOffering`
const mongo_host = "host.docker.internal" //mongo
let url
if (process.env.BAE_LP_MONGO_USER != null && process.env.BAE_LP_MONGO_USER.length > 0) {
    url = `mongodb://${process.env.BAE_LP_MONGO_USER}:${process.env.BAE_LP_MONGO_PASS}@mongo:27017/${db_name}?authSource=${db_name}`
} else {
    url = `mongodb://${mongo_host}:27017/${db_name}`
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
    url,
    error,
    info,
    data,
    success
  };