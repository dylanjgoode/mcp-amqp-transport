import amqplib from 'amqplib';

export enum MessageProcessStatus {
  FORWARD = 'forward',
  REJECT = 'reject',
  ERROR = 'error',
  DROP = 'drop',
  TRANSFORM = 'transform',
}

export interface InterceptorOptions {
  inExchange: string;
  outExchange: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  useTLS?: boolean;
}

export abstract class InterceptorBase {
  private connection?: any;
  private channel?: any;
  private options: InterceptorOptions;

  constructor(interceptorOptions: InterceptorOptions) {
    const hostname = interceptorOptions.hostname || process.env.AMQP_HOSTNAME;
    const useTLS = interceptorOptions.useTLS ?? process.env.AMQP_USE_TLS === 'true';
    const port =
      interceptorOptions.port || parseInt(process.env.AMQP_PORT || '') || (useTLS ? 5671 : 5672);
    const username = interceptorOptions.username || process.env.AMQP_USERNAME;
    const password = interceptorOptions.password || process.env.AMQP_PASSWORD;

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

    this.options = {
      ...interceptorOptions,
      hostname,
      port,
      username,
      password,
      useTLS,
    };
  }

  abstract proccessClientToMCPMessage(
    message: any,
    headers?: any
  ): Promise<[MessageProcessStatus, any?]>;

  abstract proccessMCPToClientMessage(
    message: any,
    headers?: any
  ): Promise<[MessageProcessStatus, any?]>;

  async start(): Promise<void> {
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

        const [status, returnedMessage] = await this.proccessClientToMCPMessage(
          message,
          msg.properties.headers
        );

        if (status === MessageProcessStatus.FORWARD) {
          this.channel.publish(this.options.outExchange, msg.fields.routingKey, msg.content, {
            persistent: true,
            headers: msg.properties.headers,
          });
        } else if (status === MessageProcessStatus.TRANSFORM) {
          if (returnedMessage) {
            this.channel.publish(
              this.options.outExchange,
              msg.fields.routingKey,
              Buffer.from(JSON.stringify(returnedMessage)),
              {
                persistent: true,
                headers: msg.properties.headers,
              }
            );
          }
        } else if (status === MessageProcessStatus.REJECT) {
          if (routingKeyToReply && returnedMessage) {
            this.channel.publish(
              this.options.inExchange,
              routingKeyToReply,
              Buffer.from(JSON.stringify(returnedMessage)),
              { persistent: true }
            );
          }
        } else if (status === MessageProcessStatus.ERROR) {
          console.error('Error processing message, forwarding anyway');
          this.channel.publish(this.options.outExchange, msg.fields.routingKey, msg.content, {
            persistent: true,
            headers: msg.properties.headers,
          });
        } else if (status === MessageProcessStatus.DROP) {
          // Message is dropped, do nothing
        }

        this.channel.ack(msg);
      } catch (error) {
        console.error('Error in interceptor:', error);
        this.channel.nack(msg, false, false);
      }
    });

    // MCP -> Client intercepter
    const reverseQueue = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(
      reverseQueue.queue,
      this.options.outExchange,
      'from-mcp.#.client-id.#'
    );
    await this.channel.consume(reverseQueue.queue, async (msg: any) => {
      if (!msg) return;

      try {
        const message = JSON.parse(msg.content.toString());
        const routingKeyToReply = msg.properties.headers?.routingKeyToReply;

        const [status, returnedMessage] = await this.proccessMCPToClientMessage(
          message,
          msg.properties.headers
        );

        if (status === MessageProcessStatus.FORWARD) {
          this.channel.publish(this.options.inExchange, msg.fields.routingKey, msg.content, {
            persistent: true,
            headers: msg.properties.headers,
          });
        } else if (status === MessageProcessStatus.TRANSFORM) {
          if (returnedMessage) {
            this.channel.publish(
              this.options.inExchange,
              msg.fields.routingKey,
              Buffer.from(JSON.stringify(returnedMessage)),
              {
                persistent: true,
                headers: msg.properties.headers,
              }
            );
          }
        } else if (status === MessageProcessStatus.REJECT) {
          if (routingKeyToReply && returnedMessage) {
            this.channel.publish(
              this.options.inExchange,
              routingKeyToReply,
              Buffer.from(JSON.stringify(returnedMessage)),
              { persistent: true }
            );
          }
        } else if (status === MessageProcessStatus.ERROR) {
          console.error('Error processing message, forwarding anyway');
          this.channel.publish(this.options.inExchange, msg.fields.routingKey, msg.content, {
            persistent: true,
            headers: msg.properties.headers,
          });
        } else if (status === MessageProcessStatus.DROP) {
          // Message is dropped, do nothing
        }

        this.channel.ack(msg);
      } catch (error) {
        console.error('Error in interceptor:', error);
        this.channel.nack(msg, false, false);
      }
    });
  }
}
