import assert from "node:assert/strict";
import { test } from "vitest";

import { Leap0WebSocketError } from "@/core/errors.js";
import type { RequestOptions } from "@/models/index.js";
import { PtyClient, PtyConnection } from "@/services/pty.js";
import { createRecordedTransport } from "@tests/utils/helpers.ts";

test("pty client sends expected request shapes", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: RequestOptions = {}) => {
      calls.push({ path, init, options });
      const session = {
        id: "sess-1",
        cwd: "/workspace",
        envs: {},
        cols: 80,
        rows: 24,
        created_at: "2026-01-01T00:00:00Z",
        active: true,
        lazy_start: false,
      };
      if (path.endsWith("/pty") && (init.method ?? "GET") === "GET") return { items: [session] };
      return session;
    },
  });
  const client = new PtyClient(transport as never);
  await client.list("sb-1");
  await client.create("sb-1", { sessionId: "sess-1", cols: 80, rows: 24, cwd: "/workspace" });
  await client.get("sb-1", "sess-1");
  await client.resize("sb-1", "sess-1", 120, 40);
  await client.delete("sb-1", "sess-1");
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/pty");
  assert.equal(calls[1]?.path, "/v1/sandbox/sb-1/pty");
  assert.equal(calls[3]?.path, "/v1/sandbox/sb-1/pty/sess-1/resize");
  assert.equal(
    client.websocketUrl("sb-1", "sess-1"),
    "wss://api.example.com/v1/sandbox/sb-1/pty/sess-1/connect",
  );
  assert.deepEqual(client.websocketHeaders(), { authorization: "test-api-key" });
});

test("pty connection sends, receives, and closes websocket data", async () => {
  let sent: unknown;
  let closed = false;
  type MockListener = (event?: { data?: unknown }) => void;
  const handlers = new Map<string, MockListener[]>();
  const socket = {
    send(data: unknown) {
      sent = data;
    },
    close() {
      closed = true;
    },
    addEventListener(type: string, handler: MockListener) {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
    },
    removeEventListener(type: string, handler?: EventListenerOrEventListenerObject | null) {
      if (handler == null) {
        handlers.delete(type);
        return;
      }
      const next = (handlers.get(type) ?? []).filter((registered) => registered !== handler);
      if (next.length === 0) {
        handlers.delete(type);
        return;
      }
      handlers.set(type, next);
    },
  };
  const connection = new PtyConnection(socket as never);
  connection.send("hello");
  const recv = connection.recv();
  handlers.get("message")?.[0]?.({ data: "world" });
  assert.equal(sent, "hello");
  assert.deepEqual(Array.from(await recv), Array.from(new TextEncoder().encode("world")));
  connection.close();
  assert.equal(closed, true);
});

test("pty connection rejects recv when websocket closes first", async () => {
  type MockListener = (event?: { data?: unknown }) => void;
  const handlers = new Map<string, MockListener[]>();
  const socket = {
    send() {},
    close() {},
    addEventListener(type: string, handler: MockListener) {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
    },
    removeEventListener(type: string, handler?: EventListenerOrEventListenerObject | null) {
      if (handler == null) {
        handlers.delete(type);
        return;
      }
      const next = (handlers.get(type) ?? []).filter((registered) => registered !== handler);
      if (next.length === 0) {
        handlers.delete(type);
        return;
      }
      handlers.set(type, next);
    },
  };
  const connection = new PtyConnection(socket as never);

  const recv = connection.recv();
  handlers.get("close")?.[0]?.();

  await assert.rejects(recv, (error: unknown) => {
    assert.ok(error instanceof Leap0WebSocketError);
    assert.match(error.message, /PTY websocket closed/);
    return true;
  });
  assert.equal(handlers.size, 0);
});
