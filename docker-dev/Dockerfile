FROM ubuntu:16.04

MAINTAINER CoNWeT Lab. Universidad Politécnica de Madrid

RUN apt-get update && apt-get install -y git xinetd python-pip wget && \
    pip install sh requests && \
    wget https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz && \
    tar -xvf node-v6.9.1-linux-x64.tar.xz && \
    echo 'export PATH=$PATH:/node-v6.9.1-linux-x64/bin' >> ~/.bashrc && \
    export PATH=$PATH:/node-v6.9.1-linux-x64/bin && \
    mkdir business-ecosystem-logic-proxy && \
    echo "#!/bin/bash" > /entrypoint.sh && \
    echo "while true; do sleep 1000; done" >> /entrypoint.sh && chmod +x /entrypoint.sh

VOLUME /business-ecosystem-logic-proxy

EXPOSE 8004

ENTRYPOINT ["/entrypoint.sh"]
