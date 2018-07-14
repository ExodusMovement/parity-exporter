# Parity exporter for Prometheus
![Docker Stars](https://img.shields.io/docker/stars/fanatid/parity-exporter.svg?style=flat-square)
![Docker Pulls](https://img.shields.io/docker/pulls/fanatid/parity-exporter.svg?style=flat-square)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Metrics page example:

```
# HELP version Client version
# TYPE version gauge
version{chain="classic",value="Parity//v1.10.7-stable-ba79cad-20180619/x86_64-linux-gnu/rustc1.26.1"} 1
version{chain="foundation",value="Parity//v1.10.7-stable-ba79cad-20180619/x86_64-linux-gnu/rustc1.26.1"} 1

# HELP latest_hash Latest block hash
# TYPE latest_hash gauge
latest_hash{chain="classic",value="0x41fab32cc725d60273645801575775a48f8538f81f509a86758d6e568014be37"} 1
latest_hash{chain="foundation",value="0x4dab516a7afd7851743a0b729c6d22930bf860991bf21acabb3a8c6924a56907"} 1

# HELP latest_height Latest block height
# TYPE latest_height gauge
latest_height{chain="classic"} 6180394
latest_height{chain="foundation"} 5964231

# HELP peer_count Peer count
# TYPE peer_count gauge
peer_count{chain="classic"} 23
peer_count{chain="foundation"} 24
```

Config example:

```
port: 8000
interval: 250 # in ms
nodes:
  - name: foundation
    url: http://localhost:8545/
  - name: classic
    url: http://localhost:8555/
```

Usage:

```
docker run -p 8000:8000 fanatid/parity-exporter
```

### LICENSE

MIT
