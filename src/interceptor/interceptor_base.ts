import amqplib from 'amqplib';

export enum MessageProcessStatus {
    SUCCEEDED_FORWARD = 'succeeded_forward',
    SUCCEEDED_REJECT = 'succeeded_reject',
    ERROR = 'error'
}

export interface InterceptorOptions {
    hostname: string;
    port?: number;
    username?: string;
    password?: string;
    useTLS?: boolean;
    inExchange: string;
    outExchange: string;
}


export abstract class InterceptorBase {
    private connection?: any;
    private channel?: any;
    private options: InterceptorOptions;
    
    constructor(interceptorOptions: InterceptorOptions) {
        this.options = interceptorOptions;
    }

    abstract proccessClientToMCPMessage(message: any): Promise<MessageProcessStatus>;

    abstract proccessMCPToClientMessage(message: any): Promise<MessageProcessStatus>;


    async start(): Promise<void> {
        console.log('Starting interceptor v3');
        
        const protocol = this.options.useTLS ? 'amqps' : 'amqp';
        const port = this.options.port || (this.options.useTLS ? 5671 : 5672);
        const auth = this.options.username ? `${this.options.username}:${this.options.password}@` : '';
        const url = `${protocol}://${auth}${this.options.hostname}:${port}`;
        
        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        
        await this.channel.assertExchange(this.options.inExchange, 'topic', { durable: true });
        await this.channel.assertExchange(this.options.outExchange, 'topic', { durable: true });
        
        // Client -> MCP intercepor
        const interceptQueue = await this.channel.assertQueue('', { exclusive: true });
        await this.channel.bindQueue(interceptQueue.queue, this.options.inExchange, 'mcp.#.request');
        await this.channel.consume(interceptQueue.queue, async (msg: any) => {
            if (!msg) return;
            
            try {
                const message = JSON.parse(msg.content.toString());
                const routingKeyToReply = msg.properties.headers?.routingKeyToReply;
                
                const status = await this.proccessClientToMCPMessage(message);
                
                if (status === MessageProcessStatus.SUCCEEDED_FORWARD) {
                    this.channel.publish(this.options.outExchange, msg.fields.routingKey, msg.content, {
                        persistent: true,
                        headers: msg.properties.headers
                    });
                } else if (status === MessageProcessStatus.SUCCEEDED_REJECT) {
                    if (routingKeyToReply) {
                        const errorMessage = { error: 'rejected' };
                        this.channel.publish(this.options.outExchange, routingKeyToReply, 
                            Buffer.from(JSON.stringify(errorMessage)), { persistent: true });
                    }
                } else if (status === MessageProcessStatus.ERROR) {
                    console.error('Error processing message, forwarding anyway');
                    this.channel.publish(this.options.outExchange, msg.fields.routingKey, msg.content, {
                        persistent: true,
                        headers: msg.properties.headers
                    });
                }
                
                this.channel.ack(msg);
            } catch (error) {
                console.error('Error in interceptor:', error);
                this.channel.nack(msg, false, false);
            }
        });
        
        // MCP -> Client intercepter
        const reverseQueue = await this.channel.assertQueue('', { exclusive: true });
        await this.channel.bindQueue(reverseQueue.queue, this.options.outExchange, 'from-mcp.#.client-id.#');
        await this.channel.consume(reverseQueue.queue, async (msg: any) => {
            if (!msg) return;
            
            try {
                const message = JSON.parse(msg.content.toString());
                const routingKeyToReply = msg.properties.headers?.routingKeyToReply;
                
                const status = await this.proccessMCPToClientMessage(message);
                
                if (status === MessageProcessStatus.SUCCEEDED_FORWARD) {
                    this.channel.publish(this.options.inExchange, msg.fields.routingKey, msg.content, {
                        persistent: true,
                        headers: msg.properties.headers
                    });
                } else if (status === MessageProcessStatus.SUCCEEDED_REJECT) {
                    if (routingKeyToReply) {
                        const errorMessage = { error: 'rejected' };
                        this.channel.publish(this.options.inExchange, routingKeyToReply, 
                            Buffer.from(JSON.stringify(errorMessage)), { persistent: true });
                    }
                } else if (status === MessageProcessStatus.ERROR) {
                    console.error('Error processing message, forwarding anyway');
                    this.channel.publish(this.options.inExchange, msg.fields.routingKey, msg.content, {
                        persistent: true,
                        headers: msg.properties.headers
                    });
                }
                
                this.channel.ack(msg);
            } catch (error) {
                console.error('Error in interceptor:', error);
                this.channel.nack(msg, false, false);
            }
        });
    }
}