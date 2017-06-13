#!/bin/bash

service mongodb start

python /entrypoint.py

sleep 15

sed -i "s|config\.port|'$BIZ_ECOSYS_PORT'|" /business-ecosystem-logic-proxy/lib/tmfUtils.js

echo "Repairing npm dependencies"
rm -rf node_modules
npm install

npm remove search-index-searcher

npm install search-index-searcher@0.1.27
npm install search-index-adder@^0.1.27
npm install bunyan@^1.8.1
npm install leveldown@^1.5.0
npm install levelup@^1.3.3

echo "Done repairing"

echo "Cleaning indexes"
rm -rf ./indexes/
echo "Creating indexes..."
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node fill_indexes.js
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node server.js
