import assert from "node:assert/strict";
import { test } from "vitest";

import { SshClient } from "@/services/ssh.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("ssh client sends expected request shapes", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: never) => {
      calls.push({ path, init, options });
      if (path.endsWith("/validate")) return { valid: true, sandbox_id: "sb-1" };
      return {
        id: "ssh-1",
        sandbox_id: "sb-1",
        password: "secret",
        expires_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ssh_command: "ssh ssh-1@sandbox",
      };
    },
  });
  const client = new SshClient(transport as never);
  await client.createAccess("sb-1");
  await client.validateAccess("sb-1", "ssh-1", "secret");
  await client.regenerateAccess("sb-1", "ssh-1");
  await client.deleteAccess("sb-1", "ssh-1");
  assert.equal(calls.length, 4);
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/ssh/access");
  assert.equal(calls[1]?.path, "/v1/sandbox/sb-1/ssh/ssh-1/validate");
  assert.deepEqual(jsonOf(calls[1]!), { password: "secret" });
  assert.equal(calls[2]?.path, "/v1/sandbox/sb-1/ssh/ssh-1/regen");
  assert.equal(calls[3]?.path, "/v1/sandbox/sb-1/ssh/ssh-1");
});
