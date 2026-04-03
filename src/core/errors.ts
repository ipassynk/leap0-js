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

export class Leap0PermissionError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0PermissionError";
  }
}

export class Leap0NotFoundError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0NotFoundError";
  }
}

export class Leap0ConflictError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0ConflictError";
  }
}

export class Leap0RateLimitError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, { ...options, retryable: true });
    this.name = "Leap0RateLimitError";
  }
}

export class Leap0TimeoutError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, { ...options, retryable: true });
    this.name = "Leap0TimeoutError";
  }
}

export class Leap0WebSocketError extends Leap0Error {
  constructor(message: string, options: ConstructorParameters<typeof Leap0Error>[1] = {}) {
    super(message, options);
    this.name = "Leap0WebSocketError";
  }
}
