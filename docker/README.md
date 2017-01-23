# Business Ecosystem Logic Proxy Docker Image

Starting on version 5.4.0, you are able to run the Business API Ecosystem with Docker. In this context, the current repository contains the Docker image of the Business Ecosystem Logic Proxy component, so you can run it stand alone.

You can build a docker image based on this Dockerfile. This image will contain only an instance of the Business Ecosystem Logic Proxy, exposing port `8000`. This requires that you have [docker](https://docs.docker.com/installation/) installed on your machine.

The current Business API Ecosystem uses the FIWARE IdM to run. In this way, you have to register your instance in the FIWARE IdM as described in the [Business API Ecosystem installation guide](http://business-api-ecosystem.readthedocs.io/en/latest/installation-administration-guide.html#configuring-the-logic-proxy) before running the container since the IdM credentials are required.

If you just want to have a Business Ecosystem Logic Proxy instance running as quickly as possible jump to section *The Fastest Way*.

If you want to know what is behind the scenes of our container you can go ahead and read the build and run sections.

## The Fastest Way

To run Business Ecosystem Logic Proxy using Docker, just run the following command:

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
    -p your-port:8000 conwetlab/biz-ecosystem-logic-proxy
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
$ docker inspect your-containe
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

### Run the container

The following line will run the container exposing port `8004`, give it a name -in this case `proxy1`. This uses the image built in the previous section.

```

sudo docker run --name charging1 \
    -e OAUTH2_CLIENT_ID=1111 \
    -e OAUTH2_CLIENT_SECRET=1111 \
    -e BIZ_ECOSYS_PORT=8004 \
    -e BIZ_ECOSYS_HOST=localhost \
    -e GLASSFISH_HOST=192.168.1.3 \
    -e GLASSFISH_PORT=8080 \
    -e CHARGING_HOST=localhost \
    -e CHARGING_PORT=8006 \
    -p 8004:8000 biz-ecosystem-logic-proxy

```

As a result of this command, there is a Logic Proxy listening on port 8004 on localhost.

A few points to consider:

* The name `proxy1` can be anything and doesn't have to be related to the name given to the docker image in the previous section.
* In `-p 8004:8000` the first value represents the port to listen on localhost. If you want to run a second Logic Proxy on your machine you should change this value to something else, for example `-p 8001:8000`.
