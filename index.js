#!/usr/bin/env node
const fetch = require('node-fetch')
const polka = require('polka')
const yargs = require('yargs')
const winston = require('winston')
const { Registry, Gauge } = require('prom-client')
const { hashObject } = require('prom-client/lib/util')
const BigNumber = require('bignumber.js')

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
})

function getArgs () {
  return yargs
    .usage('Usage: $0 [options]')
    .env('PARITY_EXPORTER')
    .option('interval', {
      default: 100,
      describe: 'Metrics fetch interval',
      type: 'number'
    })
    .option('listen', {
      coerce (arg) {
        const [hostname, port] = arg.split(':')
        return { hostname, port }
      },
      default: 'localhost:8000',
      describe: 'Provide metrics on host:port/metrics',
      type: 'string'
    })
    .option('node', {
      default: 'http://localhost:8545/',
      describe: 'Fetch info from this node'
    })
    .version()
    .help('help').alias('help', 'h')
    .argv
}

async function makeRequest (url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 42
    }),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })

  const json = await res.json()
  if (json.error) throw new Error(`RPC error for ${url} (code: ${json.error.code}): ${json.error.message}`)

  return json.result
}

function initParityMetrics (registry, nodeURL) {
  const createGauge = (name, help, labelNames) => new Gauge({ name, help, labelNames, registers: [registry] })

  const gauges = {
    version: createGauge('client_version', 'Client version', ['value']),
    chain: createGauge('client_chain', 'Client chain', ['value']),
    latest: {
      hash: createGauge('client_blockchain_latest', 'Latest block information', ['hash']),
      sync: createGauge('client_blockchain_sync', 'Blockchain sync info', ['type'])
    },
    mempool: createGauge('client_mempool_size', 'Mempool information', ['type']),
    fee: createGauge('client_fee', 'Approximate fee per 21000 gas by eth_gasPrice method', []),
    peers: createGauge('client_peers', 'Connected peers', ['version'])
  }

  const data = {
    version: '',
    chain: '',
    latest: '',
    fee: '',
    peers: new Map([['all', 0]])
  }

  return async () => {
    const [
      clientVersion,
      clientChain,
      latestBlock,
      syncInfo,
      gasPrice,
      mempool,
      peersInfo
    ] = await Promise.all([
      makeRequest(nodeURL, 'web3_clientVersion'),
      makeRequest(nodeURL, 'parity_chain'),
      makeRequest(nodeURL, 'eth_getBlockByNumber', ['latest', false]),
      makeRequest(nodeURL, 'eth_syncing'),
      makeRequest(nodeURL, 'eth_gasPrice'),
      makeRequest(nodeURL, 'parity_allTransactions'),
      makeRequest(nodeURL, 'parity_netPeers')
    ])

    // version
    if (data.version !== clientVersion) {
      gauges.version.set({ value: clientVersion }, 1)
      data.version = clientVersion
      logger.info(`update version to ${clientVersion}`)
    }

    // chain
    if (data.chain !== clientChain) {
      gauges.chain.set({ value: clientChain }, 1)
      data.chain = clientChain
      logger.info(`update chain to ${clientChain}`)
    }

    // latest
    if (data.latest !== latestBlock.hash) {
      const [hash, number] = [latestBlock.hash, parseInt(latestBlock.number, 16)]
      if (data.latest) delete gauges.latest.hash.hashMap[hashObject({ hash: data.latest })]
      gauges.latest.hash.set({ hash }, number)
      data.latest = hash
      logger.info(`update latest to ${number} - ${hash}`)

      const [current, highest] = syncInfo
        ? [parseInt(syncInfo.currentBlock, 16), parseInt(syncInfo.highestBlock, 16)]
        : [number, number]

      gauges.latest.sync.set({ type: 'current' }, current)
      gauges.latest.sync.set({ type: 'highest' }, highest)
      gauges.latest.sync.set({ type: 'progress' }, parseFloat((current / highest).toFixed(5)))
    }

    // gas price
    const STANDARD_FEE = 21000
    const ETH_TO_GWEI = 1e18
    const fee = new BigNumber(gasPrice, 16).times(STANDARD_FEE).dividedBy(ETH_TO_GWEI).toFixed(8)
    if (data.fee !== fee) {
      gauges.fee.set(fee)
      data.fee = fee
      logger.info(`update fee to: ${fee}`)
    }

    // mempool
    gauges.mempool.set({ type: 'size' }, mempool.length)
    gauges.mempool.set({ type: 'bytes' }, mempool.reduce((total, tx) => total + tx.raw.length - 2, 0))

    // peers
    // const peers = peersInfo.peers.filter((peer) => peer.network.remoteAddress !== 'Handshake')
    // for (const key of data.peers.keys()) data.peers.set(key, 0)
    // data.peers.set('all', peers.length)
    // for (const peer of peers) data.peers.set(peer.name, (data.peers.get(peer.name) || 0) + 1)
    // for (const [version, value] of data.peers.entries()) {
    //   if (value === 0) delete gauges.peers.hashMap[hashObject({ version })]
    //   else gauges.peers.set({ version }, value)
    // }
    gauges.peers.set({ version: 'all' }, peersInfo.connected)
  }
}

function createPrometheusClient (args) {
  const register = new Registry()
  return {
    update: initParityMetrics(register, args.node),
    onRequest (req, res) {
      res.setHeader('Content-Type', register.contentType)
      res.end(register.metrics())
    }
  }
}

async function main () {
  const args = getArgs()
  const promClient = createPrometheusClient(args)
  await polka().get('/metrics', promClient.onRequest).listen(args.listen)
  logger.info(`listen at ${args.listen.hostname}:${args.listen.port}`)

  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))

  while (true) {
    const ts = Date.now()
    await promClient.update()
    const delay = Math.max(10, args.interval - (Date.now() - ts))
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

main().catch((err) => {
  logger.error(String(err.stack || err))
  process.exit(1)
})
