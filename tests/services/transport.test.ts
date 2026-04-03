import assert from "node:assert/strict";
import { test } from "vitest";

import {
  Leap0ConflictError,
  Leap0Error,
  Leap0NotFoundError,
  Leap0PermissionError,
  Leap0RateLimitError,
  Leap0TimeoutError,
} from "@/core/errors.js";
import { Leap0Transport } from "@/core/transport.js";
import { installFetch } from "@tests/utils/helpers.ts";
import * as otel from "@opentelemetry/api";

function makeTransport() {
  return new Leap0Transport({
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    sandboxDomain: "sandbox.example.com",
    timeout: 1,
    authHeader: "authorization",
    bearer: true,
    sdkOtelEnabled: false,
  });
}

test("transport headers include auth and sdk metadata", () => {
  // oxlint-disable-next-line -- access private method for testing
  const headers = (makeTransport() as never as { headers(extra?: HeadersInit): Headers }).headers({
    "x-extra": "1",
  });
  assert.equal(headers.get("authorization"), "Bearer test-key");
  assert.equal(headers.get("Leap0-Source"), "sdk-ts");
  assert.match(headers.get("User-Agent") ?? "", /^leap0-js\//);
});

test("transport requestJson sends and parses JSON", async () => {
  const restore = installFetch(async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.example.com/v1/ok?q=x");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    const result = await makeTransport().requestJson(
      "/v1/ok",
      { method: "POST", body: JSON.stringify({}) },
      { query: { q: "x" } },
    );
    assert.deepEqual(result, { ok: true });
  } finally {
    restore();
  }
});

test("transport maps HTTP status codes to SDK errors", async () => {
  for (const [status, ErrorType] of [
    [403, Leap0PermissionError],
    [404, Leap0NotFoundError],
    [409, Leap0ConflictError],
    [429, Leap0RateLimitError],
    [500, Leap0Error],
  ] as const) {
    const restore = installFetch(
      async () => new Response(JSON.stringify({ message: `status-${status}` }), { status }),
    );
    try {
      await assert.rejects(() => makeTransport().request("/v1/fail"), ErrorType);
    } finally {
      restore();
    }
  }
});

test("transport request fails after close", async () => {
  const transport = makeTransport();
  await transport.close();
  await assert.rejects(() => transport.request("/v1/test"), Leap0Error);
});

test("transport converts aborts to timeout errors", async () => {
  const restore = installFetch(async (_url: string | URL | Request, init?: RequestInit) => {
    init?.signal?.throwIfAborted();
    await new Promise((resolve) => setTimeout(resolve, 10));
    init?.signal?.throwIfAborted();
    return new Response("ok");
  });
  try {
    await assert.rejects(
      () => makeTransport().request("/v1/slow", {}, { timeout: 0.001 }),
      Leap0TimeoutError,
    );
  } finally {
    restore();
  }
});

test("transport streamJson parses server-sent events", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"a":1}\n\n'));
      controller.enqueue(
        encoder.encode(': comment\n\ndata: not-json\n\ndata: [DONE]\n\ndata: {"b":2}\n\n'),
      );
      controller.close();
    },
  });
  const restore = installFetch(async () => new Response(stream, { status: 200 }));
  try {
    const events = [];
    for await (const event of makeTransport().streamJson("/v1/stream")) events.push(event);
    assert.deepEqual(events, [{ a: 1 }, { b: 2 }]);
  } finally {
    restore();
  }
});

test("transport emits otel spans when enabled", async () => {
  const spans: Array<{ name: string; attributes: Record<string, unknown>; ended: boolean }> = [];
  const previousTracer = otel.trace.getTracer;
  otel.trace.getTracer = (() => ({
    startActiveSpan(
      name: string,
      fn: (span: {
        setAttributes(attrs: Record<string, unknown>): void;
        setStatus(): void;
        recordException(): void;
        end(): void;
      }) => Promise<Response>,
    ) {
      const span = {
        name,
        attributes: {},
        ended: false,
      };
      spans.push(span);
      return fn({
        setAttributes(attrs) {
          span.attributes = attrs;
        },
        setStatus() {},
        recordException() {},
        end() {
          span.ended = true;
        },
      });
    },
  })) as unknown as typeof otel.trace.getTracer;

  const transport = new Leap0Transport({
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    sandboxDomain: "sandbox.example.com",
    timeout: 1,
    authHeader: "authorization",
    bearer: true,
    sdkOtelEnabled: true,
  });
  const restore = installFetch(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  try {
    await transport.requestJson("/v1/ok");
    assert.equal(spans[0]?.name, "leap0.transport.request");
    assert.equal(spans[0]?.attributes["url.path"], "/v1/ok");
    assert.equal(spans[0]?.ended, true);
  } finally {
    restore();
    otel.trace.getTracer = previousTracer;
  }
});
