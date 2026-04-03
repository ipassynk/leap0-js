import { SDK_SOURCE } from "@/config/constants.js";
import {
  Leap0ConflictError,
  Leap0Error,
  Leap0NotFoundError,
  Leap0PermissionError,
  Leap0RateLimitError,
  Leap0TimeoutError,
} from "@/core/errors.js";
import type { Leap0ConfigResolved } from "@/models/config.js";
import type { RequestOptions } from "@/models/index.js";
import { withSpan } from "@/core/otel.js";
import { withQuery } from "@/core/utils.js";
import { SDK_VERSION } from "@/core/version.js";

type BodyLike = BodyInit | null;

/**
 * Low-level HTTP transport used by all Leap0 service clients.
 */
export class Leap0Transport {
  private closed = false;
  private readonly inflight = new Set<AbortController>();

  readonly baseUrl: string;
  readonly sandboxDomain: string;
  readonly apiKey: string;

  constructor(private readonly config: Leap0ConfigResolved) {
    this.baseUrl = config.baseUrl;
    this.sandboxDomain = config.sandboxDomain;
    this.apiKey = config.apiKey;
  }

  /**
   * Builds request headers with auth and SDK metadata.
   *
   * Args:
   *   extra: Additional headers to merge into the request.
   *
   * Returns:
   *   The final header set.
   */
  private headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    headers.set(
      this.config.authHeader,
      this.config.bearer ? `Bearer ${this.config.apiKey}` : this.config.apiKey,
    );
    headers.set("Leap0-Source", SDK_SOURCE);
    headers.set("Leap0-SDK-Version", SDK_VERSION);
    headers.set("User-Agent", `leap0-js/${SDK_VERSION}`);
    return headers;
  }

  /**
   * Marks the transport as closed.
   *
   * Returns:
   *   A promise that resolves once the transport is closed.
   */
  async close(): Promise<void> {
    this.closed = true;
    for (const controller of this.inflight) {
      controller.abort();
    }
    this.inflight.clear();
  }

  /**
   * Sends a raw HTTP request to the Leap0 control plane.
   *
   * Args:
   *   path: API path relative to the configured base URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The raw fetch response.
   */
  async request(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<Response> {
    return this.performRequest(
      `${this.config.baseUrl}${withQuery(path, options.query)}`,
      path,
      init,
      options,
    );
  }

  /**
   * Sends a raw HTTP request to an absolute URL.
   *
   * Args:
   *   url: Fully-qualified request URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The raw fetch response.
   */
  async requestUrl(
    url: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<Response> {
    const requestUrl = new URL(url);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        requestUrl.searchParams.set(key, String(value));
      }
    }
    return this.performRequest(requestUrl.toString(), requestUrl.pathname, init, options);
  }

  private async performRequest(
    url: string,
    spanPath: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<Response> {
    if (this.closed) {
      throw new Leap0Error("Client is closed");
    }

    const controller = new AbortController();
    this.inflight.add(controller);
    const timeoutMs = (options.timeout ?? this.config.timeout) * 1000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await withSpan(
        this.config,
        "leap0.transport.request",
        {
          "http.method": init.method ?? "GET",
          "url.path": spanPath,
        },
        async () => {
          const response = await fetch(url, {
            ...init,
            headers: this.headers(options.headers ?? init.headers),
            signal: controller.signal,
          });
          const expected = options.expectedStatus;
          if (expected !== undefined) {
            const codes = Array.isArray(expected) ? expected : [expected];
            if (!codes.includes(response.status)) {
              throw await this.mapHttpError(response);
            }
          } else if (!response.ok) {
            throw await this.mapHttpError(response);
          }
          return response;
        },
      );
    } catch (error) {
      if (error instanceof Leap0Error) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Leap0TimeoutError("Request timed out", { cause: error });
      }
      throw new Leap0Error(error instanceof Error ? error.message : "Request failed", {
        cause: error,
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
      this.inflight.delete(controller);
    }
  }

  /**
   * Sends a JSON request and parses the JSON response body.
   *
   * Args:
   *   path: API path relative to the configured base URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The parsed JSON response, or undefined for 204 No Content.
   */
  async requestJson<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<T | undefined> {
    const headers = new Headers(init.headers);
    if (init.body != null && !headers.has("content-type") && !(init.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
    const response = await this.request(path, { ...init, headers }, options);
    if (response.status === 204) {
      return undefined;
    }
    return (await response.json()) as T;
  }

  /**
   * Sends a JSON request to an absolute URL and parses the JSON response body.
   *
   * Args:
   *   url: Fully-qualified request URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The parsed JSON response, or undefined for 204 No Content.
   */
  async requestJsonUrl<T>(
    url: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<T | undefined> {
    const headers = new Headers(init.headers);
    if (init.body != null && !headers.has("content-type") && !(init.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
    const response = await this.requestUrl(url, { ...init, headers }, options);
    if (response.status === 204) {
      return undefined;
    }
    return (await response.json()) as T;
  }

  /**
   * Sends a request and returns the response body as text.
   *
   * Args:
   *   path: API path relative to the configured base URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The response body text.
   */
  async requestText(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<string> {
    return await (await this.request(path, init, options)).text();
  }

  /**
   * Sends a request and returns the response body as bytes.
   *
   * Args:
   *   path: API path relative to the configured base URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The response body bytes.
   */
  async requestBytes(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<Uint8Array> {
    return new Uint8Array(await (await this.request(path, init, options)).arrayBuffer());
  }

  /**
   * Sends a request to an absolute URL and returns the response body as bytes.
   *
   * Args:
   *   url: Fully-qualified request URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Returns:
   *   The response body bytes.
   */
  async requestBytesUrl(
    url: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<Uint8Array> {
    return new Uint8Array(await (await this.requestUrl(url, init, options)).arrayBuffer());
  }

  /**
   * Parses a server-sent event stream into JSON payloads.
   *
   * Args:
   *   path: API path relative to the configured base URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Yields:
   *   Parsed JSON event payloads.
   */
  async *streamJson(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): AsyncIterable<unknown> {
    const response = await this.request(path, init, options);
    yield* this.parseJsonStream(response);
  }

  /**
   * Parses a server-sent event stream from an absolute URL into JSON payloads.
   *
   * Args:
   *   url: Fully-qualified request URL.
   *   init: Fetch request options.
   *   options: Leap0 request options such as timeout and query params.
   *
   * Yields:
   *   Parsed JSON event payloads.
   */
  async *streamJsonUrl(
    url: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): AsyncIterable<unknown> {
    const response = await this.requestUrl(url, init, options);
    yield* this.parseJsonStream(response);
  }

  private async *parseJsonStream(response: Response): AsyncIterable<unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");

      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary === -1) break;
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLines = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());
        if (dataLines.length === 0) continue;
        const payload = dataLines.join("\n");
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // skip malformed JSON
        }
      }
    }
  }

  private async mapHttpError(response: Response): Promise<Leap0Error> {
    let body: unknown;
    let message = `Request failed with status ${response.status}`;

    try {
      body = await response.clone().json();
      if (
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
      ) {
        message = body.message;
      }
    } catch {
      try {
        const text = await response.text();
        body = text;
        if (text) message = text;
      } catch {
        body = undefined;
      }
    }

    const options = {
      statusCode: response.status,
      headers: response.headers,
      body,
      retryable: response.status === 429 || response.status >= 500,
    };

    if (response.status === 403) return new Leap0PermissionError(message, options);
    if (response.status === 404) return new Leap0NotFoundError(message, options);
    if (response.status === 409) return new Leap0ConflictError(message, options);
    if (response.status === 429) return new Leap0RateLimitError(message, options);
    return new Leap0Error(message, options);
  }
}

/**
 * Serializes a value into a JSON request body.
 *
 * Args:
 *   value: Value to serialize.
 *
 * Returns:
 *   A JSON string body or null.
 */
export function jsonBody(value: unknown): BodyLike {
  return value == null ? null : JSON.stringify(value);
}
