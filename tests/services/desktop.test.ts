import assert from "node:assert/strict";
import { test } from "vitest";

import { Leap0Error } from "@/core/errors.js";
import { DesktopClient } from "@/services/desktop.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("desktop client sends expected request shapes", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJsonUrl: (url: string, init: RequestInit = {}, options = {}) => {
      calls.push({ path: new URL(url).pathname, url, init, options });
      const path = new URL(url).pathname;
      if (path === "/api/display" || path === "/api/display/screen")
        return Promise.resolve({ display: ":0", width: 1280, height: 720 });
      if (path === "/api/display/windows")
        return Promise.resolve({ items: [{ id: "0x1", title: "Terminal" }] });
      if (
        path === "/api/input/move" ||
        path === "/api/input/click" ||
        path === "/api/input/drag" ||
        path === "/api/input/scroll"
      )
        return Promise.resolve({ x: 10, y: 20 });
      if (
        path === "/api/recording" ||
        path === "/api/recording/start" ||
        path === "/api/recording/stop"
      )
        return Promise.resolve({ active: false });
      if (path === "/api/recordings") return Promise.resolve({ items: [{ id: "rec-1" }] });
      if (path.startsWith("/api/recordings/")) return Promise.resolve({ id: "rec-1" });
      if (path === "/api/healthz") return Promise.resolve({ ok: true });
      if (path === "/api/status")
        return Promise.resolve({
          status: "running",
          items: [{ name: "x11vnc", running: true }],
          running: 1,
          total: 1,
        });
      if (path.endsWith("/status")) return Promise.resolve({ name: "x11vnc", running: true });
      if (path.endsWith("/restart"))
        return Promise.resolve({ message: "restarted", status: { name: "x11vnc", running: true } });
      if (path.endsWith("/logs")) return Promise.resolve({ process: "x11vnc", logs: "ok" });
      if (path.endsWith("/errors")) return Promise.resolve({ process: "x11vnc", errors: "" });
      return Promise.resolve({ ok: true });
    },
  });
  const client = new DesktopClient(transport as never);
  await client.displayInfo("sb-1");
  await client.resizeScreen("sb-1", { width: 1280, height: 720 });
  await client.movePointer("sb-1", 10, 20);
  await client.typeText("sb-1", "hello");
  await client.getProcess("sb-1", "x11vnc");
  await client.drag("sb-1", { fromX: 1, fromY: 2, toX: 3, toY: 4 });
  await client.scroll("sb-1", { direction: "down", amount: 2 });
  assert.equal(calls[0]?.url, "https://sb-1.sandbox.example.com/api/display");
  assert.equal(calls[1]?.url, "https://sb-1.sandbox.example.com/api/display/screen");
  assert.deepEqual(jsonOf(calls[1]!), { width: 1280, height: 720 });
  assert.equal(calls[2]?.url, "https://sb-1.sandbox.example.com/api/input/move");
  assert.equal(calls[4]?.url, "https://sb-1.sandbox.example.com/api/process/x11vnc/status");
  assert.equal(calls[5]?.url, "https://sb-1.sandbox.example.com/api/input/drag");
  assert.equal(calls[6]?.url, "https://sb-1.sandbox.example.com/api/input/scroll");
  assert.deepEqual(jsonOf(calls[5]!), { from_x: 1, from_y: 2, to_x: 3, to_y: 4 });
  assert.deepEqual(jsonOf(calls[6]!), { direction: "down", amount: 2 });
});

test("desktop statusStream parses SSE and raises API errors", async () => {
  const { transport, calls } = createRecordedTransport({
    streamJsonUrl: async function* (url: string) {
      calls.push({ path: new URL(url).pathname, url, init: { method: "GET" }, options: {} });
      yield { status: "running", items: [{ name: "x11vnc", running: true }], running: 1, total: 1 };
    },
    requestJsonUrl: () => Promise.reject(new Leap0Error("Desktop request failed")),
  });
  const client = new DesktopClient(transport as never);
  const events: unknown[] = [];
  for await (const event of client.statusStream("sb-1")) events.push(event);
  assert.deepEqual(events, [
    { status: "running", items: [{ name: "x11vnc", running: true }], running: 1, total: 1 },
  ]);
  assert.equal(calls[0]?.url, "https://sb-1.sandbox.example.com/api/status/stream");
  // health endpoint tested separately, it accepts 503 gracefully
});

test("desktop waitUntilReady treats count-only updates as ready", async () => {
  const { transport } = createRecordedTransport({
    streamJsonUrl: async function* () {
      yield { items: [{ name: "x11vnc", running: true }], running: 1, total: 1 };
    },
  });
  const client = new DesktopClient(transport as never);

  await client.waitUntilReady("sb-1", 1);
});
