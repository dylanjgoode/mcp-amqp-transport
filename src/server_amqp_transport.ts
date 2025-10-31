import amqplib from 'amqplib';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface ServerAMQPTransportOptions {
  name: string;
  exchangeName: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
}

export class ServerAMQPTransport implements Transport {
  private connection?: amqplib.ChannelModel;
  private channel?: amqplib.Channel;
  private started = false;
  private name: string;
  private exchangeName: string;
  private url: string;
  private replyRoutingKeys: Map<string | number, string> = new Map();

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: ServerAMQPTransportOptions) {
    const hostname = options.hostname || process.env.AMQP_HOSTNAME;
    const useTLS = options.useTLS ?? process.env.AMQP_USE_TLS === 'true';
    const port = options.port || parseInt(process.env.AMQP_PORT || '') || (useTLS ? 5671 : 5672);
    const username = options.username || process.env.AMQP_USERNAME;
    const password = options.password || process.env.AMQP_PASSWORD;

    if (!hostname)
      throw new Error(
        'hostname must be provided via options or AMQP_HOSTNAME environment variable'
      );
    if (!username)
      throw new Error(
        'username must be provided via options or AMQP_USERNAME environment variable'
      );
    if (!password)
      throw new Error(
        'password must be provided via options or AMQP_PASSWORD environment variable'
      );

    const protocol = useTLS ? 'amqps' : 'amqp';
    const auth = `${username}:${password}@`;
    this.url = `${protocol}://${auth}${hostname}:${port}`;
    this.name = options.name;
    this.exchangeName = options.exchangeName;
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('ServerAMQPTransport already started');
    }

    try {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      const requestQueueName = `mcp-${this.name}-request`;
      const requestQueue = await this.channel.assertQueue(requestQueueName, { durable: true });
      const fromClientRoutingKey = `mcp.${this.name}.request`;
      await this.channel.bindQueue(requestQueue.queue, this.exchangeName, fromClientRoutingKey);

      await this.channel.consume(requestQueue.queue, (msg) => {
        if (!msg || !this.channel) return;
        try {
          const message = JSON.parse(msg.content.toString());
          const routingKeyToReply = msg.properties.headers?.routingKeyToReply;
          if (routingKeyToReply && message.id !== undefined) {
            this.replyRoutingKeys.set(message.id, routingKeyToReply);
          }
          this.onmessage?.(message);
          this.channel.ack(msg);
        } catch (error) {
          this.onerror?.(error as Error);
          this.channel.nack(msg, false, false);
        }
      });

      this.connection.on('error', (error) => this.onerror?.(error));
      this.connection.on('close', () => this.onclose?.());

      this.started = true;
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.channel) throw new Error('Transport not started');
    const content = Buffer.from(JSON.stringify(message));
    const requestId = 'id' in message ? message.id : undefined;
    const routingKey =
      requestId !== undefined && this.replyRoutingKeys.has(requestId)
        ? this.replyRoutingKeys.get(requestId)!
        : `dlq`;
    if (requestId !== undefined) {
      this.replyRoutingKeys.delete(requestId);
    }

    this.channel.publish(this.exchangeName, routingKey, content, { persistent: true });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.onclose?.();
  }
}
