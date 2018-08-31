# Parity exporter for Prometheus

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Metrics page example:

```
# HELP parity_version Client version
# TYPE parity_version gauge
parity_version{value="Parity//v1.11.7-stable-085035f-20180717/x86_64-linux-gnu/rustc1.27.1"} 1

# HELP parity_chain Client chain
# TYPE parity_chain gauge
parity_chain{value="ethereum classic"} 1

# HELP parity_latest Latest block information
# TYPE parity_latest gauge
parity_latest{hash="0xeb9f857555053d93e661e2d9324dcb729c30707e6cbba945fc19f89f4bd73ebc"} 6347076

# HELP bitcoind_blockchain_sync Blockchain sync info
# TYPE bitcoind_blockchain_sync gauge
bitcoind_blockchain_sync{type="current"} 6347076
bitcoind_blockchain_sync{type="highest"} 6362392
bitcoind_blockchain_sync{type="progress"} 0.99759

# HELP parity_gas_price Current gas price in wei
# TYPE parity_gas_price gauge
parity_gas_price 20000000000

# HELP parity_mempool_size Mempool information
# TYPE parity_mempool_size gauge
parity_mempool_size{type="size"} 0
parity_mempool_size{type="bytes"} 0

# HELP parity_peers Connected peers
# TYPE parity_peers gauge
parity_peers{version="all"} 4
```

Usage:

```
docker run \
  -p 8000:8000 \
  -e PARITY_EXPORTER_LISTEN=0.0.0.0:8000 \
  -e PARITY_EXPORTER_NODE=http://parity:8545/ \
  quay.io/exodusmovement/parity-exporter
```

### LICENSE

MIT
