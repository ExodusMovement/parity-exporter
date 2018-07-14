const fs = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')
const yaml = require('js-yaml')
const polka = require('polka')
const yargs = require('yargs')
const { Registry, Gauge } = require('prom-client')

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

function setGaugeLabels (gauge, labels) {
  const values = gauge.get().values
  if (values.length > 0) {
    const currLabels = values[0].labels
    const needUpdate = labels.some((label, index) => {
      return currLabels[gauge.labelNames[index]] !== label
    })
    if (!needUpdate) return
  }

  gauge.reset()
  gauge.labels(...labels).set(1)
}

function initNodeMetrics (registry, name, url) {
  const gClientVersion = new Gauge({
    name: `${name}_client_info`,
    help: `Client info for ${name}`,
    labelNames: ['version', 'chain', 'error'],
    registers: [registry]
  })
  const gLatestBlock = new Gauge({
    name: `${name}_latest`,
    help: `Information about latest block for ${name}`,
    labelNames: ['hash', 'height'],
    registers: [registry]
  })
  const gLatestBlockHeight = new Gauge({
    name: `${name}_latest_height`,
    help: `Latest block height for ${name}`,
    registers: [registry]
  })
  const gPeerCount = new Gauge({
    name: `${name}_peer_count`,
    help: `Peer count for ${name}`,
    registers: [registry]
  })

  const update = async () => {
    const [
      clientVersion,
      parityChain,
      latestBlock,
      peerCount
    ] = await Promise.all([
      makeRequest(url, 'web3_clientVersion'),
      makeRequest(url, 'parity_chain'),
      makeRequest(url, 'eth_getBlockByNumber', ['latest', false]),
      makeRequest(url, 'net_peerCount')
    ])

    setGaugeLabels(gClientVersion, [clientVersion, parityChain, ''])
    setGaugeLabels(gLatestBlock, [latestBlock.hash, parseInt(latestBlock.number, 16)])
    gLatestBlockHeight.set(parseInt(latestBlock.number, 16))
    gPeerCount.set(parseInt(peerCount, 16))
  }

  return async () => {
    try {
      await update()
    } catch (err) {
      setGaugeLabels(gClientVersion, ['', '', err.message || err])
      setGaugeLabels(gLatestBlock, ['', 0])
      gLatestBlockHeight.set(0)
      gPeerCount.set(0)
    }
  }
}

async function createPrometheusClient (config) {
  const registry = new Registry()

  for (const node of config.nodes) {
    const updateMetrics = initNodeMetrics(registry, node.name, node.url)

    const update = async () => {
      const ts = Date.now()
      await updateMetrics()
      setTimeout(update, Math.max(10, config.interval - (Date.now() - ts)))
    }
    update()
  }

  return (req, res) => {
    res.setHeader('Content-Type', registry.contentType)
    res.end(registry.metrics())
  }
}

async function main () {
  const args = getArgs()
  const config = await readConfig(args.config)

  const onRequest = await createPrometheusClient(config)
  polka().get('/metrics', onRequest).listen(config.port)

  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}

main().catch((err) => {
  console.error(err.stack || err)
  process.exit(1)
})
