const { default: axios } = require('axios');
const { MongoClient } = require('mongodb');


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

async function run(){
    
    const client = new MongoClient(url)
    let updates= 0
    let category_map = {}
    try {
        info("connecting to the proxy's database...")
        await client.connect()
        const db = await client.db(db_name)
        await db.command({ ping: 1 });
        success("connected!")
        const coll = db.collection("offering")
        const databases = await client.db().admin().listDatabases();
        console.log("Databases:", databases);
        const count = await coll.countDocuments()
        console.log("count: " + count)
        const result = await coll.find()
        info("iterating through the collection")
        for await (const element of result){
            // requesting catalog api
            const id = element.catalog
            const p_off_id = element.id
            let response = await axios.get(catalog_api + "/" + id)
            if (response.status !== 200){
                error("cannot retrieve the catalog with id: " + id )
                continue;
            }
            const catalog_body = response.data
            const name = catalog_body.name
            let categories = catalog_body.category
            // if category was not created
            if (!(id in category_map)){
                info("catalog name: " + name)
                info("catalog id: " + id)
                info("creating category with catalog data...")
                response = await axios.post(category_api, {name: name, isRoot: true, lifecycleStatus: "Launched" })
                if (response.status !== 201){
                    error("category creation failed with name: " + name + " status: " + response.status)
                    continue;
                }
                const category_body = response.data
                const category_id = category_body.id
                info("category created with id: " + category_id)

                info(`adding category ${category_id} to the catalog ${id}`)
                if(!categories){
                    categories = []
                }
                categories.push({id: category_id})
                response = await axios.patch(catalog_api + "/" + id, {category: categories})
                if (response.status !== 200){
                    throw Error("cannot add category to catalog")
                }
                // register category created in map
                category_map[id] = category_id
            }

            info(`adding category ${category_map[id]} to the product offering ${p_off_id}`)
                response = await axios.get(p_offering_api + "/" + p_off_id)
                const p_off_body = response.data
                let p_off_cat = p_off_body.category
                if(!p_off_cat){
                    p_off_cat = []
                }
                p_off_cat.push({id: category_map[id]})
                response = await axios.patch(p_offering_api + "/" + p_off_id, {category: p_off_cat})
                if (response.status !== 201){
                    error("category creation failed with name: " + name)
                    continue;
                }
            updates++
        }
        
        
    }
    catch (e){
        error(e)
    }
    finally {
        info(updates + "product offering updated")
        console.log(`\u001b[37m`)
        await client.close()
    }
    
    
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
run()