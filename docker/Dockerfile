FROM ubuntu:16.04

LABEL Author="CoNWeT Lab. Universidad Politécnica de Madrid"

ENV VERSION master

RUN apt-get update && apt-get install -y git xinetd python-pip wget curl && \
    pip install sh requests && \
    git clone https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy

WORKDIR business-ecosystem-logic-proxy

RUN wget https://nodejs.org/dist/v8.12.0/node-v8.12.0-linux-x64.tar.xz && \
    tar -xvf node-v8.12.0-linux-x64.tar.xz && \
    echo 'export PATH=$PATH:/business-ecosystem-logic-proxy/node-v8.12.0-linux-x64/bin' >> ~/.bashrc && \
    git checkout $VERSION && \
    mkdir indexes && \
    mkdir themes && \
    export USER=root && \
    export PATH=$PATH:/business-ecosystem-logic-proxy/node-v8.12.0-linux-x64/bin && \
    npm install --unsafe && \
    mkdir etc && \
    cp config.js etc/config.js && \
    echo "module.exports = require('./etc/config');" > config.js

VOLUME /business-ecosystem-logic-proxy/indexes
VOLUME /business-ecosystem-logic-proxy/themes
VOLUME /business-ecosystem-logic-proxy/static
VOLUME /business-ecosystem-logic-proxy/locales

COPY ./entrypoint.sh /
COPY ./cleanIndex.sh /
COPY ./getConfig.js /business-ecosystem-logic-proxy
     
COPY ./serviceIndexes /etc/xinetd.d/

EXPOSE 8000

HEALTHCHECK CMD curl --fail http://localhost:8000/version || exit 1

ENTRYPOINT ["/entrypoint.sh"]
