FROM ubuntu:16.04

ENV VERSION integrate

RUN apt-get update && apt-get install -y git xinetd python-pip wget mongodb && \
    pip install sh requests

#RUN mkdir bae-logic-proxy-dc
#RUN cd bae-logic-proxy-dc
#RUN git init
#RUN git pull https://1a8ff81e8fac3f4b3780bd78f11876f493e16050@github.com/CDECatapult/bae-logic-proxy-dc.git

RUN git clone https://1a8ff81e8fac3f4b3780bd78f11876f493e16050@github.com/CDECatapult/bae-logic-proxy-dc.git

WORKDIR bae-logic-proxy-dc

RUN wget https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.xz && \
    tar -xvf node-v6.9.1-linux-x64.tar.xz && \
    echo 'export PATH=$PATH:/bae-logic-proxy-dc/node-v6.9.1-linux-x64/bin' >> ~/.bashrc

RUN git fetch --all
RUN git checkout $VERSION && \
    mkdir indexes && \
    mkdir themes

VOLUME /bae-logic-proxy-dc/indexes
VOLUME /bae-logic-proxy-dc/themes
VOLUME /bae-logic-proxy-dc/static

RUN export PATH=$PATH:/bae-logic-proxy-dc/node-v6.9.1-linux-x64/bin
RUN ./install.sh
RUN mkdir etc
RUN cp config.js.template etc/config.js
RUN echo "module.exports = require('./etc/config');" > config.js

COPY ./entrypoint.sh /
COPY ./cleanIndex.sh /
COPY ./getConfig.js /bae-logic-proxy-dc
     
COPY ./serviceIndexes /etc/xinetd.d/

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
