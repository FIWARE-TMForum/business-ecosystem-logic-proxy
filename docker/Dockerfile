FROM ubuntu:16.04

MAINTAINER CoNWeT Lab. Universidad Politécnica de Madrid

ENV VERSION develop

RUN apt-get update && apt-get install -y git xinetd python-pip wget && \
    pip install sh requests && \
    git clone https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy

WORKDIR business-ecosystem-logic-proxy

RUN wget https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz && \
    tar -xvf node-v6.9.1-linux-x64.tar.xz && \
    echo 'export PATH=$PATH:/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin' >> ~/.bashrc && \
    git checkout $VERSION && \
    mkdir indexes && \
    mkdir themes

VOLUME /business-ecosystem-logic-proxy/indexes
VOLUME /business-ecosystem-logic-proxy/themes

RUN export PATH=$PATH:/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin && \
    npm install && \
    mkdir etc && \
    cp config.js.template etc/config.js && \
    echo "module.exports = require('./etc/config');" > config.js

COPY ./entrypoint.sh /
COPY ./cleanIndex.sh /
COPY ./getConfig.js /business-ecosystem-logic-proxy
     
COPY ./serviceIndexes /etc/xinetd.d/

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
