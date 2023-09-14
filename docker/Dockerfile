FROM node:18 as build

WORKDIR /opt/business-ecosystem-logic-proxy

COPY ./ .

RUN mkdir -p indexes && \
    mkdir -p themes && \
    export USER=root && \
    npm install --unsafe && \
    mkdir etc && \
    cp config.js etc/config.js && \
    echo "module.exports = require('./etc/config');" > config.js

FROM node:18 as main

LABEL MAINTAINER="Future Internet Consulting and Development Solutions S.L."

COPY --from=build /opt/business-ecosystem-logic-proxy /opt/business-ecosystem-logic-proxy

WORKDIR /opt/business-ecosystem-logic-proxy

RUN apt-get update && apt-get install -y xinetd wget curl

COPY ./docker/entrypoint.sh /
COPY ./docker/cleanIndex.sh /
COPY ./docker/getConfig.js /opt/business-ecosystem-logic-proxy
     
COPY ./docker/serviceIndexes /etc/xinetd.d/

EXPOSE 8004

HEALTHCHECK CMD curl --fail http://localhost:8004/version || exit 1

ENTRYPOINT ["/entrypoint.sh"]
