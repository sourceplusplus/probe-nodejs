FROM node:16

WORKDIR /usr/local/bin

COPY sourceplusplus-*.tgz ./sourceplusplus.tgz

RUN npm install ./sourceplusplus.tgz

COPY E2ETest.js .

ADD ./spp-probe.yml .

RUN mkdir config
ADD ./config/spp-platform.crt ./config/

CMD ["node", "E2ETest.js"]