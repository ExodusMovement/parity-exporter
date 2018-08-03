const fs = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')
const yaml = require('js-yaml')
const polka = require('polka')
const yargs = require('yargs')
const winston = require('winston')
const { Registry, Gauge } = require('prom-client')

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

function setGaugeLabelValue (gauge, name, labelValue, value) {
  const obj = Object.values(gauge.hashMap).find((obj) => obj.labels.name === name)
  if (!obj) return gauge.set({ name, value: labelValue }, value)
  if (obj.labels.value === labelValue && obj.value === value) return

  obj.labels.value = labelValue
  obj.value = value
  logger.info(`${name}:${gauge.name} updated`)
}

function setGaugeValue (gauge, name, value) {
  const obj = Object.values(gauge.hashMap).find((obj) => obj.labels.name === name)
  if (!obj) return gauge.set({ name }, value)
  if (obj.value === value) return

  obj.value = value
  logger.info(`${name}:${gauge.name} updated`)
}

function initParityMetrics (registry, nodes) {
  const gVersion = new Gauge({
    name: `parity_version`,
    help: `Client version`,
    labelNames: ['name', 'value'],
    registers: [registry]
  })
  const gLatest = new Gauge({
    name: `parity_latest`,
    help: `Latest block information`,
    labelNames: ['name', 'value'],
    registers: [registry]
  })
  const gPeerCount = new Gauge({
    name: `parity_peer_count`,
    help: `Peer count`,
    labelNames: ['name'],
    registers: [registry]
  })

  const update = async (name, url) => {
    const [
      clientVersion,
      latest,
      peerCount
    ] = await Promise.all([
      makeRequest(url, 'web3_clientVersion'),
      makeRequest(url, 'eth_getBlockByNumber', ['latest', false]),
      makeRequest(url, 'net_peerCount')
    ])

    setGaugeLabelValue(gVersion, name, clientVersion, 1)
    setGaugeLabelValue(gLatest, name, `${parseInt(latest.number, 16)}:${latest.hash}`, parseInt(latest.number, 16))
    setGaugeValue(gPeerCount, name, parseInt(peerCount, 16))
  }

  const reset = (name) => {
    gVersion.reset()
    gLatest.reset()
    gPeerCount.reset()
  }

  return async () => {
    try {
      await Promise.all(nodes.map(async ({ name, url }) => {
        try {
          await update(name, url)
        } catch (err) {
          logger.error(`can not update ${name}: ${err.message || err}`)
          reset(name)
        }
      }))
    } catch (err) {
      logger.error(`can not update metrics: ${err.message || err}`)
      nodes.map(({ name }) => reset(name))
    }
  }
}

async function createPrometheusClient (config) {
  const registry = new Registry()

  const updateMetrics = initParityMetrics(registry, config.nodes)
  const update = async () => {
    const ts = Date.now()
    await updateMetrics()
    setTimeout(update, Math.max(10, config.interval - (Date.now() - ts)))
  }
  process.nextTick(update)

  return (req, res) => {
    res.setHeader('Content-Type', registry.contentType)
    res.end(registry.metrics())
  }
}

async function main () {
  const args = getArgs()
  const config = await readConfig(args.config)

  const onRequest = await createPrometheusClient(config)
  await polka().get('/metrics', onRequest).listen(config.port, config.hostname)
  logger.info(`listen at ${config.hostname}:${config.port}`)

  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}

main().catch((err) => {
  logger.error(String(err.message || err))
  process.exit(1)
})
