const { default: axios } = require('axios');
const { MongoClient } = require('mongodb');
const config = require('./script-config.js')
const {info, error, success, data} = require('./script-config.js')
const {url, catalog_api, category_api, p_offering_api, db_name} = require('./script-config.js')

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
                data("catalog name: " + name)
                data("catalog id: " + id)
                info("creating category with catalog data...")
                response = await axios.post(category_api, {name: name, isRoot: true, lifecycleStatus: "Launched" })
                if (response.status !== 201){
                    error("category creation failed with name: " + name + " status: " + response.status)
                    continue;
                }
                const category_body = response.data
                const category_id = category_body.id
                data("category created with id: " + category_id)

                info(`adding category ${category_id} to the catalog ${id}`)
                if(!categories){
                    categories = []
                }
                categories.push({id: category_id})
                response = await axios.patch(catalog_api + "/" + id, {category: categories})
                if (response.status !== 200){
                    throw Error("cannot add category to catalog")
                }
                success("category added to catalog!")
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
            if (response.status !== 200){
                    error("product offering creation failed with id: " + p_off_body.id + " status: " + response.status)
                    continue;
            }
            success("category added to the product offering")
            updates++
        }
    }
    catch (e){
        error(e)
    }
    finally {
        info(updates + " product offerings updated")
        console.log(`\u001b[37m`)
        await client.close()
    }
    
    
}

run()