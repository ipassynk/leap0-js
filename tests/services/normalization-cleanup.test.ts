import assert from "node:assert/strict";
import { test } from "vitest";

import { CodeInterpreterClient } from "@/services/code-interpreter.js";
import { FilesystemClient } from "@/services/filesystem.js";
import { SshClient } from "@/services/ssh.js";
import { TemplatesClient } from "@/services/templates.js";
import { renameTemplateParamsSchema } from "@/models/template.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("template client normalizes created_at", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: never) => {
      calls.push({ path, init, options });
      return {
        id: "tpl-1",
        name: "custom",
        digest: "sha256:abc",
        image_config: { entrypoint: ["python"], cmd: ["app.py"] },
        is_system: false,
        created_at: "2026-01-01T00:00:00Z",
      };
    },
  });

  const template = await new TemplatesClient(transport as never).create({
    name: "custom",
    uri: "docker.io/acme/app:latest",
    ignored: true,
  } as never);

  assert.equal(template.createdAt, "2026-01-01T00:00:00Z");
  assert.deepEqual(jsonOf(calls[0]!), {
    name: "custom",
    uri: "docker.io/acme/app:latest",
  });
});

test("template client validates and normalizes rename responses", async () => {
  const { transport, calls } = createRecordedTransport({
    request: async (path: string, init: RequestInit, options = {}) => {
      calls.push({ path, init, options });
      return new Response(null, { status: 204 });
    },
  });

  await new TemplatesClient(transport as never).rename("tpl-1", { name: "renamed" });

  assert.equal(calls[0]?.path, "/v1/template/tpl-1");
  assert.deepEqual(jsonOf(calls[0]!), { name: "renamed" });
});

test("template client reuses name validation for rename", async () => {
  const { transport } = createRecordedTransport();
  const client = new TemplatesClient(transport as never);

  await assert.throws(() => renameTemplateParamsSchema.parse({ name: "system/test" }));
  await assert.doesNotThrow(() => renameTemplateParamsSchema.parse({ name: "renamed" }));
  await assert.rejects(() => client.rename("tpl-1", { name: "" }));
});

test("ssh client normalizes expires_at", async () => {
  const { transport } = createRecordedTransport({
    requestJson: async () => ({
      id: "ssh-1",
      sandbox_id: "sb-1",
      password: "secret",
      expires_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ssh_command: "ssh ssh-1@sandbox",
    }),
  });

  const access = await new SshClient(transport as never).createAccess("sb-1");

  assert.equal(access.expiresAt, "2026-01-01T00:00:00Z");
});

test("filesystem client normalizes nested snake_case fields", async () => {
  const { transport } = createRecordedTransport({
    requestJson: async () => ({
      items: [
        {
          name: "tmp",
          path: "/tmp",
          is_dir: true,
          size: 0,
          mode: "755",
          mtime: 1,
          owner: "root",
          group: "root",
          is_symlink: false,
        },
      ],
    }),
  });

  const result = await new FilesystemClient(transport as never).ls("sb-1", "/workspace");

  assert.equal(result.items[0]?.isDir, true);
  assert.equal(result.items[0]?.mode, "755");
});

test("code interpreter client normalizes context fields", async () => {
  const { transport } = createRecordedTransport({
    requestJsonUrl: async () => ({ id: "ctx-1", language: 1, cwd: "/workspace" }),
  });

  const context = await new CodeInterpreterClient(transport as never).createContext(
    "sb-1",
    "python",
  );

  assert.equal(context.cwd, "/workspace");
});
