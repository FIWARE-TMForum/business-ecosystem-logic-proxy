const {url, p_offering_api, p_spec_api, db_name} = require('./script-config.js')
const { MongoClient } = require('mongodb');
const {info, error, success, data} = require('./script-config.js')
const { default: axios } = require('axios');

async function run(){
    const client = new MongoClient(url)
    try{
        await client.connect()
        const db = client.db(db_name)
        await db.command({ ping: 1 });

        success("connected!")
        const coll = db.collection("offering")
        const databases = await client.db().admin().listDatabases();
        data("databases: " + databases)

        info("iteration through offerings using pagination")
        let offset = 0
        const limit = 100
        let finished = false
        let storedSize = 0
        while(!finished){
            const offerings = await retrieveApi("product offering", 
                p_offering_api+ `?fields=id,isBundle,lifecycleStatus,bundledProductOffering,productSpecification&limit=${limit}&offset=${offset}`)
        
            if(offerings.length === 0 ){
                finished = true
                continue
            }

            for(const prd_off of offerings){

                let prev_offer = await coll.find({id: prd_off.id}).toArray()
                if (prev_offer.length > 0){
                    data(`Skipping: ${prd_off.id}`)
                    continue
                }

                if(!prd_off.isBundle && prd_off.productSpecification){ // if not bundle

                    const id = prd_off.productSpecification.id
                    const product_spec = await retrieveApi("product spec", `${p_spec_api}/${id}?fields=relatedParty`)

                    data(`single offering: ${prd_off.id}`)
                    const owner = product_spec.relatedParty.find((party) => party.role.toLowerCase() === 'owner')

                    coll.insertOne({
                        id: prd_off.id,
                        relatedParty: owner.id,
                        lifecycleStatus: prd_off.lifecycleStatus
                    })
                    storedSize++
                }
                else if(prd_off.isBundle && prd_off.bundledProductOffering && prd_off.bundledProductOffering.length > 0){ // if bundle
                    data(`bundle offering: ${prd_off.id}`)
                    let it = 0
                    for(const off_el of prd_off.bundledProductOffering){ // In case an offering in bundle doesn`t have productSpec

                        info(`iteration number ${it} in bundle offering`)
                        const off_in = await retrieveApi("offering in bundle", `${p_offering_api}/${off_el.id}`)

                        if (!off_in.isBundle && off_in.productSpecification){
                            const id = off_in.productSpecification.id
                            const product_spec = await retrieveApi("product spec", `${p_spec_api}/${id}?fields=relatedParty`)
                            const owner = product_spec.relatedParty.find((party) => party.role.toLowerCase() === 'owner')

                            coll.insertOne({
                                id: prd_off.id,
                                relatedParty: owner.id,
                                lifecycleStatus: prd_off.lifecycleStatus
                            })

                            storedSize++
                            break
                        }
                        // else: do nothing
                    }
                }
                // else: do nothing
            }
            offset+=limit
            info(`finished storing offering owner. Number of offerings stored in mongoDB: ${storedSize}`)

        }
    }
    catch(e) {
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

run()