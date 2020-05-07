#!/usr/bin/env bash

CURRENT_DIR=$(dirname "$BASH_SOURCE")

docker build -t liamd/liamd -f "$CURRENT_DIR/Dockerfile" "$CURRENT_DIR/.."
