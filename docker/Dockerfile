FROM ubuntu:16.04

RUN apt-get update && apt-get install -y git xinetd python-pip wget mongodb vim; \
    pip install sh requests; \
    git clone https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy;

WORKDIR business-ecosystem-logic-proxy

RUN wget https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz; \
    tar -xvf node-v6.9.1-linux-x64.tar.xz; \
    echo 'export PATH=$PATH:/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin' >> ~/.bashrc; \
    git checkout develop; \
    mkdir indexes;
    
VOLUME /business-ecosystem-logic-proxy/indexes

RUN export PATH=$PATH:/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin; \
    npm install; \
    npm remove search-index-searcher; \
    npm install search-index-searcher@0.1.27; \
    npm install search-index-adder@^0.1.27; \
    npm install bunyan@^1.8.1; \
    npm install leveldown@^1.5.0; \
    npm install levelup@^1.3.3; \
    cp config.js.template config.js

COPY ./entrypoint.py / \
     ./entrypoint.sh / \
     ./cleanIndex.sh /
     
COPY ./serviceIndexes /etc/xinetd.d/

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
