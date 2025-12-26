# MCP AMQP Transport Demo

This demo showcases the value of using AMQP transport for Model Context Protocol (MCP) applications.

## What's Included

- **server.js**: A simple stdio-based MCP server (for comparison)
- **client.js**: A simple stdio-based MCP client (for comparison)
- **server-amqp.js**: MCP server using AMQP transport directly
- **client-amqp.js**: MCP client using AMQP transport directly

All servers provide calculator tools (add, multiply, get_server_info).

## Prerequisites

1. **RabbitMQ** must be running:
   ```bash
   # Check if running
   brew services list | grep rabbitmq

   # Start if needed
   brew services start rabbitmq
   ```

2. **Dependencies installed**:
   ```bash
   # From the mcp-amqp-transport root directory
   npm install
   npm run build

   # From the demo directory
   cd demo
   npm install
   ```

## Quick Start

### Demo 1: Basic stdio Transport (Default MCP)

This shows how MCP normally works - client and server communicate via stdio pipes.

```bash
./run-basic-stdio.sh
```

**What you'll see:**
- Client spawns server as child process
- They communicate via stdin/stdout
- Works fine for single client/server

**Limitations:**
- ❌ Tight coupling (client must spawn server)
- ❌ No scaling (1 client, 1 server)
- ❌ No fault tolerance
- ❌ Can't run on different machines

---

### Demo 2: AMQP Transport - Same Functionality, Zero Code Changes!

**Terminal 1** - Start the server:
```bash
./start-server.sh
```

**Terminal 2** - Run the client:
```bash
./start-client.sh
```

**What you'll see:**
- ✅ Same calculator server and client
- ✅ Now communicating through RabbitMQ
- ✅ Server and client are decoupled
- ✅ Can run on different machines
- ✅ **Zero code changes to the MCP logic!**

---

### Demo 3: Horizontal Scaling 🚀

The real power: run multiple servers to handle load!

**Terminal 1** - Start server instance #1:
```bash
./start-server.sh
```

**Terminal 2** - Start server instance #2:
```bash
./start-server.sh
```

**Terminal 3** - Start server instance #3 (optional):
```bash
./start-server.sh
```

**Terminal 4** - Test load distribution:
```bash
./test-load-balancing.sh
```

**What you'll see:**
- Multiple server instances all bound to the same queue
- RabbitMQ distributes requests across them
- Check the logs - different servers handle different requests
- **Horizontal scaling with zero configuration!**

**Benefits:**
- ✅ Handle more load by adding servers
- ✅ No load balancer needed - RabbitMQ does it
- ✅ Add/remove servers dynamically
- ✅ Servers don't even know about each other

---

### Demo 4: Fault Tolerance 💪

See what happens when servers crash.

**Terminal 1** - Start server #1:
```bash
./start-server.sh
```

**Terminal 2** - Start server #2:
```bash
./start-server.sh
```

**Terminal 3** - Run the client:
```bash
./start-client.sh
```

**Now try this:**
1. While the client is running, kill server #1 (Ctrl+C in Terminal 1)
2. Run the client again - **it still works!** Server #2 handles it
3. Start server #1 again
4. Kill server #2 (Ctrl+C in Terminal 2)
5. Run client again - server #1 takes over seamlessly

**What you'll see:**
- ✅ System keeps working even when servers crash
- ✅ New servers can join anytime
- ✅ Clients don't care which server handles their request
- ✅ Automatic failover

---

### Demo 5: Decoupling 🌍

Server and client run independently, anywhere.

```bash
# Terminal 1 - Server (could be on Machine A)
./start-server.sh

# Terminal 2 - Client (could be on Machine B)
./start-client.sh

# They communicate through RabbitMQ!
```

