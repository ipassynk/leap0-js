import assert from "node:assert/strict";
import { test } from "vitest";

import { FilesystemClient } from "@/services/filesystem.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("filesystem client sends expected request shapes", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options: never) => {
      calls.push({ path, init, options });
      if (path.endsWith("/ls")) return { items: [] };
      if (path.endsWith("/stat"))
        return {
          name: "file",
          path: "/tmp/file",
          is_dir: false,
          size: 1,
          mode: "644",
          mtime: 1,
          owner: "root",
          group: "root",
          is_symlink: false,
        };
      if (path.endsWith("/grep"))
        return { items: [{ path: "/tmp/a.txt", line: 1, content: "todo" }] };
      if (path.endsWith("/edit-file")) return { diff: "", replacements: 1 };
      if (path.endsWith("/edit-files")) return { items: [] };
      if (path.endsWith("/tree")) return { items: [] };
      if (path.endsWith("/exists")) return { exists: true };
      if (path.endsWith("/glob")) return { items: [] };
      return { items: [] };
    },
  });
  const client = new FilesystemClient(transport as never);
  await client.ls("sb-1", "/workspace");
  await client.stat("sb-1", "/tmp/file");
  await client.mkdir("sb-1", "/tmp/new");
  await client.writeFile("sb-1", "/tmp/a.txt", "hello");
  await client.writeBytes("sb-1", "/tmp/b.bin", new Uint8Array([1, 2]));
  await client.readFile("sb-1", "/tmp/a.txt", { head: 10 });
  await client.readBytes("sb-1", "/tmp/b.bin");
  await client.delete("sb-1", "/tmp/a.txt");
  await client.setPermissions("sb-1", "/tmp/a.txt", { mode: "0755" });
  await client.setPermissions("sb-1", "/tmp/b.txt", { owner: "alice", group: "staff" });
  await client.glob("sb-1", "/workspace", "**/*.ts");
  await client.grep("sb-1", "/workspace", "todo");
  await client.editFile("sb-1", "/tmp/a.txt", [{ find: "a", replace: "b" }]);
  await client.editFiles("sb-1", { paths: ["/tmp/a.txt"], find: "a", replace: "b" });
  await client.editFiles("sb-1", { paths: ["/tmp/b.txt"], find: "x" });
  await client.move("sb-1", "/tmp/a", "/tmp/b");
  await client.copy("sb-1", "/tmp/b", "/tmp/c");
  const fileExists = await client.exists("sb-1", "/tmp/c");
  await client.tree("sb-1", "/workspace", { maxDepth: 2 });

  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/filesystem/ls");
  assert.deepEqual(jsonOf(calls[0]!), { path: "/workspace" });
  // writeFile goes through writeBytes, both use octet-stream
  assert.equal(new Headers(calls[3]!.init.headers).get("content-type"), "application/octet-stream");
  assert.equal(calls[3]?.options.query?.path, "/tmp/a.txt");
  assert.equal(new Headers(calls[4]!.init.headers).get("content-type"), "application/octet-stream");
  assert.equal(ArrayBuffer.isView(calls[4]!.init.body), true);
  assert.deepEqual(jsonOf(calls[5]!), { path: "/tmp/a.txt", head: 10 });
  assert.deepEqual(jsonOf(calls[8]!), { path: "/tmp/a.txt", mode: "0755" });
  assert.deepEqual(jsonOf(calls[9]!), { path: "/tmp/b.txt", owner: "alice", group: "staff" });
  assert.deepEqual(jsonOf(calls[12]!), {
    path: "/tmp/a.txt",
    edits: [{ find: "a", replace: "b" }],
  });
  assert.deepEqual(jsonOf(calls[13]!), {
    files: ["/tmp/a.txt"],
    find: "a",
    replace: "b",
  });
  assert.deepEqual(jsonOf(calls[14]!), { files: ["/tmp/b.txt"], find: "x" });
  assert.deepEqual(jsonOf(calls[15]!), {
    src_path: "/tmp/a",
    dst_path: "/tmp/b",
    overwrite: false,
  });
  assert.equal(typeof fileExists, "boolean");
  assert.equal(fileExists, true);
  assert.deepEqual(jsonOf(calls[18]!), { path: "/workspace", max_depth: 2 });
});

test("filesystem setPermissions rejects empty updates before transport", async () => {
  const { transport, calls } = createRecordedTransport();
  const client = new FilesystemClient(transport as never);

  await assert.rejects(
    () => client.setPermissions("sb-1", "/tmp/a.txt"),
    /setPermissions requires at least one of mode, owner, or group/,
  );
  assert.equal(calls.length, 0);
});

test("filesystem setPermissions rejects blank string updates before transport", async () => {
  const { transport, calls } = createRecordedTransport();
  const client = new FilesystemClient(transport as never);

  await assert.rejects(() => client.setPermissions("sb-1", "/tmp/a.txt", { mode: "   " }));
  await assert.rejects(() => client.setPermissions("sb-1", "/tmp/a.txt", { owner: "" }));
  await assert.rejects(() => client.setPermissions("sb-1", "/tmp/a.txt", { group: "  " }));
  assert.equal(calls.length, 0);
});

test("filesystem readFilesBytes fails on unexpected non-blob form parts", async () => {
  const form = new FormData();
  form.append("/tmp/meta.json", "not-a-file");
  const client = new FilesystemClient({
    ...createRecordedTransport().transport,
    request: async () => new Response(form),
  } as never);

  await assert.rejects(
    () => client.readFilesBytes("sb-1", ["/tmp/meta.json"]),
    /Failed to parse \/read-files response: expected Blob\/File for entry "\/tmp\/meta.json", received string/,
  );
});

test("filesystem readFile rejects head and tail together", async () => {
  const { transport, calls } = createRecordedTransport();
  const client = new FilesystemClient(transport as never);

  await assert.rejects(
    () => client.readFile("sb-1", "/tmp/a.txt", { head: 1, tail: 1 }),
    /read-file head and tail are mutually exclusive/,
  );
  assert.equal(calls.length, 0);
});
