import rhea = require('rhea');
import { randomUUID } from 'crypto';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export interface ClientAMQP10TransportOptions {
  serverName: string;
  exchangeName: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
}

export class ClientAMQP10Transport implements Transport {
  private connection?: rhea.Connection;
  private sender?: rhea.Sender;
  private receiver?: rhea.Receiver;
  private started = false;
  private serverName: string;
  private clientId: string;
  private exchangeName: string;
  private hostname: string;
  private port: number;
  private username: string;
  private password: string;
  private useTLS: boolean;
  private replyRoutingKey: string;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(options: ClientAMQP10TransportOptions) {
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
    this.serverName = options.serverName;
    this.clientId = `client-${randomUUID()}`;
    this.exchangeName = options.exchangeName;
    this.replyRoutingKey = `from-mcp.${this.serverName}.client-id.${this.clientId}`;
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('ClientAMQP10Transport already started');
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
          const senderAddress = `exchange.${this.exchangeName}.mcp.${this.serverName}.request`;
          this.sender = this.connection!.open_sender({ target: { address: senderAddress } });

          const receiverAddress = `exchange.${this.exchangeName}.${this.replyRoutingKey}`;
          this.receiver = this.connection!.open_receiver(receiverAddress);

          // Set up message handler to parse JSON and invoke onmessage callback
          this.receiver.on('message', (context) => {
            try {
              const messageBody = context.message?.body;
              if (!messageBody) return;

              const bodyStr = typeof messageBody === 'string' 
                ? messageBody 
                : messageBody.content?.toString('utf-8') || messageBody.toString();
              
              const message = JSON.parse(bodyStr);

              const unnormalizedMessage =
                'id' in message && typeof message.id === 'string'
                  ? { ...message, id: message.id.replace(`${this.clientId}-`, '') }
                  : message;

              this.onmessage?.(unnormalizedMessage);
            } catch (error) {
              this.onerror?.(error as Error);
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
    if (!this.sender) {
      throw new Error('Transport not started');
    }

    // Augment message ID with client identifier prefix if message has id field
    const augmentedMessage =
      'id' in message ? { ...message, id: `${this.clientId}-${message.id}` } : message;

    // Serialize message to JSON
    const body = JSON.stringify(augmentedMessage);

    // Create AMQP message with application properties
    const amqpMessage: rhea.Message = {
      body: body,
      durable: true,
      application_properties: {
        routingKeyToReply: this.replyRoutingKey,
      },
    };

    this.sender.send(amqpMessage);
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
    this.onclose?.();
  }
}
