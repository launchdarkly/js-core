#!/usr/bin/env bash

# Installs and starts Dante (https://www.inet.no/dante/), a real SOCKS5 server, using the
# danted.conf next to this script. Shared by proxy/Dockerfile (for local `docker build` use) and
# the CI workflow.

set -euo pipefail

apt-get update
apt-get install -y --no-install-recommends dante-server
rm -rf /var/lib/apt/lists/*

danted -D -f "$(dirname "$0")/danted.conf"
