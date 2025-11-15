import rhea = require('rhea');
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface ServerAMQP10TransportOptions {
  name: string;
  exchangeName: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
}

export class ServerAMQP10Transport implements Transport {
  private connection?: rhea.Connection;
  private sender?: rhea.Sender;
  private receiver?: rhea.Receiver;
  private started = false;
  private name: string;
  private exchangeName: string;
  private hostname: string;
  private port: number;
  private username: string;
  private password: string;
  private useTLS: boolean;
  private replyRoutingKeys: Map<string | number, string> = new Map();

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: ServerAMQP10TransportOptions) {
    const hostname = options.hostname || process.env.AMQP_HOSTNAME;
    const useTLS = options.useTLS ?? (process.env.AMQP_USE_TLS !== 'false');
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

    this.hostname = hostname;
    this.port = port;
    this.username = username;
    this.password = password;
    this.useTLS = useTLS;
    this.name = options.name;
    this.exchangeName = options.exchangeName;
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('ServerAMQP10Transport already started');
    }

    return new Promise((resolve, reject) => {
      try {
        const connectionOptions: any = {
          host: this.hostname,
          port: this.port,
          username: this.username,
          password: this.password,
          transport: this.useTLS ? 'tls' : 'tcp',
          reconnect: true,
        };

        this.connection = rhea.connect(connectionOptions);

        // Set up connection error and close event handlers
        this.connection.on('connection_error', (context) => {
          this.onerror?.(new Error(`Connection error: ${context.error}`));
        });

        this.connection.on('disconnected', () => {
          this.onclose?.();
        });

        this.connection.on('connection_open', () => {
          const receiverAddress = `exchange.${this.exchangeName}.mcp.${this.name}.request`;
          this.receiver = this.connection!.open_receiver(receiverAddress);

          this.receiver.on('message', (context) =>{
            try {
              const messageBody = context.message?.body;
              if (!messageBody) return;

              // Decode buffer to string if needed
              const bodyStr = typeof messageBody === 'string' 
                ? messageBody 
                : messageBody.content?.toString('utf-8') || messageBody.toString();
              
              const message = JSON.parse(bodyStr);

              const routingKeyToReply = context.message?.application_properties?.routingKeyToReply;
              if (routingKeyToReply && 'id' in message) {
                this.replyRoutingKeys.set(message.id, routingKeyToReply);
              }

              this.onmessage?.(message);
            } catch (error) {
              this.onerror?.(error as Error);
              // Reject message without requeuing
              if (context.delivery) {
                context.delivery.reject();
              }
            }
          });

          this.started = true;
          resolve();
        });

        this.connection.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.connection) {
      throw new Error('Transport not started');
    }

    // Extract request ID from message if present
    let requestId: string | number | undefined;
    if ('id' in message) {
      requestId = message.id;
    } else if ('result' in message || 'error' in message) {
      // For responses, check if there's an id field
      requestId = (message as any).id;
    }

    // Retrieve reply routing key from stored map using request ID
    let replyRoutingKey = 'dlq';
    if (requestId !== undefined) {
      const storedKey = this.replyRoutingKeys.get(requestId);
      if (storedKey) {
        replyRoutingKey = `exchange.${this.exchangeName}.${storedKey}`;
        this.replyRoutingKeys.delete(requestId);
      }
    }

    // Serialize message to JSON
    const body = JSON.stringify(message);

    // Create sender for this specific reply queue
    const sender = this.connection!.open_sender({ target: { address: replyRoutingKey } });
    
    // Set message
    const amqpMessage: any = {
      body: body,
      durable: true,
    };

    // Wait for sender to be ready and send
    sender.once('sendable', () => {
      sender.send(amqpMessage);
      sender.close();
    });
  }

  async close(): Promise<void> {
    if (this.receiver) {
      this.receiver.close();
    }
    if (this.sender) {
      this.sender.close();
    }
    if (this.connection) {
      this.connection.close();
    }
    // Clear reply routing keys map
    this.replyRoutingKeys.clear();
    this.onclose?.();
  }
}
