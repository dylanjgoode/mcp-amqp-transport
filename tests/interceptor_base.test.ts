import { InterceptorBase, MessageProcessStatus } from '../src/interceptor/interceptor_base';

class TestInterceptor extends InterceptorBase {
  async proccessClientToMCPMessage(message: any): Promise<MessageProcessStatus> {
    return MessageProcessStatus.SUCCEEDED_FORWARD;
  }

  async proccessMCPToClientMessage(message: any): Promise<MessageProcessStatus> {
    return MessageProcessStatus.SUCCEEDED_FORWARD;
  }
}

describe('InterceptorBase', () => {
  const mockOptions = {
    inExchange: 'test-in',
    outExchange: 'test-out',
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
  };

  describe('constructor', () => {
    it('should create interceptor with provided options', () => {
      const interceptor = new TestInterceptor(mockOptions);
      expect(interceptor).toBeDefined();
    });

    it('should use environment variables as fallback', () => {
      process.env.AMQP_HOSTNAME = 'env-host';
      process.env.AMQP_USERNAME = 'env-user';
      process.env.AMQP_PASSWORD = 'env-pass';

      const interceptor = new TestInterceptor({
        inExchange: 'test-in',
        outExchange: 'test-out',
      });

      expect(interceptor).toBeDefined();

      delete process.env.AMQP_HOSTNAME;
      delete process.env.AMQP_USERNAME;
      delete process.env.AMQP_PASSWORD;
    });

    it('should throw error if hostname is missing', () => {
      expect(() => {
        new TestInterceptor({
          inExchange: 'test-in',
          outExchange: 'test-out',
        });
      }).toThrow('hostname must be provided');
    });

    it('should throw error if username is missing', () => {
      expect(() => {
        new TestInterceptor({
          inExchange: 'test-in',
          outExchange: 'test-out',
          hostname: 'localhost',
        });
      }).toThrow('username must be provided');
    });

    it('should throw error if password is missing', () => {
      expect(() => {
        new TestInterceptor({
          inExchange: 'test-in',
          outExchange: 'test-out',
          hostname: 'localhost',
          username: 'guest',
        });
      }).toThrow('password must be provided');
    });

    it('should support TLS configuration', () => {
      const interceptor = new TestInterceptor({
        ...mockOptions,
        useTLS: true,
      });
      expect(interceptor).toBeDefined();
    });
  });

  describe('MessageProcessStatus', () => {
    it('should have SUCCEEDED_FORWARD status', () => {
      expect(MessageProcessStatus.SUCCEEDED_FORWARD).toBe('succeeded_forward');
    });

    it('should have SUCCEEDED_REJECT status', () => {
      expect(MessageProcessStatus.SUCCEEDED_REJECT).toBe('succeeded_reject');
    });

    it('should have ERROR status', () => {
      expect(MessageProcessStatus.ERROR).toBe('error');
    });
  });

  describe('abstract methods', () => {
    it('should require implementation of proccessClientToMCPMessage', async () => {
      const interceptor = new TestInterceptor(mockOptions);
      const result = await interceptor.proccessClientToMCPMessage({});
      expect(result).toBe(MessageProcessStatus.SUCCEEDED_FORWARD);
    });

    it('should require implementation of proccessMCPToClientMessage', async () => {
      const interceptor = new TestInterceptor(mockOptions);
      const result = await interceptor.proccessMCPToClientMessage({});
      expect(result).toBe(MessageProcessStatus.SUCCEEDED_FORWARD);
    });
  });
});
