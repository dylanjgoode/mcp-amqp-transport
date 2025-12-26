#!/usr/bin/env node
// MCP Server using AMQP transport directly (not stdio)
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ServerAMQPTransport } from "../dist/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Define available tools
const tools = [
  {
    name: "add",
    description: "Add two numbers together",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "multiply",
    description: "Multiply two numbers together",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "get_server_info",
    description: "Get information about this server instance",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

async function main() {
  const serverName = process.env.SERVER_NAME || "demo-calculator";
  const exchangeName = process.env.EXCHANGE_NAME || "mcp-demo";

  console.error(`Starting MCP server with AMQP transport...`);
  console.error(`Server name: ${serverName}`);
  console.error(`Exchange: ${exchangeName}`);
  console.error(`PID: ${process.pid}`);

  // Create MCP server
  const server = new Server(
    {
      name: serverName,
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`Executing tool: ${name} with args:`, args);

    switch (name) {
      case "add":
        return {
          content: [
            {
              type: "text",
              text: `Result: ${args.a + args.b}`,
            },
          ],
        };

      case "multiply":
        return {
          content: [
            {
              type: "text",
              text: `Result: ${args.a * args.b}`,
            },
          ],
        };

      case "get_server_info":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  pid: process.pid,
                  uptime: process.uptime(),
                  timestamp: new Date().toISOString(),
                  serverName: serverName,
                },
                null,
                2
              ),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // Create AMQP transport
  const transport = new ServerAMQPTransport({
    name: serverName,
    exchangeName: exchangeName,
    hostname: "localhost",
    username: "guest",
    password: "guest",
    useTLS: false,
  });

  // Connect server to transport
  await server.connect(transport);
  console.error("✓ Server connected and ready!");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
