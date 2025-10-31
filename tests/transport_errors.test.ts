import {
  TransportError,
  ConnectionError,
  ValidationError,
  MessageError,
} from '../src/errors/transport_errors';

describe('TransportError', () => {
  describe('instantiation', () => {
    it('should create error with message and code', () => {
      const error = new TransportError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('TransportError');
    });

    it('should have a stack trace', () => {
      const error = new TransportError('Test error', 'TEST_CODE');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TransportError');
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new TransportError('Test error', 'TEST_CODE');
      
      expect(error instanceof Error).toBe(true);
    });

    it('should be instance of TransportError', () => {
      const error = new TransportError('Test error', 'TEST_CODE');
      
      expect(error instanceof TransportError).toBe(true);
    });
  });

  describe('properties', () => {
    it('should have accessible properties', () => {
      const error = new TransportError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('TransportError');
    });

    it('should preserve properties when caught and rethrown', () => {
      let caughtError: TransportError | null = null;
      
      try {
        throw new TransportError('Test error', 'TEST_CODE');
      } catch (e) {
        caughtError = e as TransportError;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Test error');
      expect(caughtError!.code).toBe('TEST_CODE');
      expect(caughtError!.name).toBe('TransportError');
    });
  });
});

describe('ConnectionError', () => {
  describe('instantiation', () => {
    it('should create error with message', () => {
      const error = new ConnectionError('Connection failed');
      
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.name).toBe('ConnectionError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message and cause', () => {
      const cause = new Error('Network timeout');
      const error = new ConnectionError('Connection failed', cause);
      
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.name).toBe('ConnectionError');
      expect(error.cause).toBe(cause);
    });

    it('should have a stack trace', () => {
      const error = new ConnectionError('Connection failed');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConnectionError');
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new ConnectionError('Connection failed');
      
      expect(error instanceof Error).toBe(true);
    });

    it('should be instance of TransportError', () => {
      const error = new ConnectionError('Connection failed');
      
      expect(error instanceof TransportError).toBe(true);
    });

    it('should be instance of ConnectionError', () => {
      const error = new ConnectionError('Connection failed');
      
      expect(error instanceof ConnectionError).toBe(true);
    });
  });

  describe('properties', () => {
    it('should have accessible properties', () => {
      const error = new ConnectionError('Connection failed');
      
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.name).toBe('ConnectionError');
    });

    it('should preserve cause error', () => {
      const cause = new Error('Network timeout');
      const error = new ConnectionError('Connection failed', cause);
      
      expect(error.cause).toBe(cause);
      expect(error.cause!.message).toBe('Network timeout');
    });

    it('should preserve properties when caught and rethrown', () => {
      const cause = new Error('Network timeout');
      let caughtError: ConnectionError | null = null;
      
      try {
        throw new ConnectionError('Connection failed', cause);
      } catch (e) {
        caughtError = e as ConnectionError;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Connection failed');
      expect(caughtError!.code).toBe('CONNECTION_ERROR');
      expect(caughtError!.cause).toBe(cause);
    });
  });
});

describe('ValidationError', () => {
  describe('instantiation', () => {
    it('should create error with message and field', () => {
      const error = new ValidationError('Invalid hostname', 'hostname');
      
      expect(error.message).toBe('Invalid hostname');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('hostname');
    });

    it('should have a stack trace', () => {
      const error = new ValidationError('Invalid hostname', 'hostname');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ValidationError');
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new ValidationError('Invalid hostname', 'hostname');
      
      expect(error instanceof Error).toBe(true);
    });

    it('should be instance of TransportError', () => {
      const error = new ValidationError('Invalid hostname', 'hostname');
      
      expect(error instanceof TransportError).toBe(true);
    });

    it('should be instance of ValidationError', () => {
      const error = new ValidationError('Invalid hostname', 'hostname');
      
      expect(error instanceof ValidationError).toBe(true);
    });
  });

  describe('properties', () => {
    it('should have accessible properties', () => {
      const error = new ValidationError('Invalid hostname', 'hostname');
      
      expect(error.message).toBe('Invalid hostname');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('hostname');
    });

    it('should preserve properties when caught and rethrown', () => {
      let caughtError: ValidationError | null = null;
      
      try {
        throw new ValidationError('Invalid hostname', 'hostname');
      } catch (e) {
        caughtError = e as ValidationError;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Invalid hostname');
      expect(caughtError!.code).toBe('VALIDATION_ERROR');
      expect(caughtError!.field).toBe('hostname');
    });
  });
});

describe('MessageError', () => {
  describe('instantiation', () => {
    it('should create error with message', () => {
      const error = new MessageError('Failed to parse message');
      
      expect(error.message).toBe('Failed to parse message');
      expect(error.code).toBe('MESSAGE_ERROR');
      expect(error.name).toBe('MessageError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message and cause', () => {
      const cause = new SyntaxError('Unexpected token');
      const error = new MessageError('Failed to parse message', cause);
      
      expect(error.message).toBe('Failed to parse message');
      expect(error.code).toBe('MESSAGE_ERROR');
      expect(error.name).toBe('MessageError');
      expect(error.cause).toBe(cause);
    });

    it('should have a stack trace', () => {
      const error = new MessageError('Failed to parse message');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('MessageError');
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new MessageError('Failed to parse message');
      
      expect(error instanceof Error).toBe(true);
    });

    it('should be instance of TransportError', () => {
      const error = new MessageError('Failed to parse message');
      
      expect(error instanceof TransportError).toBe(true);
    });

    it('should be instance of MessageError', () => {
      const error = new MessageError('Failed to parse message');
      
      expect(error instanceof MessageError).toBe(true);
    });
  });

  describe('properties', () => {
    it('should have accessible properties', () => {
      const error = new MessageError('Failed to parse message');
      
      expect(error.message).toBe('Failed to parse message');
      expect(error.code).toBe('MESSAGE_ERROR');
      expect(error.name).toBe('MessageError');
    });

    it('should preserve cause error', () => {
      const cause = new SyntaxError('Unexpected token');
      const error = new MessageError('Failed to parse message', cause);
      
      expect(error.cause).toBe(cause);
      expect(error.cause!.message).toBe('Unexpected token');
    });

    it('should preserve properties when caught and rethrown', () => {
      const cause = new SyntaxError('Unexpected token');
      let caughtError: MessageError | null = null;
      
      try {
        throw new MessageError('Failed to parse message', cause);
      } catch (e) {
        caughtError = e as MessageError;
      }
      
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Failed to parse message');
      expect(caughtError!.code).toBe('MESSAGE_ERROR');
      expect(caughtError!.cause).toBe(cause);
    });
  });
});
