/** Optional per-request transport settings accepted by SDK service methods. */
export interface RequestOptions {
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Additional HTTP headers to send with the request. */
  headers?: HeadersInit;
  /** Query string parameters appended to the request URL. */
  query?: Record<string, string | number | boolean | undefined>;
  /** HTTP status codes to accept as successful. Defaults to any 2xx. */
  expectedStatus?: number | number[];
}
