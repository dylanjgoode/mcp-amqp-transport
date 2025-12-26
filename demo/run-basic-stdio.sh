#!/bin/bash
# Basic demo using standard stdio transport (no AMQP)

echo "========================================="
echo "Demo 1: Basic MCP with stdio transport"
echo "========================================="
echo ""
echo "This runs the client and server using standard stdio."
echo "They communicate via pipes (default MCP behavior)."
echo ""

cd "$(dirname "$0")"
node client.js
