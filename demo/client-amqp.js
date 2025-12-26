#!/usr/bin/env node
// MCP Client using AMQP transport directly (not stdio)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ClientAMQPTransport } from "../dist/index.js";

async function main() {
  const serverName = process.env.SERVER_NAME || "demo-calculator";
  const exchangeName = process.env.EXCHANGE_NAME || "mcp-demo";

  console.log("Starting MCP client with AMQP transport...");
  console.log(`Connecting to server: ${serverName}`);
  console.log(`Exchange: ${exchangeName}\n`);

  // Create MCP client
  const client = new Client(
    {
      name: "demo-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  // Create AMQP transport
  const transport = new ClientAMQPTransport({
    serverName: serverName,
    exchangeName: exchangeName,
    hostname: "localhost",
    username: "guest",
    password: "guest",
    useTLS: false,
  });

  // Connect to server
  await client.connect(transport);
  console.log("✓ Connected to MCP server\n");

  // List available tools
  const toolsList = await client.listTools();
  console.log("📋 Available tools:");
  toolsList.tools.forEach((tool) => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  // Call some tools
  console.log("\n🔧 Testing tools:");

  // Test addition
  console.log("\n1. Adding 5 + 3:");
  const addResult = await client.callTool({
    name: "add",
    arguments: { a: 5, b: 3 },
  });
  console.log(`   ${addResult.content[0].text}`);

  // Test multiplication
  console.log("\n2. Multiplying 7 * 6:");
  const multiplyResult = await client.callTool({
    name: "multiply",
    arguments: { a: 7, b: 6 },
  });
  console.log(`   ${multiplyResult.content[0].text}`);

  // Get server info
  console.log("\n3. Getting server info:");
  const infoResult = await client.callTool({
    name: "get_server_info",
    arguments: {},
  });
  console.log(`   ${infoResult.content[0].text}`);

  // Close connection
  await client.close();
  console.log("\n✓ Demo completed successfully!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Client error:", error);
  process.exit(1);
});
