# Business Ecosystem Logic Proxy Docker Image

Starting on version 5.4.0, you are able to run the Business API Ecosystem with Docker. In this context, the current repository contains the Docker image of the Business Ecosystem Logic Proxy component, so you can run it stand alone.

You can build a docker image based on this Dockerfile. This image will contain only an instance of the Business Ecosystem Logic Proxy, exposing port `8000`. This requires that you have [docker](https://docs.docker.com/installation/) installed on your machine.

The current Business API Ecosystem uses the FIWARE IdM to run. In this way, you have to register your instance in the FIWARE IdM as described in the [Business API Ecosystem installation guide](http://business-api-ecosystem.readthedocs.io/en/latest/installation-administration-guide.html#configuring-the-logic-proxy) before running the container since the IdM credentials are required.

If you just want to have a Business Ecosystem Logic Proxy instance running as quickly as possible jump to section *The Fastest Way*.

If you want to know what is behind the scenes of our container you can go ahead and read the build and run sections.

## The Fastest Way

Versions of the Business Ecosystem Logic Proxy container higher than 5.4.1, use an external MongoDB container as database and can
be configured using the same mechanisms supported by the software. In this regard, both providing a `config.js` file and 
using environment variables (min version 7.4.0) is supported. For details of the different configuration options have a look
at the [Business API Ecosystem installation guide](https://business-api-ecosystem.readthedocs.io/en/develop/installation-administration-guide.html#configuring-the-logic-proxy)

To run the Business Ecosystem Logic Proxy, `docker-compose` is used. You can use the `docker-compose.yml` file included
with the source of the software, or create a new one with the following content:

```
version: '3'
services:
    mongo:
        image: mongo:3.2
        ports:
            - 27017:27017
        volumes:
            - ./proxy-data:/data/db

    proxy:
        image: conwetlab/biz-ecosystem-logic-proxy:develop
        links:
            - mongo
        depends_on:
            - mongo
        ports:
            - 8000:8000
        volumes:
            # - ./proxy-conf:/business-ecosystem-logic-proxy/etc  # To be used when congiguring the system with a config file provided in the volume
            - ./proxy-indexes:/business-ecosystem-logic-proxy/indexes
            - ./proxy-themes:/business-ecosystem-logic-proxy/themes
            - ./proxy-static:/business-ecosystem-logic-proxy/static
            - ./proxy-locales:/business-ecosystem-logic-proxy/locales
        environment:
            - NODE_ENV=development  # Deployment in development or in production
            - COLLECT=True  # Execute the collect static command on startup

            - BAE_LP_PORT=8000  # Port where the node service is going to run in the container
            - BAE_LP_HOST=proxy.docker  # Host where the node service if going to run in the container
            # - BAE_SERVICE_HOST=https://store.lab.fiware.org/  # If provided, this URL specifies the actual URL that is used to access the BAE, when the component is proxied (e.g Apache)
            # - BAE_LP_HTTPS_ENABLED=true  # If provided specifies whether the service is running in HTTPS, default: false
            # - BAE_LP_HTTPS_CERT=cert/cert.crt  # Certificate for the SSL configuration (when HTTPS enabled is true)
            # - BAE_LP_HTTPS_CA=cert/ca.crt  # CA certificate for the SSL configuration (when HTTPS enabled is true)
            # - BAE_LP_HTTPS_KEY=cert/key.key  # Key sfile for the SSL configuration (when HTTPS enabled is true)
            # - BAE_LP_HTTPS_PORT=443  # Port where the service runs when SSL is enabled (when HTTPS enabled is true)

            # ------ OAUTH2 Config ------
            - BAE_LP_OAUTH2_SERVER=http://idm.docker:8000  # URL of the FIWARE IDM used for user authentication
            - BAE_LP_OAUTH2_CLIENT_ID=id  # OAuth2 Client ID of the BAE applicaiton
            - BAE_LP_OAUTH2_CLIENT_SECRET=secret  # OAuth Client Secret of the BAE application
            - BAE_LP_OAUTH2_CALLBACK=http://proxy.docker:8004/auth/fiware/callback  # Callback URL for receiving the access tokens
            - BAE_LP_OAUTH2_ADMIN_ROLE=admin  # Role defined in the IDM client app for admins of the BAE 
            - BAE_LP_OAUTH2_SELLER_ROLE=seller  # Role defined in the IDM client app for sellers of the BAE 
            - BAE_LP_OAUTH2_CUSTOMER_ROLE=customer  # Role defined in the IDM client app for customers of the BAE 
            - BAE_LP_OAUTH2_ORG_ADMIN_ROLE=orgAdmin  # Role defined in the IDM client app for organization admins of the BAE 
            - BAE_LP_OAUTH2_IS_LEGACY=false  # Whether the used FIWARE IDM is version 6 or lower

            # - BAE_LP_THEME=theme  # If provided custom theme to be used by the web site, it must be included in themes volume
            
            # ----- Mongo Config ------
            # - BAE_LP_MONGO_USER=user
            # - BAE_LP_MONGO_PASS=pass
            - BAE_LP_MONGO_SERVER=localhost
            - BAE_LP_MONGO_PORT=27017
            - BAE_LP_MONGO_DB=belp

            - BAE_LP_REVENUE_MODEL=30  # Default market owner precentage for Revenue Sharing models

            # ----- APIs Configuration -----
            # If provided, it supports configuring the contection to the different APIs managed by the logic proxy, by default
            # apis.docker, charging.docker and rss.docker domains are configured
            # - BAE_LP_ENDPOINT_CATALOG_PATH=DSProductCatalog
            # - BAE_LP_ENDPOINT_CATALOG_PORT=8080
            # - BAE_LP_ENDPOINT_CATALOG_HOST=apis.docker
            # - BAE_LP_ENDPOINT_CATALOG_SECURED=false
            # ...
```

The biz-ecosystem-logic-proxy image defines 4 volumes. In particular:
* */business-ecosystem-logic-proxy/etc*: When file configuration is used, this volume must include the `config.js` file with the software configuration
* */business-ecosystem-logic-proxy/indexes*: This volume contains the indexes used by the Business API Ecosystem for searching
* */business-ecosystem-logic-proxy/themes*: In this volume, it can be provided the themes that can be used to customize the web portal
* */business-ecosystem-logic-proxy/static*: This volume includes the static files ready to be rendered including the selected theme and js files

Additionally, the image defines two environment variables intended to optimize the production deployment of the BAE Logic proxy:
* *NODE_ENV*: Specifies whether the system is in *development* or in *production* (default: development)
* *COLLECT*: Specifies if the container should execute the collect static command to generate static files or use the existing on start up (default: True)

As can be seen in the `docker-compose.yml` file, configuration can be provided as environment variables (min version 7.4.0). If this feature is used,
providing a `config.js` file with the configuration is not necessary, taking into account that the environment values override the file ones.

> **Note**
> In version 6.4.0, the *config.js* file must include an extra setting not provided by default called *config.extPort* that must include the port where the proxy is going to run in the host machine

Once you have created the file, run the following command:

```
docker-compose up
```

Then, the Business Ecosystem Logic Proxy should be up and running in `http://YOUR_HOST:PORT/` replacing `YOUR_HOST` by the host of your machine and `PORT` by the port selected in the previous step.

Once the different containers are running, you can stop them using:

```
docker-compose stop
```

And start them again using:

```
docker-compose start
```

Additionally, you can terminate the different containers by executing:

```
docker-compose down
```

### Version 5.4.1

Version 5.4.1 of the docker container uses environment variables for configuration and deploys an internal MongoDB instance.

To run Business Ecosystem Logic Proxy v5.4.1 using Docker, just run the following command:

```
sudo docker run \
    -e OAUTH2_CLIENT_ID=your-oauth-client-id \
    -e OAUTH2_CLIENT_SECRET=your-oauth-client-secret \
    -e BIZ_ECOSYS_PORT=your-port \
    -e BIZ_ECOSYS_HOST=your-host \
    -e GLASSFISH_HOST=glass-host \
    -e GLASSFISH_PORT=glass-port \
    -e CHARGING_HOST=charg-host \
    -e CHARGING_PORT=charg-port \
    -p your-port:8000 conwetlab/biz-ecosystem-logic-proxy:v5.4.1
```

Note in the previous command that it is needed to provide some environment variables. Concretely:

* **OAUTH2_CLIENT_ID**: the client id of your application provided  by the FIWARE IdM
* **OAUTH2_CLIENT_SECRET**: the client secret of your application provided  by the FIWARE IdM
* **BIZ_ECOSYS_PORT**: Port where the Business Ecosystem Logic proxy is going to run, used to build the callaback URL for the IdM
* **BIZ_ECOSYS_HOST**: Host where the Business Ecosystem Logic proxy is going to run,  used to build the callaback URL for the IdM
* **GLASSFISH_HOST**: Host where the Glassfish instance with the TMForum and RSS APIs is running
* **GLASSFISH_PORT**: Port where the Glassfish instance with the TMForum and RSS APIs is running
* **CHARGING_HOST**: Host where the Business Ecosystem Charging Backend is running
* **CHARGING_PORT**: Port where the Business Ecosystem Charging Backend is running

Additionally, the Business Ecosystem Logic Proxy image includes a volume located at */business-ecosystem-logic-proxy/indexes* where the different index files are stored.

If you want to locate the host directory where the volume is being mounted, execute the following command:
```
$ docker inspect your-container
```

As an alternative, you can specify the host directory for the container volume using the -v flag as follows:
```
$ sudo docker run \
    ...
    -v /home/user/indexes:/business-ecosystem-logic-proxy/indexes
    ...
```

## Build the image

If you have downloaded the [Business Ecosystem Logic Proxy's source code](https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy) you can build your own image. The end result will be the same, but this way you have a bit more of control of what's happening.

To create the image, just navigate to the `docker` directory and run:

    sudo docker build -t biz-ecosystem-logic-proxy .

> **Note**
> If you do not want to have to use `sudo` in this or in the next section follow [these instructions](http://askubuntu.com/questions/477551/how-can-i-use-docker-without-sudo).


The parameter `-t biz-ecosystem-logic-proxy` gives the image a name. This name could be anything, or even include an organization like `-t conwetlab/biz-ecosystem-logic-proxy`. This name is later used to run the container based on the image.

If you want to know more about images and the building process you can find it in [Docker's documentation](https://docs.docker.com/userguide/dockerimages/).

