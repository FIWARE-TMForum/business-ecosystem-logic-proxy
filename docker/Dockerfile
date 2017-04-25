FROM ubuntu:16.04

RUN apt-get update && apt-get install -y git python-pip wget mongodb

RUN pip install sh

RUN git clone https://github.com/FIWARE-TMForum/business-ecosystem-logic-proxy

WORKDIR business-ecosystem-logic-proxy

RUN wget https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz

RUN tar -xvf node-v6.9.1-linux-x64.tar.xz

RUN echo 'export PATH=$PATH:/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin' >> ~/.bashrc

RUN git checkout develop

RUN mkdir indexes
VOLUME /business-ecosystem-logic-proxy/indexes

RUN export PATH=$PATH:/business-ecosystem-logic-proxy/node-v6.9.1-linux-x64/bin; npm install

RUN cp config.js.template config.js

COPY ./entrypoint.py /
COPY ./entrypoint.sh /

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
