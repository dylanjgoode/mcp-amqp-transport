#!/bin/bash
# Start MCP server with AMQP transport

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export SERVER_NAME="${1:-demo-calculator}"
export EXCHANGE_NAME="${2:-mcp-demo}"

echo "Starting MCP server #${3:-1} with AMQP..."
cd "$SCRIPT_DIR"
node server-amqp.js
