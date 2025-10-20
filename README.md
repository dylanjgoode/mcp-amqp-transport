# MCP AMQP Transport

AMQP transport implementation for the Model Context Protocol (MCP), enabling MCP servers and clients to communicate over AMQP message brokers like RabbitMQ.

## Features

- **AMQP Transport Layer**: Full implementation of MCP transport over AMQP 0-9-1 protocol
- **Client & Server Support**: Both `ClientAMQPTransport` and `ServerAMQPTransport` classes
- **CLI Adaptors**: Command-line tools to bridge stdio-based MCP servers/clients with AMQP
- **Interceptor Framework**: Base class for building message interceptors (monitoring, security, caching, etc.)
- **Flexible Configuration**: Support for environment variables and direct configuration
- **TLS Support**: Secure connections with AMQPS

## Installation

```bash
npm install mcp-amqp-transport
```

## Usage

### Using Transport Classes

#### Server Transport

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerAMQPTransport } from 'mcp-amqp-transport';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: {} }
);

// Configuration via environment variables
const transport = new ServerAMQPTransport({
  name: 'my-server',
  exchangeName: 'mcp-exchange'
  // hostname, port, username, password read from environment variables
});

await server.connect(transport);
```

#### Client Transport

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ClientAMQPTransport } from 'mcp-amqp-transport';

const client = new Client(
  { name: 'my-client', version: '1.0.0' },
  { capabilities: {} }
);

// Configuration via environment variables
const transport = new ClientAMQPTransport({
  serverName: 'my-server',
  exchangeName: 'mcp-exchange'
  // hostname, port, username, password read from environment variables
});

await client.connect(transport);
```

### Using CLI Adaptors

The package includes two CLI tools for bridging stdio-based MCP implementations with AMQP:

#### Server Adaptor

Wraps an existing stdio-based MCP server to communicate over AMQP:

```bash
# Set environment variables
export AMQP_HOSTNAME=localhost
export AMQP_USERNAME=guest
export AMQP_PASSWORD=guest

mcp-server-amqp-adaptor \
  --serverName my-server \
  --exchangeName mcp-exchange \
  --command "npx" \
  --args "-y" "@modelcontextprotocol/server-everything"
```

#### Client Adaptor

Provides a stdio interface for MCP clients to connect to AMQP-based servers:

```bash
# Set environment variables
export AMQP_HOSTNAME=localhost
export AMQP_USERNAME=guest
export AMQP_PASSWORD=guest

mcp-client-amqp-adaptor \
  --serverName my-server \
  --exchangeName mcp-exchange
```

### Building Interceptors

Create custom message interceptors for monitoring, security, caching, or analytics:

```typescript
import { InterceptorBase, MessageProcessStatus } from 'mcp-amqp-transport';

class MonitoringInterceptor extends InterceptorBase {
  async proccessClientToMCPMessage(message: any): Promise<MessageProcessStatus> {
    console.log('Client -> MCP:', message);
    // Add monitoring logic here
    return MessageProcessStatus.SUCCEEDED_FORWARD;
  }

  async proccessMCPToClientMessage(message: any): Promise<MessageProcessStatus> {
    console.log('MCP -> Client:', message);
    // Add monitoring logic here
    return MessageProcessStatus.SUCCEEDED_FORWARD;
  }
}

// Configuration via environment variables
const interceptor = new MonitoringInterceptor({
  inExchange: 'mcp-exchange-in',
  outExchange: 'mcp-exchange-out'
  // hostname, username, password read from environment variables
});

await interceptor.start();
```

## Configuration

All transport classes and CLI tools support configuration via:

1. **Direct options** (highest priority)
2. **Environment variables** (fallback)

### Environment Variables

- `AMQP_HOSTNAME`: AMQP broker hostname
- `AMQP_PORT`: AMQP broker port (default: 5672 for AMQP, 5671 for AMQPS)
- `AMQP_USERNAME`: AMQP username
- `AMQP_PASSWORD`: AMQP password
- `AMQP_USE_TLS`: Use TLS connection ("true" or "false")

## Architecture

### Message Flow

```
Client -> [mcp.{serverName}.request] -> Server
Server -> [from-mcp.{serverName}.client-id.{clientId}] -> Client
```

### Routing Keys

- **Client to Server**: `mcp.{serverName}.request`
- **Server to Client**: `from-mcp.{serverName}.client-id.{clientId}`
- **Reply routing key**: Passed in message headers as `routingKeyToReply`

### Message ID Handling

The transport automatically augments message IDs with client identifiers to support multiple concurrent clients:

- Client sends message with `id: 1`
- Transport augments to `id: "client-uuid-1"`
- Server processes and responds with augmented ID
- Transport normalizes back to `id: 1` for client

## API Reference

### ServerAMQPTransport

```typescript
interface ServerAMQPTransportOptions {
  name: string;              // Server name
  exchangeName: string;      // AMQP exchange name
  hostname?: string;         // Broker hostname
  port?: number;            // Broker port
  username?: string;        // AMQP username
  password?: string;        // AMQP password
  useTLS?: boolean;         // Use TLS connection
}
```

### ClientAMQPTransport

```typescript
interface ClientAMQPTransportOptions {
  serverName: string;       // Target server name
  exchangeName: string;     // AMQP exchange name
  hostname?: string;        // Broker hostname
  port?: number;           // Broker port
  username?: string;       // AMQP username
  password?: string;       // AMQP password
  useTLS?: boolean;        // Use TLS connection
}
```

### InterceptorBase

```typescript
interface InterceptorOptions {
  inExchange: string;       // Input exchange
  outExchange: string;      // Output exchange
  hostname?: string;        // Broker hostname
  port?: number;           // Broker port
  username?: string;       // AMQP username
  password?: string;       // AMQP password
  useTLS?: boolean;        // Use TLS connection
}

enum MessageProcessStatus {
  SUCCEEDED_FORWARD = 'succeeded_forward',  // Forward message
  SUCCEEDED_REJECT = 'succeeded_reject',    // Reject message
  ERROR = 'error'                           // Error occurred
}
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This project is licensed under the Apache-2.0 License.

