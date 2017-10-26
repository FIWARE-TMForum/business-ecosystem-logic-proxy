#!/usr/bin/env bash

function test_connection {
    echo "Testing $1 connection"
    exec 10<>/dev/tcp/$2/$3
    STATUS=$?
    I=0

    while [[ ${STATUS} -ne 0  && ${I} -lt 50 ]]; do
        echo "Connection refused, retrying in 5 seconds..."
        sleep 5

        if [[ ${STATUS} -ne 0 ]]; then
            exec 10<>/dev/tcp/$2/$3
            STATUS=$?

        fi
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

# Get mongodb host and port from config file
MONGO_HOST=`/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node getConfig mongohost`
MONGO_PORT=`/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node getConfig mongoport`

# Wait for mongodb to be running
test_connection 'MongoDB' ${MONGO_HOST} ${MONGO_PORT}

# Get glassfish host and port from config
GLASSFISH_HOST=`/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node getConfig glasshost`
GLASSFISH_PORT=`/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node getConfig glassport`

# Wait for glassfish to be running
test_connection 'Glassfish' ${GLASSFISH_HOST} ${GLASSFISH_PORT}

# Include this setting to avoid inconsistencies between docker container port and used port
sed -i "s|config\.port|config\.extPort|" /business-ecosystem-logic-proxy/lib/tmfUtils.js

echo "Adding cleanService to services"
echo "serviceIndexes  54645/tcp" >> /etc/services

echo "Restarting xinetd service"
service xinetd restart

echo "Cleaning indexes"
rm -rf ./indexes/*

echo "Creating indexes..."
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node fill_indexes.js
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node server.js
