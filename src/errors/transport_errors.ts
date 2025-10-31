/**
 * Base error class for all transport-related errors.
 * Provides error codes and cause tracking for better error handling.
 */
export class TransportError extends Error {
  /**
   * Creates a new TransportError instance.
   * 
   * @param message - Human-readable error message
   * @param code - Machine-readable error code for programmatic handling
   */
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TransportError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransportError);
    }
  }
}

/**
 * Error thrown when AMQP connection or channel operations fail.
 * Includes the original error as cause for debugging.
 */
export class ConnectionError extends TransportError {
  /**
   * Creates a new ConnectionError instance.
   * 
   * @param message - Human-readable error message describing the connection failure
   * @param cause - Optional original error that caused this connection error
   */
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConnectionError);
    }
  }
}

/**
 * Error thrown when configuration or input validation fails.
 * Includes the field name that failed validation.
 */
export class ValidationError extends TransportError {
  /**
   * Creates a new ValidationError instance.
   * 
   * @param message - Human-readable error message describing the validation failure
   * @param field - Name of the field that failed validation
   */
  constructor(message: string, public readonly field: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Error thrown when message processing or parsing fails.
 * Includes the original error as cause for debugging.
 */
export class MessageError extends TransportError {
  /**
   * Creates a new MessageError instance.
   * 
   * @param message - Human-readable error message describing the message processing failure
   * @param cause - Optional original error that caused this message error
   */
  constructor(message: string, public readonly cause?: Error) {
    super(message, 'MESSAGE_ERROR');
    this.name = 'MessageError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MessageError);
    }
  }
}
