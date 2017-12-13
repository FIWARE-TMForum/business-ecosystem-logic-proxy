#!/usr/bin/env bash

export PATH=$PATH:/node-v6.9.1-linux-x64/bin
cd business-ecosystem-logic-proxy

./install.sh

echo "Proxy-dev deployed"
while true; do sleep 1000; done