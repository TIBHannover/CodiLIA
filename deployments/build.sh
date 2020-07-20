#!/usr/bin/env bash

set -euo pipefail
set -x

CURRENT_DIR=$(dirname "$BASH_SOURCE")

docker build -t liascript/liamd -f "$CURRENT_DIR/Dockerfile" "$CURRENT_DIR/.."
