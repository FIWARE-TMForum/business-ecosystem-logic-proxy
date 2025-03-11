const {info, error, success, data} = require('./script-config.js')
const { default: axios } = require('axios');
const {url, p_offering_api, p_spec_api, db_name} = require('./script-config.js')
async function run() {
    const p_spec_array = []
    await create_product_spec_200(p_spec_array)
    info(`size of p_spec: ${p_spec_array.length}`)
    await create_offering_400(p_spec_array)
    await create_bundle_offering_50()
    info('script finished successfully')
}
run()

async function createApi(api_name, api_url, api_body){
    const response = await axios.post(api_url, api_body)
    if (response.status !== 201){
        error(`error creating ${api_name}: ${response.message}`)
        process.exit(1)
        }
    return response.data
}

async function create_product_spec_200(p_spec_array){
    for(let i=0;i<200;i++){
        const payload= {
            "name": `spec ${i}`,
            "description": "",
            "version": "0.1",
            "brand": "test",
            "productNumber": "1234",
            "lifecycleStatus": "Active",
            "isBundle": false,
            "bundledProductSpecification": [],
            "productSpecCharacteristic": [],
            "productSpecificationRelationship": [],
            "attachment": [],
            "relatedParty": [
                {
                    "id": "urn:ngsi-ld:individual:b73dd8ce-b63f-4c5b-be07-ca7ea10ad78e",
                    "role": "Owner",
                    "@referredType": ""
                }
            ],
            "resourceSpecification": [],
            "serviceSpecification": []
        }
        const body = await createApi("crear product specs", p_spec_api, payload)
        data(`product spec: ${body.id}`)
        p_spec_array.push(body.id)
    }
}

async function create_offering_400(p_spec_array){
    for(let i=0;i<400;i++){
        const payload= {
            "name": `offering ${i}`,
            "description": "",
            "lifecycleStatus": "Active",
            "isBundle": false,
            "bundledProductOffering": [],
            "place": [],
            "version": "0.1",
            "category": [],
            "productOfferingPrice": [],
            "validFor": {
                "startDateTime": "2025-03-06T17:25:10.022Z"
            },
            "productSpecification": {
                "id": p_spec_array[i%p_spec_array.length],
                "href": p_spec_array[i%p_spec_array.length]
            },
            "productOfferingTerm": [
                {
                    "name": "",
                    "description": "",
                    "validFor": {}
                }
            ]
        }
        const body = await createApi("crear product offering", p_offering_api, payload)
        data(`product offering: ${body.id}`)
    }
}

async function create_bundle_offering_50(){
    for(let i=0;i<50;i++){
        const payload= {
            "name": `bundleoffering ${i}`,
            "description": "",
            "lifecycleStatus": "Active",
            "isBundle": true,
            "bundledProductOffering": [
                {
                    "id":"urn:ngsi-ld:product-offering:76fc4568-063c-410a-9b0e-fbf7a059b34d",
                    "href":"urn:ngsi-ld:product-offering:76fc4568-063c-410a-9b0e-fbf7a059b34d",
                    "lifecycleStatus": "Active"
                }
            ],
            "place": [],
            "version": "0.1",
            "category": [],
            "productOfferingPrice": [],
            "validFor": {
                "startDateTime": "2025-03-06T17:25:10.022Z"
            }
        }
        const body = await createApi("crear product offering", p_offering_api, payload)
        data(`bundled product offering: ${body.id}`)
    }
}