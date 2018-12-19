FROM ubuntu:16.04

MAINTAINER CoNWeT Lab. Universidad Politécnica de Madrid

RUN apt-get update && apt-get install -y git vim xinetd python-pip wget && \
    pip install sh requests && \
    wget https://nodejs.org/dist/v8.12.0/node-v8.12.0-linux-x64.tar.xz && \
    tar -xvf node-v8.12.0-linux-x64.tar.xz && \
    echo 'export PATH=$PATH:/node-v8.12.0-linux-x64/bin' >> ~/.bashrc && \
    export PATH=$PATH:/node-v8.12.0-linux-x64/bin && \
    mkdir business-ecosystem-logic-proxy

VOLUME /business-ecosystem-logic-proxy

COPY ./entrypoint.sh /

EXPOSE 8004

ENTRYPOINT ["/entrypoint.sh"]
