# Parity exporter for Prometheus
![Docker Stars](https://img.shields.io/docker/stars/fanatid/parity-exporter.svg?style=flat-square)
![Docker Pulls](https://img.shields.io/docker/pulls/fanatid/parity-exporter.svg?style=flat-square)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Metrics page example:

```
# HELP parity_version Client version
# TYPE parity_version gauge
parity_version{name="classic",value="Parity//v1.10.7-stable-ba79cad-20180619/x86_64-linux-gnu/rustc1.26.1"} 1
parity_version{name="foundation",value="Parity//v1.10.7-stable-ba79cad-20180619/x86_64-linux-gnu/rustc1.26.1"} 1

# HELP parity_latest Latest block information
# TYPE parity_latest gauge
parity_latest{name="classic",hash="0x41fab32cc725d60273645801575775a48f8538f81f509a86758d6e568014be37"} 6180394
parity_latest{name="foundation",hash="0x4dab516a7afd7851743a0b729c6d22930bf860991bf21acabb3a8c6924a56907"} 5964231

# HELP parity_peer_count Peer count
# TYPE parity_peer_count gauge
parity_peer_count{name="classic"} 23
parity_peer_count{name="foundation"} 24
```

Config example:

```
port: 8000
hostname: 127.0.0.1

interval: 100 # in ms
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
