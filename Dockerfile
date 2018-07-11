FROM node:10.4.1-alpine

ENV NODE_ENV production

# 1.17 --chown=node:node can be used
COPY . /home/node/parity-exporter
RUN chown -R node:node /home/node/parity-exporter

USER node

# TODO: mount cache folder?
RUN cd /home/node/parity-exporter \
  && yarn \
  && yarn cache clean

EXPOSE 8000
WORKDIR /home/node/parity-exporter

ENTRYPOINT ["node", "index.js"]
