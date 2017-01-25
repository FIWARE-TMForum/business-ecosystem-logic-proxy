#!/bin/bash

service mongodb start

python /entrypoint.py

sleep 15

sed -i "s|config\.port|'$BIZ_ECOSYS_PORT'|" /business-ecosystem-logic-proxy/lib/tmfUtils.js


echo "Creating indexes..."
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node fill_indexes.js
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node server.js
