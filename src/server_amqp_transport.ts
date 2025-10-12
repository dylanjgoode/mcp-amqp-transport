import amqplib from 'amqplib';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface ServerAMQPTransportOptions {
    hostname: string;
    port?: number;
    username?: string;
    password?: string;
    useTLS?: boolean;
    name: string;
    exchangeName: string;
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
        const protocol = options.useTLS ? 'amqps' : 'amqp';
        const port = options.port || (options.useTLS ? 5671 : 5672);
        const auth = options.username ? `${options.username}:${options.password}@` : '';
        this.url = `${protocol}://${auth}${options.hostname}:${port}`;
        this.name = options.name;
        this.exchangeName = options.exchangeName;
    }

    async start(): Promise<void> {
        console.log("using v4 server tranport");
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
                    if (routingKeyToReply && (message.id !== undefined)) {
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
        const routingKey = requestId !== undefined && this.replyRoutingKeys.has(requestId)
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
