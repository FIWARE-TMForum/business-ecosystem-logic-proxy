#!/bin/bash

service mongodb start

python /entrypoint.py

sleep 15

/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin/node server.js
