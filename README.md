# Parity exporter for Prometheus
![Docker Stars](https://img.shields.io/docker/stars/fanatid/parity-exporter.svg?style=flat-square)
![Docker Pulls](https://img.shields.io/docker/pulls/fanatid/parity-exporter.svg?style=flat-square)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Metrics page example:

```
# HELP foundation_client_info Client info for foundation
# TYPE foundation_client_info gauge
foundation_client_info{version="Parity//v1.10.7-stable-ba79cad-20180619/x86_64-linux-gnu/rustc1.26.1",chain="foundation",error=""} 1

# HELP foundation_latest Information about latest block for foundation
# TYPE foundation_latest gauge
foundation_latest{hash="0xd4be7a1cc1da336d5f2cf4c4d30014bc79d537ae8428adc8ab89d0b6c0b19431",height="5935638"} 1

# HELP foundation_latest_height Latest block height for foundation
# TYPE foundation_latest_height gauge
foundation_latest_height 5935638

# HELP foundation_peer_count Peer count for foundation
# TYPE foundation_peer_count gauge
foundation_peer_count 24
```

Config example:

```
port: 8000
interval: 250 # in ms
nodes:
  - name: foundation
    url: http://localhost:8545/
```

Usage:

```
docker run -p 8000:8000 fanatid/parity-exporter
```

### LICENSE

MIT
