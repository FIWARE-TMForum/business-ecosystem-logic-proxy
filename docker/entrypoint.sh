#!/bin/bash

service mongodb start

python /entrypoint.py

sleep 15

echo "Creating indexes..."
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node fill_indexes.js
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node server.js
