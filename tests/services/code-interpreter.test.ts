import assert from "node:assert/strict";
import { test } from "vitest";

import { Leap0Error } from "@/core/errors.js";
import { CodeInterpreterClient } from "@/services/code-interpreter.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("code interpreter client sends expected request shapes", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJsonUrl: async (url: string, init: RequestInit = {}, options = {}) => {
      calls.push({ path: new URL(url).pathname, url, init, options });
      if (new URL(url).pathname === "/contexts" && (init.method ?? "GET") === "POST")
        return { id: "ctx-1", language: 1, cwd: "/workspace" };
      if (new URL(url).pathname === "/contexts")
        return { items: [{ id: "ctx-1", language: 1, cwd: "/workspace" }] };
      if (new URL(url).pathname === "/execute")
        return { context_id: "ctx-1", items: [], logs: { stdout: [], stderr: [] } };
      return { id: "ctx-1", language: 1, cwd: "/workspace" };
    },
  });
  const client = new CodeInterpreterClient(transport as never);
  await client.health("sb-1");
  await client.createContext("sb-1", "python");
  await client.listContexts("sb-1");
  await client.getContext("sb-1", "ctx-1");
  await client.deleteContext("sb-1", "ctx-1");
  await client.execute("sb-1", { code: "print(1)", language: "python", contextId: "ctx-1" });
  const healthResult = await client.health("sb-1");
  assert.equal(typeof healthResult, "boolean");
  assert.equal(calls[0]?.url, "https://sb-1.sandbox.example.com/healthz");
  assert.equal(calls[1]?.url, "https://sb-1.sandbox.example.com/contexts");
  assert.deepEqual(jsonOf(calls[1]!), { language: "python" });
  assert.equal(calls[3]?.url, "https://sb-1.sandbox.example.com/contexts/ctx-1");
  assert.equal(calls[5]?.url, "https://sb-1.sandbox.example.com/execute");
  assert.deepEqual(jsonOf(calls[5]!), {
    code: "print(1)",
    language: "python",
    context_id: "ctx-1",
  });
});

test("code interpreter stream parses SSE and maps event types", async () => {
  const { transport, calls } = createRecordedTransport({
    streamJsonUrl: async function* (url: string, init: RequestInit = {}, options = {}) {
      calls.push({ path: new URL(url).pathname, url, init, options });
      yield { type: 0, data: "hello" };
      yield { type: 2, data: 0 };
    },
    requestJsonUrl: (url: string) =>
      Promise.reject(new Leap0Error(`Code interpreter request failed: ${url}`)),
  });
  const client = new CodeInterpreterClient(transport as never);
  const events: Array<{ type: string; data: unknown }> = [];
  for await (const event of client.executeStream("sb-1", {
    code: "print(1)",
    language: "python",
    contextId: "ctx-1",
  }))
    events.push(event as { type: string; data: unknown });
  assert.deepEqual(events, [
    { type: "stdout", data: "hello" },
    { type: "exit", data: 0 },
  ]);
  assert.equal(calls[0]?.url, "https://sb-1.sandbox.example.com/execute/async");
  assert.deepEqual(jsonOf(calls[0]!), {
    code: "print(1)",
    language: "python",
    context_id: "ctx-1",
  });
  await assert.rejects(() => client.health("sb-1"), Leap0Error);
});
