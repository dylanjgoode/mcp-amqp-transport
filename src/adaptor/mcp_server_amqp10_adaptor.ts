#!/usr/bin/env node
import { Command } from 'commander';
import rhea = require('rhea');
import process from 'node:process';
import { spawn } from 'node:child_process';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';

export interface RemoteMCPConfiguration {
  serverName: string;
  exchangeName: string;
  command: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
  args?: string[];
  additionalMetadata?: string;
}

class ReadBuffer {
  private buffer?: Buffer;

  append(chunk: Buffer): void {
    this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
  }

  readMessage(): any | null {
    if (!this.buffer) return null;
    const index = this.buffer.indexOf('\n');
    if (index === -1) return null;
    const line = this.buffer.toString('utf8', 0, index).replace(/\r$/, '');
    this.buffer = this.buffer.subarray(index + 1);
    return JSONRPCMessageSchema.parse(JSON.parse(line));
  }
}

async function main() {
  const program = new Command();

  program
    .requiredOption('--serverName <serverName>', 'MCP server name')
    .requiredOption('--exchangeName <exchangeName>', 'AMQP exchange name')
    .requiredOption('--command <command>', 'Command to run MCP server')
    .option('--hostname <hostname>', 'AMQP broker hostname')
    .option('--port <port>', 'AMQP broker port', parseInt)
    .option('--username <username>', 'AMQP username')
    .option('--password <password>', 'AMQP password')
    .option('--useTLS', 'Use TLS connection')
    .option('--args <args...>', 'Arguments for the command')
    .option(
      '--additional-metadata <metadata>',
      'Additional metadata as key=value pairs separated by commas'
    )
    .parse();

  const config: RemoteMCPConfiguration = program.opts();

  // Parse additional metadata
  const metadata: Record<string, string> = {};
  if (config.additionalMetadata) {
    config.additionalMetadata.split(',').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) metadata[key.trim()] = value.trim();
    });
  }

  // Validate required configuration
  const hostname = config.hostname || process.env.AMQP_HOSTNAME;
  const useTLS = config.useTLS ?? (process.env.AMQP_USE_TLS !== 'false');
  const port = config.port || parseInt(process.env.AMQP_PORT || '') || (useTLS ? 5671 : 5672);
  const username = config.username || process.env.AMQP_USERNAME;
  const password = config.password || process.env.AMQP_PASSWORD;

  if (!hostname)
    throw new Error(
      'hostname must be provided via --hostname or AMQP_HOSTNAME environment variable'
    );
  if (!username)
    throw new Error(
      'username must be provided via --username or AMQP_USERNAME environment variable'
    );
  if (!password)
    throw new Error(
      'password must be provided via --password or AMQP_PASSWORD environment variable'
    );

  // Generate unique server ID
  const serverId = `server-${randomUUID()}`;

  // Build rhea connection URL with TLS support
  const connectionOptions: any = {
    host: hostname,
    port: port,
    username: username,
    password: password,
    reconnect: false,
  };

  if (useTLS) {
    connectionOptions.transport = 'tls';
  }

  // Create rhea connection
  const connection = rhea.connect(connectionOptions);

  // Spawn subprocess with specified command and args
  const subprocess = spawn(config.command, config.args || [], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env,
  });

  // Map to store reply routing keys keyed by message ID
  const replyRoutingKeys = new Map<string | number, string>();

  // Create receiver link from address: exchange.{exchangeName}.mcp.{serverName}.request
  const receiverAddress = `exchange.${config.exchangeName}.mcp.${config.serverName}.request`;
  const receiver = connection.open_receiver(receiverAddress);

  // Set up receiver message handler to extract routingKeyToReply, store in map, and write to subprocess stdin
  receiver.on('message', (context: rhea.EventContext) => {
    try {
      const messageBody = context.message?.body;
      const bodyStr = typeof messageBody === 'string' 
        ? messageBody 
        : messageBody?.content?.toString('utf-8') || messageBody?.toString();
      const message = JSON.parse(bodyStr);
      const routingKeyToReply = context.message?.application_properties?.routingKeyToReply;
      
      if (routingKeyToReply && message.id !== undefined) {
        replyRoutingKeys.set(message.id, routingKeyToReply);
      }
      
      subprocess.stdin.write(JSON.stringify(message) + '\n');
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Set up connection error handler
  connection.on('connection_error', (context: rhea.EventContext) => {
    console.error('Connection error:', context.error);
  });

  // Set up connection close handler
  connection.on('disconnected', () => {
    console.error('Connection closed');
  });

  // Set up subprocess stdout data event handler
  const readBuffer = new ReadBuffer();
  subprocess.stdout.on('data', (chunk: Buffer) => {
    readBuffer.append(chunk);
    while (true) {
      const message = readBuffer.readMessage();
      if (!message) break;

      // Extract request ID from message
      const requestId = 'id' in message ? message.id : undefined;

      // Retrieve reply routing key from map using request ID
      let routingKey = 'dlq';
      if (requestId !== undefined && replyRoutingKeys.has(requestId)) {
        const storedKey = replyRoutingKeys.get(requestId)!;
        routingKey = `exchange.${config.exchangeName}.${storedKey}`;
        replyRoutingKeys.delete(requestId);
      }

      // Create sender for this specific reply queue
      const replySender = connection.open_sender({ target: { address: routingKey } });
      
      // Set message
      const amqpMessage: any = {
        body: JSON.stringify(message),
        durable: true,
        application_properties: {
          serverName: config.serverName,
          serverId,
          ...metadata,
        },
      };

      // Wait for sender to be ready and send
      replySender.once('sendable', () => {
        replySender.send(amqpMessage);
        replySender.close();
      });
    }
  });

  // Set up subprocess exit handler to close connection and exit process
  subprocess.on('exit', (code) => {
    console.error(`Subprocess exited with code ${code}`);
    receiver.close();
    connection.close();
    process.exit(code || 0);
  });

  // Set up SIGINT handler for graceful shutdown (kill subprocess, close connection)
  process.on('SIGINT', () => {
    subprocess.kill();
    receiver.close();
    connection.close();
    process.exit(0);
  });
}

main().catch(console.error);
