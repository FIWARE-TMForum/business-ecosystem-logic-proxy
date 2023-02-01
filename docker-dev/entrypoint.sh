#!/usr/bin/env bash

export PATH=$PATH:/node-v14.16.0-linux-x64/bin
cd business-ecosystem-logic-proxy

npm install

echo "Proxy-dev deployed"
while true; do sleep 1000; done
