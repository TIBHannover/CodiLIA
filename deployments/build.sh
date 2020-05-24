#!/usr/bin/env bash

CURRENT_DIR=$(dirname "$BASH_SOURCE")

docker build -t liascript/liamd -f "$CURRENT_DIR/Dockerfile" "$CURRENT_DIR/.."
