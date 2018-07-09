FROM node:10.4.1-alpine

ENV NODE_ENV production

# 1.17 --chown=node:node can be used
COPY . /home/node/parity-prometheus-exporter
RUN chown -R node:node /home/node/parity-prometheus-exporter

USER node

# TODO: mount cache folder?
RUN cd /home/node/parity-prometheus-exporter \
  && yarn \
  && yarn cache clean

ENTRYPOINT ["node", "/home/node/parity-prometheus-exporter/index.js"]
