#!/usr/bin/env bash

cd /business-ecosystem-logic-proxy
npm install

echo "Proxy-dev deployed"

if [ "${MIGRATE_DATA}" = "True" ]; then
    cd migration-scripts
    node offering_owner.js
    node default_catalog.js
    node offering_migration.js
    cd ..
fi

while true; do sleep 1000; done
