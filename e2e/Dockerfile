FROM node:16

WORKDIR /usr/local/bin

COPY sourceplusplus-*.tgz ./sourceplusplus.tgz

RUN npm install ./sourceplusplus.tgz

COPY E2ETest.js .

ADD ./spp-probe.yml .

# live-platform uses self-signed cert for testing
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

CMD ["node", "E2ETest.js"]
