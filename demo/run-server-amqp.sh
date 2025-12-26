#!/bin/bash
# Run the MCP server with AMQP transport adaptor

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_NAME="${1:-demo-calculator}"
EXCHANGE_NAME="${2:-mcp-demo}"

echo "Starting MCP server with AMQP transport..."
echo "Server name: $SERVER_NAME"
echo "Exchange name: $EXCHANGE_NAME"
echo "PID: $$"
echo ""

# Run the server through the AMQP adaptor
cd "$SCRIPT_DIR/.."
AMQP_USE_TLS=false node dist/adaptor/mcp_server_amqp_adaptor.js \
  --serverName "$SERVER_NAME" \
  --exchangeName "$EXCHANGE_NAME" \
  --hostname localhost \
  --username guest \
  --password guest \
  --command "node" \
  --args "$SCRIPT_DIR/server.js"
