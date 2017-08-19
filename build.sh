#!/usr/bin/env bash

unset ${!DOCKER_*}

docker build --no-cache -t iromu/weplay-compressor:latest .
