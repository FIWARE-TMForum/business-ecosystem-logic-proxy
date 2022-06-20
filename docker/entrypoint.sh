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

# Get glassfish host and port from config
GLASSFISH_HOST=`node getConfig glasshost`
GLASSFISH_PORT=`node getConfig glassport`

# Wait for glassfish to be running
test_connection 'Glassfish' ${GLASSFISH_HOST} ${GLASSFISH_PORT}

# Wait for APIs to be deployed
GLASSFISH_SCH=`node getConfig glassprot`
GLASSFISH_PATH=`node getConfig glasspath`

echo "Testing Glasfish APIs deployed"
wget ${GLASSFISH_SCH}://${GLASSFISH_HOST}:${GLASSFISH_PORT}/${GLASSFISH_PATH}
STATUS=$?
I=0
while [[ ${STATUS} -ne 0  && ${I} -lt 50 ]]; do
    echo "Glassfish APIs not deployed yet, retrying in 5 seconds..."

    sleep 5
    wget ${GLASSFISH_SCH}://${GLASSFISH_HOST}:${GLASSFISH_PORT}/${GLASSFISH_PATH}
    STATUS=$?

    I=${I}+1
done

echo "Adding cleanService to services"
echo "serviceIndexes  54645/tcp" >> /etc/services

echo "Restarting xinetd service"
service xinetd restart

echo "Cleaning indexes"
rm -rf ./indexes/*

echo "Creating indexes..."
node fill_indexes.js

if [ ${COLLECT} = "True" ]; then
    node collect_static.js
fi

node server.js --max-http-header-size=16384
