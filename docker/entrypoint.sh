#!/bin/bash

service mongodb start

python /entrypoint.py

sleep 15

echo "Adding cleanService to services"
echo "serviceIndexes  54645/tcp" >> /etc/services

echo "Restarting xinetd service"
service xinetd restart

sed -i "s|config\.port|'$BIZ_ECOSYS_PORT'|" /business-ecosystem-logic-proxy/lib/tmfUtils.js

echo "Cleaning indexes"
rm -rf ./indexes/*
echo "Creating indexes..."
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node fill_indexes.js
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node server.js
