const fs = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')
const yaml = require('js-yaml')
const polka = require('polka')
const yargs = require('yargs')
const winston = require('winston')
const { Registry, Gauge, metrics: promMetrics } = require('prom-client2')

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
})

function getArgs () {
  return yargs
    .usage('Usage: $0 [options]')
    .option('config', {
      coerce: (arg) => path.resolve(arg),
      default: path.join(__dirname, 'config.yaml'),
      type: 'string'
    })
    .version()
    .help('help').alias('help', 'h')
    .argv
}

async function readConfig (config) {
  const content = await fs.readFile(config, 'utf8')
  return yaml.safeLoad(content)
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

function initParityMetrics (registry, nodes) {
  const gauges = {
    version: new Gauge({
      name: `parity_version`,
      help: `Client version`,
      labelNames: ['name', 'value'],
      registers: [registry]
    }),
    latestBlock: new Gauge({
      name: `parity_latest`,
      help: `Latest block information`,
      labelNames: ['name', 'value'],
      registers: [registry]
    }),
    peerCount: new Gauge({
      name: `parity_peer_count`,
      help: `Peer count`,
      labelNames: ['name'],
      registers: [registry]
    })
  }

  const dataNodes = {}
  for (const node of nodes) {
    dataNodes[node.name] = {
      version: '',
      latestBlock: {},
      peerCount: ''
    }
  }

  const update = async ({ name, url }) => {
    const [
      clientVersion,
      latestBlock,
      peerCount
    ] = await Promise.all([
      makeRequest(url, 'web3_clientVersion'),
      makeRequest(url, 'eth_getBlockByNumber', ['latest', false]),
      makeRequest(url, 'net_peerCount')
    ])

    const data = dataNodes[name]

    if (data.version !== clientVersion) {
      gauges.version.labels({ name, value: clientVersion }).set(1)
      data.version = clientVersion
      logger.info(`Update ${name}:version to ${clientVersion}`)
    }

    if (data.latestBlock.hash !== latestBlock.hash) {
      const number = parseInt(latestBlock.number, 16)
      const value = `${number}:${latestBlock.hash}`
      gauges.latestBlock.remove({ name, value: data.latestBlock.value })
      gauges.latestBlock.labels({ name, value }).set(number)
      data.latestBlock = { hash: latestBlock.hash, value }
      logger.info(`Update ${name}:latestBlock to ${value}`)
    }

    if (data.peerCount !== peerCount) {
      const value = parseInt(peerCount, 16)
      gauges.peerCount.labels({ name }).set(value)
      data.peerCount = peerCount
      logger.info(`Update ${name}:peerCount to ${value}`)
    }
  }

  return async () => {
    await Promise.all(nodes.map((node) => update(node)))
  }
}

function createPrometheusClient (config) {
  const register = new Registry()
  if (config.processMetrics) promMetrics.setup(register, 1000)

  return {
    update: initParityMetrics(register, config.nodes),
    onRequest (req, res) {
      res.setHeader('Content-Type', register.contentType)
      res.end(register.exposeText())
    }
  }
}

async function main () {
  const args = getArgs()
  const config = await readConfig(args.config)

  const client = createPrometheusClient(config)
  await polka().get('/metrics', client.onRequest).listen(config.port, config.hostname)
  logger.info(`listen at ${config.hostname}:${config.port}`)

  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))

  while (true) {
    const ts = Date.now()
    await client.update()
    const delay = Math.max(10, config.interval - (Date.now() - ts))
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

main().catch((err) => {
  logger.error(String(err.stack || err))
  process.exit(1)
})
