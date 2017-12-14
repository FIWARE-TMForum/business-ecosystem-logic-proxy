# Business Ecosystem Logic Proxy Docker Image

Starting on version 5.4.0, you are able to run the Business API Ecosystem with Docker. In this context, the current repository contains the Docker image of the Business Ecosystem Logic Proxy component, so you can run it stand alone.

You can build a docker image based on this Dockerfile. This image will contain only an instance of the Business Ecosystem Logic Proxy, exposing port `8000`. This requires that you have [docker](https://docs.docker.com/installation/) installed on your machine.

The current Business API Ecosystem uses the FIWARE IdM to run. In this way, you have to register your instance in the FIWARE IdM as described in the [Business API Ecosystem installation guide](http://business-api-ecosystem.readthedocs.io/en/latest/installation-administration-guide.html#configuring-the-logic-proxy) before running the container since the IdM credentials are required.

If you just want to have a Business Ecosystem Logic Proxy instance running as quickly as possible jump to section *The Fastest Way*.

If you want to know what is behind the scenes of our container you can go ahead and read the build and run sections.

## The Fastest Way

### New versions

New versions of the Business Ecosystem Logic Proxy container higher than 5.4.1, use an external MongoDB container as database and are
configured using the standard `config.js` file as it is done with the software.

To run the Business Ecosystem Logic Proxy, `docker-compose` is used. To do so, you must create a folder to place a
new file file called `docker-compose.yml` that should include the following content:

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
        image: conwetlab/biz-ecosystem-logic-proxy
        links:
            - mongo
        depends_on:
            - mongo
        ports:
            - 8000:8000
        volumes:
            - ./proxy-conf:/business-ecosystem-logic-proxy/etc
            - ./proxy-indexes:/business-ecosystem-logic-proxy/indexes
            - ./proxy-themes:/business-ecosystem-logic-proxy/themes
            - ./proxy-static:/business-ecosystem-logic-proxy/static
        environment:
            - NODE_ENV=development
```


Additionally, the biz-ecosystem-logic-proxy image contains 4 volumes. In particular:
* */business-ecosystem-logic-proxy/etc*: This directory must include the `config.js` file with the software configuration
* */business-ecosystem-logic-proxy/indexes*: This directory contains the indexes used by the Business API Ecosystem for searching
* */business-ecosystem-logic-proxy/themes*: This directory contains the themes that can be used to customize the web portal
* */business-ecosystem-logic-proxy/static*: This directory includes the static files ready to be rendered including the selected theme and js files

Finally, the biz-ecosystem-logic-proxy uses the environment variable *NODE_ENV* to determine if the software is being used
in *development* or in *production* mode. 

> **Note**
> The *config.js* file must include an extra setting not provided by default called *config.extPort* that must include the port where the proxy is going to run in the host machine

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

