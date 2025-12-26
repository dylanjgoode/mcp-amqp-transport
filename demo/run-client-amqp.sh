#!/bin/bash
# Run the MCP client with AMQP transport adaptor

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_NAME="${1:-demo-calculator}"
EXCHANGE_NAME="${2:-mcp-demo}"

echo "Starting MCP client with AMQP transport..."
echo "Connecting to server: $SERVER_NAME"
echo "Exchange name: $EXCHANGE_NAME"
echo ""

# Run the client through the AMQP adaptor
cd "$SCRIPT_DIR/.."
AMQP_USE_TLS=false node dist/adaptor/mcp_client_amqp_adaptor.js \
  --serverName "$SERVER_NAME" \
  --exchangeName "$EXCHANGE_NAME" \
  --hostname localhost \
  --username guest \
  --password guest
