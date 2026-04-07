import assert from "node:assert/strict";
import { test } from "vitest";

import { ProcessClient } from "@/services/process.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("process client sends execute request shape", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: never) => {
      calls.push({ path, init, options });
      return { exit_code: 0, stdout: "ok", stderr: "warn" };
    },
  });
  const client = new ProcessClient(transport as never);
  const result = await client.execute("sb-1", { command: "npm test", cwd: "/workspace", timeout: 30 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/process/execute");
  assert.deepEqual(jsonOf(calls[0]!), { command: "npm test", cwd: "/workspace", timeout: 30 });
  assert.deepEqual(result, { exitCode: 0, stdout: "ok", stderr: "warn" });
});

test("process client expands env placeholders before sending request", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: never) => {
      calls.push({ path, init, options });
      return { exit_code: 0, stdout: "ok", stderr: "" };
    },
  });
  const client = new ProcessClient(transport as never);

  await client.execute("sb-1", {
    command: "echo $NAME from ${PLACE}",
    cwd: "/workspace/$NAME",
    timeout: 30,
    env: { NAME: "leap0", PLACE: "sandbox" },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(jsonOf(calls[0]!), {
    command: "echo leap0 from sandbox",
    cwd: "/workspace/leap0",
    timeout: 30,
  });
});
