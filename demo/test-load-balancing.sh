#!/bin/bash
# Test load balancing across multiple server instances

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Running client 5 times to see load distribution across 2 servers..."
echo "Look for different PIDs in the server_info results!"
echo ""

for i in {1..5}; do
  echo "=== Client run #$i ==="
  ./start-client.sh demo-calculator mcp-demo 2>/dev/null | grep -A 5 "Getting server info"
  echo ""
done

echo "Check the server logs to see which server handled which requests:"
echo ""
echo "Server 1 requests:"
grep "Executing tool:" /tmp/amqp-server.log | wc -l
echo ""
echo "Server 2 requests:"
grep "Executing tool:" /tmp/amqp-server2.log | wc -l
