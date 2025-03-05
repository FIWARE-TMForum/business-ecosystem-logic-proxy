# Business API Ecosystem Logic Proxy Dev Docker

This directory includes a *Dockerfile* and a *docker-compose.yml* files that enable using a completely configured Ubuntu 20.04
machine, with all the software dependencies installed, for developing stuff over the business-ecosystem-logic-proxy
software.

The first step for using this container is building it, you can do that with the following command:

```
docker build -t proxy-dev .
```

Then, you can run the container as well as another one containing MongoDB using the following command:

```
docker compose up
```

You can stop the containers with the following command:

```
docker compose stop
```

And start them again with:

```
docker compose start
```

Moreover, you can terminate the containers with:

```
docker compose down
```

The provided *docker-compose.yml* file is creating a volume called *proxy-data* which includes all the saved information
in MongoDB, so you can persist it or used it as a backup.

In addition, docker compose is going to create a volume over the main folder of the sources, so you can modify,
test or execute the software inside the container. To access to the container execute the following command:

```
docker exec -ti dockerdev_proxy_1 /bin/bash
```

## Development setup

In order to setup a local development environment, running the Logic Proxy, TMForum APIs and the Context Broker, the following steps need to be taken:

> :warning: The scripts are tested on Ubuntu and require [mustache](https://mustache.github.io/), [docker](https://docs.docker.com/engine/install/) and [docker compose](https://docs.docker.com/compose/install/) to be available.

1. Configure version and TMForum-APIs to be included at [tmforum.yaml](./tmforum.yaml). It already contains sane defaults and only needs to be touched if something very specific is required.
2. In case additional configuration is required, add as env-var in the [proxy-env.mustache](./proxy-env.mustache) file. 
2. Execute the [start-dev.sh](./start-dev.sh). It will create a temporary folder(```target```), build the proxy-image from the current code, render the templates and start the docker environment. 

Follow the instructions of the script, in case you want to preserve data between executions and want to access the logs.

> :warning: The current setup does not include any authorization/authentication components. At the moment it needs to be configured individually. 