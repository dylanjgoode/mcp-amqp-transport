#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
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

  // Connect to server via stdio
  const transport = new StdioClientTransport({
    command: "node",
    args: ["server.js"],
  });

  await client.connect(transport);
  console.log("✓ Connected to MCP server");

  // List available tools
  const toolsList = await client.listTools();
  console.log("\n📋 Available tools:");
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
}

main().catch((error) => {
  console.error("Client error:", error);
  process.exit(1);
});
