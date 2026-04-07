/**
 * Base SDK error for request, transport, and response-validation failures.
 *
 * Includes optional HTTP metadata and a `retryable` hint for transient failures.
 */
export class Leap0Error extends Error {
  readonly statusCode?: number;
  readonly headers?: Headers;
  readonly body?: unknown;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      headers?: Headers;
      body?: unknown;
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "Leap0Error";
    this.statusCode = options.statusCode;
    this.headers = options.headers;
    this.body = options.body;
    this.retryable = options.retryable ?? false;
  }
}

/** Error thrown when the API rejects a request due to missing permissions. */
export class Leap0PermissionError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0PermissionError";
  }
}

/** Error thrown when a requested API resource does not exist. */
export class Leap0NotFoundError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0NotFoundError";
  }
}

/** Error thrown when a request conflicts with the current server state. */
export class Leap0ConflictError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0ConflictError";
  }
}

/** Error thrown when the API rate-limits a request. */
export class Leap0RateLimitError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, { ...options, retryable: true });
    this.name = "Leap0RateLimitError";
  }
}

/** Error thrown when a request exceeds the configured timeout. */
export class Leap0TimeoutError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, { ...options, retryable: true });
    this.name = "Leap0TimeoutError";
  }
}

/** Error thrown for websocket-specific failures such as disconnects or protocol issues. */
export class Leap0WebSocketError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0WebSocketError";
  }
}
