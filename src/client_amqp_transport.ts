import amqplib from 'amqplib';
import { randomUUID } from 'crypto';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface ClientAMQPTransportOptions {
    hostname: string;
    port?: number;
    username?: string;
    password?: string;
    useTLS?: boolean;
    serverName: string;
    exchangeName: string;
}

export class ClientAMQPTransport implements Transport {
    private connection?: amqplib.ChannelModel;
    private channel?: amqplib.Channel;
    private started = false;
    private serverName: string;
    private clientId: string;
    private exchangeName: string;
    private url: string;
    private responseQueue?: string;
    private replyRoutingKey: string;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    constructor(options: ClientAMQPTransportOptions) {
        const protocol = options.useTLS ? 'amqps' : 'amqp';
        const port = options.port || (options.useTLS ? 5671 : 5672);
        const auth = options.username ? `${options.username}:${options.password}@` : '';
        this.url = `${protocol}://${auth}${options.hostname}:${port}`;
        this.serverName = options.serverName;
        this.clientId = `client-${randomUUID()}`;
        this.exchangeName = options.exchangeName;
        this.replyRoutingKey = `from-mcp.${this.serverName}.client-id.${this.clientId}`;
    }

    async start(): Promise<void> {
        console.log("using v4 client tranport");
        if (this.started) {
            throw new Error('ClientAMQPTransport already started');
        }

        try {
            this.connection = await amqplib.connect(this.url);
            this.channel = await this.connection.createChannel();

            await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

            const responseQueueName = `mcp-${this.serverName}-response-${this.clientId}`;
            const responseQueue = await this.channel.assertQueue(responseQueueName, { durable: false, exclusive: true });
            this.responseQueue = responseQueue.queue;
            await this.channel.bindQueue(this.responseQueue, this.exchangeName, this.replyRoutingKey);
            await this.channel.consume(this.responseQueue, (msg) => {
                if (!msg) return;
                try {
                    const message = JSON.parse(msg.content.toString());                    
                    const unnormalizedMessage = 'id' in message && typeof message.id === 'string'
                        ? { ...message, id: message.id.replace(`${this.clientId}-`, '') }
                        : message;
                    
                    this.onmessage?.(unnormalizedMessage);
                    this.channel?.ack(msg);
                } catch (error) {
                    this.onerror?.(error as Error);
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

        const augmentedMessage = 'id' in message 
            ? { ...message, id: `${this.clientId}-${message.id}` }
            : message;
        
        const content = Buffer.from(JSON.stringify(augmentedMessage));
        const routingKey = `mcp.${this.serverName}.request`;
        
        this.channel.publish(this.exchangeName, routingKey, content, {
            persistent: true,
            headers: { routingKeyToReply: this.replyRoutingKey }
        });
    }

    async close(): Promise<void> {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
        this.onclose?.();
    }
}
