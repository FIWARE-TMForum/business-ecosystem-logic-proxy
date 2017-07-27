#!/bin/bash

echo "Cleaning indexes"
rm -rf /business-ecosystem-logic-proxy/indexes/*
echo $? 2>1
/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node /business-ecosystem-logic-proxy/fill_indexes.js
echo $? 2>1
exit 0
