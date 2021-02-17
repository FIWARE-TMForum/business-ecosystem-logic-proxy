FROM ubuntu:20.04

LABEL Maintainer="Future Internet Consulting and Development Solutions S.L."

RUN apt-get update && apt-get install -y git vim xinetd wget && \
    apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates && \
    curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
    apt -y install nodejs && \
    mkdir business-ecosystem-logic-proxy

VOLUME /business-ecosystem-logic-proxy

COPY ./entrypoint.sh /

EXPOSE 8004

ENTRYPOINT ["/entrypoint.sh"]
