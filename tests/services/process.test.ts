import assert from "node:assert/strict";
import { test } from "vitest";

import { ProcessClient } from "@/services/process.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("process client sends execute request shape", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: never) => {
      calls.push({ path, init, options });
      return { exit_code: 0, result: "ok" };
    },
  });
  const client = new ProcessClient(transport as never);
  await client.execute("sb-1", { command: "npm test", cwd: "/workspace", timeout: 30 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/process/execute");
  assert.deepEqual(jsonOf(calls[0]!), { command: "npm test", cwd: "/workspace", timeout: 30 });
});
