const { default: axios } = require('axios');
const config = require('./script-config.js')
const { MongoClient } = require('mongodb');
const {info, error, success, data} = require('./script-config.js')
const {url, catalog_api, category_api, db_name} = require('./script-config.js')

async function run(){
    
    const client = new MongoClient(url)
    let map = {}
    try {
        info("connecting to mongoDB...")
        await client.connect()
        const db = await client.db(db_name)
        await db.command({ ping: 1 });
        success("connected!")

        const coll = db.collection("defaultcatalog")
        const catalog_size = await coll.countDocuments()
        if (catalog_size == 1 ){
            info("default catalog exists")
            process.exit(0)
        }else if (catalog_size > 1){
            error("more than 1 default catalog")
            process.exit(1)
        }

        info("retrieving all catalogs (100 by 100)...")
        const limit = 100
        let offset = 0
        let finished = false
        info("storing all used categories by catalogs...")
        info(catalog_api + `?limit=${limit}&offset=${offset}&fields=category`)
        while (!finished) {
            const all_catalogs = await retrieveApi("all catalogs", catalog_api + `?limit=${limit}&offset=${offset}&fields=category`)
            data(JSON.stringify(all_catalogs))
            if (all_catalogs.length === 0){
                finished=true
                continue;
            }
            offset +=limit

            for (const catalog of all_catalogs){
                if (!catalog.category){
                    catalog.category = []
                }

                for (const category of catalog.category){
                    map[category.id] = true
                }
            }

        }
        success(`offset finished with ${offset}`)

        info("retrieving all rooted categories...")
        offset = 0
        finished = false
        let rooted_categories = []
        while(!finished){
            const part_r_cat = await retrieveApi("rooted categories", category_api + `?isRoot=true&fields=id,href,name&limit=${limit}&offset=${offset}`)
            if (part_r_cat.length === 0){
                finished=true
            }
            offset += limit
            data(JSON.stringify(part_r_cat))
            rooted_categories = rooted_categories.concat(part_r_cat)
        }
        success(`offset finished with ${offset}`)
        success(`all rooted categories retrieved, size: ${rooted_categories.length}`)

        info("getting unassigned categories...")
        let u_categories = []
        for (const r_category of rooted_categories){
            if (r_category.id in map){
                continue
            }
            u_categories.push(r_category)
        }
        success(`unassigned categories gotten, size: ${u_categories.length}`)

        info("creating default catalog...")
        const new_dft_catalog = await createApi("default catalog", catalog_api, {name: "default", category: u_categories, lifecycleStatus: "Launched"})
        const dft_id = new_dft_catalog.id
        await coll.insertOne({default_id: dft_id})
        success("default catalog created with " +  JSON.stringify(new_dft_catalog, null, 2))
        // axios.delete(catalog_api + "/" + new_dft_catalog.id)
    }
    catch (e){
        error(e)
    }
    finally {
        console.log(`\u001b[37m`)
        await client.close()
    }
}

async function retrieveApi(api_name, api_url){
    const response = await axios.get(api_url)
    if (response.status !== 200){
        error(`error retrieving ${api_name}: ${response.message}`)
        process.exit(1)
    }
    return response.data
}

async function createApi(api_name, api_url, api_body){
    const response = await axios.post(api_url, api_body)
    if (response.status !== 201){
        error(`error creating ${api_name}: ${response.message}`)
        process.exit(1)
        }
    return response.data
}

run()