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
          items: [
            {
              name: "x11vnc",
              running: true,
              stdout_log: "/tmp/x11vnc.stdout.log",
              stderr_log: "/tmp/x11vnc.stderr.log",
            },
          ],
          running: 1,
          total: 1,
        });
      if (path.endsWith("/status"))
        return Promise.resolve({
          name: "x11vnc",
          running: true,
          stdout_log: "/tmp/x11vnc.stdout.log",
          stderr_log: "/tmp/x11vnc.stderr.log",
        });
      if (path.endsWith("/restart"))
        return Promise.resolve({
          message: "restarted",
          status: {
            name: "x11vnc",
            running: true,
            stdout_log: "/tmp/x11vnc.stdout.log",
            stderr_log: "/tmp/x11vnc.stderr.log",
          },
        });
      if (path.endsWith("/logs")) return Promise.resolve({ process: "x11vnc", logs: "ok" });
      if (path.endsWith("/errors")) return Promise.resolve({ process: "x11vnc", errors: "" });
      return Promise.resolve({ ok: true });
    },
  });
  const client = new DesktopClient(transport as never);
  await client.displayInfo("sb-1");
  await client.resizeScreen("sb-1", { width: 1280, height: 720 });
  await client.movePointer("sb-1", { x: 10, y: 20 });
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
      yield {
        status: "running",
        items: [
          {
            name: "x11vnc",
            running: true,
            stdout_log: "/tmp/x11vnc.stdout.log",
            stderr_log: "/tmp/x11vnc.stderr.log",
          },
        ],
        running: 1,
        total: 1,
      };
    },
    requestJsonUrl: () => Promise.reject(new Leap0Error("Desktop request failed")),
  });
  const client = new DesktopClient(transport as never);
  const events: unknown[] = [];
  for await (const event of client.statusStream("sb-1")) events.push(event);
  assert.deepEqual(events, [
    {
      status: "running",
      items: [
        {
          name: "x11vnc",
          running: true,
          stdoutLog: "/tmp/x11vnc.stdout.log",
          stderrLog: "/tmp/x11vnc.stderr.log",
        },
      ],
      running: 1,
      total: 1,
    },
  ]);
  assert.equal(calls[0]?.url, "https://sb-1.sandbox.example.com/api/status/stream");
  // health endpoint tested separately, it accepts 503 gracefully
});

test("desktop statusStream throws Leap0Error for structured SSE message frames", async () => {
  const { transport } = createRecordedTransport({
    streamJsonUrl: async function* () {
      yield { message: "Desktop request failed" };
    },
  });
  const client = new DesktopClient(transport as never);

  await assert.rejects(
    async () => {
      for await (const _event of client.statusStream("sb-1")) {
        // consume stream
      }
    },
    (error: unknown) => {
      assert.ok(error instanceof Leap0Error);
      assert.equal(error.message, "Desktop status stream error");
      assert.equal(error.body, "Desktop request failed");
      return true;
    },
  );
});

test("desktop waitUntilReady treats count-only updates as ready", async () => {
  const { transport } = createRecordedTransport({
    streamJsonUrl: async function* () {
      yield {
        status: "degraded",
        items: [
          {
            name: "x11vnc",
            running: true,
            stdout_log: "/tmp/x11vnc.stdout.log",
            stderr_log: "/tmp/x11vnc.stderr.log",
          },
        ],
        running: 1,
        total: 1,
      };
    },
  });
  const client = new DesktopClient(transport as never);

  await client.waitUntilReady("sb-1", { timeout: 1 });
});

test("desktop waitUntilReady forwards request timeout options", async () => {
  const calls: Array<{ options: Record<string, unknown> }> = [];
  const { transport } = createRecordedTransport({
    streamJsonUrl: async function* (_url: string, _init: RequestInit, options: Record<string, unknown> = {}) {
      calls.push({ options });
      yield {
        status: "running",
        items: [
          {
            name: "x11vnc",
            running: true,
            stdout_log: "/tmp/x11vnc.stdout.log",
            stderr_log: "/tmp/x11vnc.stderr.log",
          },
        ],
        running: 1,
        total: 1,
      };
    },
  });
  const client = new DesktopClient(transport as never);

  await client.waitUntilReady("sb-1", { timeout: 5 }, { timeout: 2 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.options.timeout, 2);
});

test("desktop input methods require a real boolean ok response", async () => {
  const { transport } = createRecordedTransport({
    requestJsonUrl: async () => ({ ok: "false" }),
  });
  const client = new DesktopClient(transport as never);

  await assert.rejects(() => client.typeText("sb-1", "hello"));
  await assert.rejects(() => client.pressKey("sb-1", "Enter"));
  await assert.rejects(() => client.hotkey("sb-1", ["Meta", "K"]));
});

test("desktop waitUntilReady ignores zero total count updates", async () => {
  const { transport } = createRecordedTransport({
    streamJsonUrl: async function* () {
      yield { status: "stopped", items: [], running: 0, total: 0 };
      yield {
        status: "degraded",
        items: [
          {
            name: "x11vnc",
            running: true,
            stdout_log: "/tmp/x11vnc.stdout.log",
            stderr_log: "/tmp/x11vnc.stderr.log",
          },
        ],
        running: 1,
        total: 1,
      };
    },
  });
  const client = new DesktopClient(transport as never);

  await client.waitUntilReady("sb-1", { timeout: 1 });
});

test("desktop client validates request payloads before transport", async () => {
  const { transport, calls } = createRecordedTransport();
  const client = new DesktopClient(transport as never);

  await assert.rejects(() => client.resizeScreen("sb-1", { width: 100, height: 720 }));
  await assert.rejects(() => client.screenshot("sb-1", { width: 100 }));
  await assert.rejects(() => client.screenshotRegion("sb-1", { x: 0, y: 0, width: 0, height: 10 }));
  await assert.rejects(() => client.click("sb-1", { x: 10 }));
  assert.equal(calls.length, 0);
});

test("desktop screenshot accepts zero-sized paired region query", async () => {
  const { transport, calls } = createRecordedTransport();
  const client = new DesktopClient(transport as never);

  await client.screenshot("sb-1", { width: 0, height: 0 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://sb-1.sandbox.example.com/api/screenshot");
  assert.deepEqual(calls[0]?.options.query, { width: 0, height: 0 });
});