**Try this:**
- Run server on your laptop
- Run client on another machine (just change `hostname` to your laptop's IP)
- Run server in Docker container
- Run multiple clients from different machines

---

## Key Benefits Demonstrated

| Feature | stdio Transport | AMQP Transport |
|---------|----------------|----------------|
| **Decoupling** | Client must spawn server | ✅ Run anywhere independently |
| **Scaling** | 1:1 client-server only | ✅ Multiple servers, load balanced |
| **Fault Tolerance** | Server crash = failure | ✅ Other servers take over |
| **Distribution** | Same machine only | ✅ Different machines/containers |
| **Load Balancing** | None | ✅ Built-in via RabbitMQ |
| **Code Changes** | N/A | ✅ **ZERO!** Drop-in replacement |

## File Overview

### Shell Scripts

- `run-basic-stdio.sh` - Run the stdio demo (default MCP behavior)
- `start-server.sh` - Start an AMQP server instance
- `start-client.sh` - Run an AMQP client
- `test-load-balancing.sh` - Test with multiple servers

### JavaScript Files

- `server.js` - Basic MCP server with stdio transport
- `client.js` - Basic MCP client with stdio transport
- `server-amqp.js` - MCP server using AMQP transport directly
- `client-amqp.js` - MCP client using AMQP transport directly

## Monitoring with RabbitMQ Management UI

RabbitMQ includes a web UI for monitoring:

1. Enable management plugin (if not already):
   ```bash
   rabbitmq-plugins enable rabbitmq_management
   ```

2. Open http://localhost:15672
3. Login: username=`guest`, password=`guest`
4. Watch:
   - **Queues tab**: See message rates and queue depths
   - **Connections**: See active clients/servers
   - **Exchanges**: See routing topology

## Architecture

### stdio Transport (Default MCP)
```
┌────────┐ stdio  ┌────────┐
│ Client ├───────►│ Server │
└────────┘        └────────┘
```

### AMQP Transport
```
┌────────┐      ┌─────────┐      ┌────────┐
│Client 1├─────►│         │◄─────┤Server 1│
└────────┘      │ RabbitMQ│      └────────┘
┌────────┐      │  (AMQP) │      ┌────────┐
│Client 2├─────►│         │◄─────┤Server 2│
└────────┘      │  Broker │      └────────┘
┌────────┐      │         │      ┌────────┐
│Client 3├─────►│         │◄─────┤Server 3│
└────────┘      └─────────┘      └────────┘
```

Messages route through RabbitMQ's topic exchange with routing keys:
- Client → Server: `mcp.{serverName}.request`
- Server → Client: `from-mcp.{serverName}.client-id.{clientId}`

## Customization

You can modify the server name and exchange:

```bash
# Start server with custom names
./start-server.sh my-custom-server my-exchange

# Connect client to custom server
./start-client.sh my-custom-server my-exchange
```

## Use Cases Demonstrated

1. **Microservices**: Decouple MCP clients from servers
2. **Scaling**: Handle more load by adding server instances
3. **Reliability**: Survive server crashes with automatic failover
4. **Distribution**: Run components on different machines/regions
5. **Analytics**: Monitor traffic through RabbitMQ management console

## Troubleshooting

**"Cannot connect to AMQP"**
- Check RabbitMQ is running: `brew services list | grep rabbitmq`
- Check credentials: default is `guest/guest`
- Check port: default is 5672 (AMQP), 5671 (AMQPS)
- We disable TLS for local testing: `AMQP_USE_TLS=false`

**"Module not found"**
- Run `npm install` in both root and demo directories
- Run `npm run build` in root directory

**"Permission denied"**
- Make scripts executable: `chmod +x *.sh`

**Client hangs or times out**
- Ensure server is running first
- Check RabbitMQ is accessible
- Verify server name and exchange match between client and server

## Next Steps

Try these modifications:

1. **Add more tools** to `server-amqp.js` and see them work immediately
2. **Run on Docker**: Containerize the server and scale with `docker-compose`
3. **Different machines**: Change `hostname` to run distributed
4. **Add monitoring**: Use RabbitMQ plugins for metrics
5. **Custom interceptors**: Add logging/security using the interceptor framework (see main README)

## Learn More

- Main project README: `../README.md`
- MCP SDK docs: https://github.com/modelcontextprotocol/sdk
- RabbitMQ tutorials: https://www.rabbitmq.com/tutorials
