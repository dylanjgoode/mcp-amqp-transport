#!/usr/bin/env node
import { Command } from 'commander';
import rhea = require('rhea');
import { randomUUID } from 'crypto';
import process from 'node:process';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';

export interface RemoteMCPConfiguration {
  serverName: string;
  exchangeName: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
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
    .option('--hostname <hostname>', 'AMQP broker hostname')
    .option('--port <port>', 'AMQP broker port', parseInt)
    .option('--username <username>', 'AMQP username')
    .option('--password <password>', 'AMQP password')
    .option('--useTLS', 'Use TLS connection')
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

  // Generate unique client ID
  const clientId = `client-${randomUUID()}`;
  const replyRoutingKey = `from-mcp.${config.serverName}.client-id.${clientId}`;

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

  // Create sender link to address: exchange.{exchangeName}.mcp.{serverName}.request
  const senderAddress = `exchange.${config.exchangeName}.mcp.${config.serverName}.request`;
  const sender = connection.open_sender({ target: { address: senderAddress } });

  // Create receiver link from address: exchange.{exchangeName}.{replyRoutingKey}
  const receiverAddress = `exchange.${config.exchangeName}.${replyRoutingKey}`;
  const receiver = connection.open_receiver(receiverAddress);

  // Set up receiver message handler to parse JSON, normalize message ID, and write to stdout
  receiver.on('message', (context: rhea.EventContext) => {
    try {
      const messageBody = context.message?.body;
      const bodyStr = typeof messageBody === 'string' 
        ? messageBody 
        : messageBody?.content?.toString('utf-8') || messageBody?.toString();
      const message = JSON.parse(bodyStr);
      // Normalize message ID (remove client prefix)
      const unnormalizedMessage =
        'id' in message && typeof message.id === 'string'
          ? { ...message, id: Number(message.id.split('-').pop()) }
          : message;
      process.stdout.write(JSON.stringify(unnormalizedMessage) + '\n');
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

  // Set up stdin data event handler
  const readBuffer = new ReadBuffer();
  process.stdin.on('data', (chunk: Buffer) => {
    readBuffer.append(chunk);
    while (true) {
      const message = readBuffer.readMessage();
      if (!message) break;

      // Augment message ID with client identifier prefix
      const augmentedMessage =
        'id' in message ? { ...message, id: `${clientId}-${message.id}` } : message;

      // Set message and application properties
      const amqpMessage: rhea.Message = {
        body: JSON.stringify(augmentedMessage),
        durable: true,
        application_properties: {
          clientId,
          routingKeyToReply: replyRoutingKey,
          ...metadata,
        },
      };

      // Publish message via sender link
      sender.send(amqpMessage);
    }
  });

  // Set up SIGINT handler for graceful shutdown
  process.on('SIGINT', () => {
    receiver.close();
    sender.close();
    connection.close();
    process.exit(0);
  });
}

main().catch(console.error);
