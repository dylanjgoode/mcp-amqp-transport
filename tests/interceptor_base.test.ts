import { InterceptorBase, MessageProcessStatus } from '../src/interceptor/interceptor_base';

class TestInterceptor extends InterceptorBase {
  async proccessClientToMCPMessage(message: any, headers?: any): Promise<[MessageProcessStatus, any?]> {
    return [MessageProcessStatus.FORWARD];
  }

  async proccessMCPToClientMessage(message: any, headers?: any): Promise<[MessageProcessStatus, any?]> {
    return [MessageProcessStatus.FORWARD];
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
    it('should have FORWARD status', () => {
      expect(MessageProcessStatus.FORWARD).toBe('forward');
    });

    it('should have REJECT status', () => {
      expect(MessageProcessStatus.REJECT).toBe('reject');
    });

    it('should have ERROR status', () => {
      expect(MessageProcessStatus.ERROR).toBe('error');
    });

    it('should have DROP status', () => {
      expect(MessageProcessStatus.DROP).toBe('drop');
    });

    it('should have TRANSFORM status', () => {
      expect(MessageProcessStatus.TRANSFORM).toBe('transform');
    });
  });

  describe('abstract methods', () => {
    it('should require implementation of proccessClientToMCPMessage', async () => {
      const interceptor = new TestInterceptor(mockOptions);
      const [status] = await interceptor.proccessClientToMCPMessage({});
      expect(status).toBe(MessageProcessStatus.FORWARD);
    });

    it('should require implementation of proccessMCPToClientMessage', async () => {
      const interceptor = new TestInterceptor(mockOptions);
      const [status] = await interceptor.proccessMCPToClientMessage({});
      expect(status).toBe(MessageProcessStatus.FORWARD);
    });
  });
});
