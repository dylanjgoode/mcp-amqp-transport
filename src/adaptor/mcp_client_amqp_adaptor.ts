#!/usr/bin/env node
import { Command } from 'commander';
import amqplib from 'amqplib';
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
  const additionalMetadata = config.additionalMetadata;

  const metadata: Record<string, string> = {};
  if (additionalMetadata) {
    additionalMetadata.split(',').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) metadata[key.trim()] = value.trim();
    });
  }

  const hostname = config.hostname || process.env.AMQP_HOSTNAME;
  const useTLS = config.useTLS ?? process.env.AMQP_USE_TLS === 'true';
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

  const protocol = useTLS ? 'amqps' : 'amqp';
  const auth = `${username}:${password}@`;
  const url = `${protocol}://${auth}${hostname}:${port}`;
  const clientId = `client-${randomUUID()}`;
  const replyRoutingKey = `from-mcp.${config.serverName}.client-id.${clientId}`;

  const connection = await amqplib.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange(config.exchangeName, 'topic', { durable: true });

  const responseQueueName = `mcp-${config.serverName}-response-${clientId}`;
  const responseQueue = await channel.assertQueue(responseQueueName, {
    durable: false,
    exclusive: true,
  });
  await channel.bindQueue(responseQueue.queue, config.exchangeName, replyRoutingKey);

  await channel.consume(responseQueue.queue, (msg) => {
    if (!msg) return;
    const message = JSON.parse(msg.content.toString());
    const unnormalizedMessage =
      'id' in message && typeof message.id === 'string'
        ? { ...message, id: Number(message.id.split('-').pop()) } // Strands and Q CLI requires id to be of type Number
        : message;
    process.stdout.write(JSON.stringify(unnormalizedMessage) + '\n');
    channel.ack(msg);
  });

  const readBuffer = new ReadBuffer();
  process.stdin.on('data', (chunk: Buffer) => {
    readBuffer.append(chunk);
    while (true) {
      const message = readBuffer.readMessage();
      if (!message) break;

      const augmentedMessage =
        'id' in message ? { ...message, id: `${clientId}-${message.id}` } : message;

      const content = Buffer.from(JSON.stringify(augmentedMessage));
      const routingKey = `mcp.${config.serverName}.request`;

      channel.publish(config.exchangeName, routingKey, content, {
        persistent: true,
        headers: { clientId, routingKeyToReply: replyRoutingKey, ...metadata },
      });
    }
  });

  process.on('SIGINT', async () => {
    await channel.close();
    await connection.close();
    process.exit(0);
  });
}

main().catch(console.error);
