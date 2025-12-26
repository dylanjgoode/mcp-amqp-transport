#!/bin/bash
# Run MCP client with AMQP transport

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export SERVER_NAME="${1:-demo-calculator}"
export EXCHANGE_NAME="${2:-mcp-demo}"

cd "$SCRIPT_DIR"
node client-amqp.js
