const { default: axios } = require('axios');
const config = require('./script-config.js')
const {info, error, success, data} = require('./script-config.js')
const {catalog_api, category_api} = require('./script-config.js')

async function run(){
    
    let map = {}
    try {
        info("retrieving default catalog...")
        const dft_catalog = await retrieveApi("default catalog", catalog_api + "?name=default")
        success("default catalog retrieved")

        if (dft_catalog.length !== 0 ){
            info("default catalog exists")
            return 0
        }

        info("retrieving all catalogs (100 by 100)...")
        const limit = 100
        let offset = 0
        let finished = false
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
                for (const category of catalog.category){
                    map[category.id]= true
                }
            }

        }
        success(`offset finished with ${offset}`)

        info("retrieving all rooted categories...")
        rooted_categories = await retrieveApi("rooted categories", category_api + "?isRoot=true&fields=id,href,name&limit=100") // TODO: use while to iterate 
        success(`all rooted categories retrieved, size: ${rooted_categories.length}`)

        info("getting unassigned categories...")
        let u_categories= []
        for (const r_category of rooted_categories){
            if (r_category.id in map){
                continue
            }
            u_categories.push(r_category)
        }
        success(`unassigned categories gotten, size: ${u_categories.length}`)

        info("creating default catalog...")
        const new_dft_catalog = await createApi("default catalog", catalog_api, {name: "default", category: u_categories, lifecycleStatus: "Launched"})
        success("default catalog created with " +  JSON.stringify(new_dft_catalog, null, 2))
        // axios.delete(catalog_api + "/" + new_dft_catalog.id)
    }
    catch (e){
        error(e)
    }
    finally {

    }
}

async function retrieveApi(api_name, api_url){
    const response = await axios.get(api_url)
    if (response.status !== 200){
        error(`error retrieving ${api_name}: ${response.message}`)
        return 1
    }
    return response.data
}

async function createApi(api_name, api_url, api_body){
    const response = await axios.post(api_url, api_body)
        if (response.status !== 201){
            error(`error creating ${api_name}: ${response.message}`)
            return 1
        }
    return response.data
}

run()
