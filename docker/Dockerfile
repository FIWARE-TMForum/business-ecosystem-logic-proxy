FROM node:18 as build

ARG THEME

WORKDIR /opt/business-ecosystem-logic-proxy

COPY ./ .

RUN mkdir -p themes && \
    export USER=root && \
    npm install --unsafe && \
    mkdir etc && \
    cp config.js etc/config.js && \
    echo "module.exports = require('./etc/config');" > config.js && \
    if [[ ! -z "$THEME" ]] ; then cd themes && git clone ${THEME} ; fi

FROM node:18 as main

LABEL MAINTAINER="Future Internet Consulting and Development Solutions S.L."

COPY --from=build /opt/business-ecosystem-logic-proxy /opt/business-ecosystem-logic-proxy

WORKDIR /opt/business-ecosystem-logic-proxy

RUN apt-get update && apt-get install -y xinetd wget curl git

COPY ./docker/entrypoint.sh /
COPY ./docker/getConfig.js /opt/business-ecosystem-logic-proxy

EXPOSE 8004

HEALTHCHECK CMD curl --fail http://localhost:8004/version || exit 1

ENTRYPOINT ["/entrypoint.sh"]
