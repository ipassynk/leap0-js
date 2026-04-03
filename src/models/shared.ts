export interface RequestOptions {
  timeout?: number;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | undefined>;
  /** HTTP status codes to accept as successful. Defaults to any 2xx. */
  expectedStatus?: number | number[];
}
