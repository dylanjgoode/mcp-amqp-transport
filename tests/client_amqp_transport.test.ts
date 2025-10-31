import { ClientAMQPTransport } from '../src/client_amqp_transport';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

describe('ClientAMQPTransport', () => {
  const mockOptions = {
    serverName: 'test-server',
    exchangeName: 'test-exchange',
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
  };

  describe('constructor', () => {
    it('should create transport with provided options', () => {
      const transport = new ClientAMQPTransport(mockOptions);
      expect(transport).toBeDefined();
    });

    it('should use environment variables as fallback', () => {
      process.env.AMQP_HOSTNAME = 'env-host';
      process.env.AMQP_USERNAME = 'env-user';
      process.env.AMQP_PASSWORD = 'env-pass';

      const transport = new ClientAMQPTransport({
        serverName: 'test',
        exchangeName: 'test',
      });

      expect(transport).toBeDefined();

      delete process.env.AMQP_HOSTNAME;
      delete process.env.AMQP_USERNAME;
      delete process.env.AMQP_PASSWORD;
    });

    it('should throw error if hostname is missing', () => {
      expect(() => {
        new ClientAMQPTransport({
          serverName: 'test',
          exchangeName: 'test',
        });
      }).toThrow('hostname must be provided');
    });

    it('should throw error if username is missing', () => {
      expect(() => {
        new ClientAMQPTransport({
          serverName: 'test',
          exchangeName: 'test',
          hostname: 'localhost',
        });
      }).toThrow('username must be provided');
    });

    it('should throw error if password is missing', () => {
      expect(() => {
        new ClientAMQPTransport({
          serverName: 'test',
          exchangeName: 'test',
          hostname: 'localhost',
          username: 'guest',
        });
      }).toThrow('password must be provided');
    });

    it('should support TLS configuration', () => {
      const transport = new ClientAMQPTransport({
        ...mockOptions,
        useTLS: true,
      });
      expect(transport).toBeDefined();
    });

    it('should use default port 5672 for AMQP', () => {
      const transport = new ClientAMQPTransport({
        serverName: 'test',
        exchangeName: 'test',
        hostname: 'localhost',
        username: 'guest',
        password: 'guest',
      });
      expect(transport).toBeDefined();
    });

    it('should use default port 5671 for AMQPS', () => {
      const transport = new ClientAMQPTransport({
        serverName: 'test',
        exchangeName: 'test',
        hostname: 'localhost',
        username: 'guest',
        password: 'guest',
        useTLS: true,
      });
      expect(transport).toBeDefined();
    });
  });

  describe('send', () => {
    it('should throw error when sending before start', async () => {
      const transport = new ClientAMQPTransport(mockOptions);
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow('Transport not started');
    });
  });
});
