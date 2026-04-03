import type { RequestOptions } from "@/models/index.js";

export type RecordedCall = {
  path: string;
  url?: string;
  init: RequestInit;
  options: RequestOptions;
};

export function createRecordedTransport(overrides: Record<string, unknown> = {}) {
  const calls: RecordedCall[] = [];
  const transport = {
    requestJson: async (path: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      calls.push({ path, init, options });
      return Promise.resolve({ ok: true });
    },
    requestJsonUrl: (url: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      calls.push({ path: new URL(url).pathname, url, init, options });
      return Promise.resolve({ ok: true });
    },
    requestText: (path: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      calls.push({ path, init, options });
      return Promise.resolve("text");
    },
    requestBytes: (path: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      calls.push({ path, init, options });
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    },
    requestBytesUrl: (url: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      calls.push({ path: new URL(url).pathname, url, init, options });
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    },
    streamJsonUrl: async function* (url: string) {
      calls.push({ path: new URL(url).pathname, url, init: { method: "GET" }, options: {} });
    },
    request: (path: string, init: RequestInit = {}, options: RequestOptions = {}) => {
      calls.push({ path, init, options });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
    headers: (headers?: HeadersInit) => new Headers(headers),
    baseUrl: "https://api.example.com",
    sandboxDomain: "sandbox.example.com",
    apiKey: "test-api-key",
    ...overrides,
  };

  return { transport, calls };
}

export function jsonOf(call: RecordedCall): unknown {
  return call.init.body == null ? undefined : JSON.parse(String(call.init.body));
}

export function installFetch(mock: typeof fetch): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  return () => {
    globalThis.fetch = originalFetch;
  };
}
