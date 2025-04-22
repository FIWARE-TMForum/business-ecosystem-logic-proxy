#!/usr/bin/env bash

function test_connection {
    echo "Testing $1 connection"
    exec 10<>/dev/tcp/$2/$3
    STATUS=$?
    I=0

    while [[ ${STATUS} -ne 0  && ${I} -lt 50 ]]; do
        echo "Connection refused, retrying in 5 seconds..."
        sleep 5

        exec 10<>/dev/tcp/$2/$3
        STATUS=$?

        I=${I}+1
    done

    exec 10>&- # close output connection
    exec 10<&- # close input connection

    if [[ ${STATUS} -ne 0 ]]; then
        echo "It has not been possible to connect to $1"
        exit 1
    fi

    echo "$1 connection, OK"
}

if [ -z $COLLECT ]; then
    COLLECT="True"
fi

# Get mongodb host and port from config file
MONGO_HOST=`node getConfig mongohost`
MONGO_PORT=`node getConfig mongoport`

# Wait for mongodb to be running
test_connection 'MongoDB' ${MONGO_HOST} ${MONGO_PORT}

# Load remote theme if needed
if [ ! -z ${BAE_LP_THEME_URL} ]; then
    cd themes
    git clone ${BAE_LP_THEME_URL}
    cd ..
fi

export NODE_ENV=develop
if [ ${COLLECT} = "True" ]; then
    node collect_static.js
fi

if [ ${MIGRATE_DATA} = "True" ]; then
    cd migration-scripts
    node offering_owner.js
    node default_catalog.js
    node offering_migration.js
    cd ..
fi

node server.js --max-http-header-size=16384
