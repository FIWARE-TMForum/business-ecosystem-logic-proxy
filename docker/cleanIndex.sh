#!/bin/bash

echo "Cleaning indexes"
rm -rf /business-ecosystem-logic-proxy/indexes/*
echo $? 2>1
node /opt/business-ecosystem-logic-proxy/fill_indexes.js
echo $? 2>1
exit 0
