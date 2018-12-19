#!/usr/bin/env bash

export PATH=$PATH:/node-v8.12.0-linux-x64/bin
cd business-ecosystem-logic-proxy

./install.sh

echo "Proxy-dev deployed"
while true; do sleep 1000; done