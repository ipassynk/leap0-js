import assert from "node:assert/strict";
import { test } from "vitest";

import { GitClient } from "@/services/git.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

test("git client sends expected request shapes", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: async (path: string, init: RequestInit, options = {}) => {
      calls.push({ path, init, options });
      if (path.endsWith("/commit")) return { result: { output: "ok", exit_code: 0 } };
      return { output: "ok", exit_code: 0 };
    },
  });
  const client = new GitClient(transport as never);
  await client.clone("sb-1", { url: "https://example.com/repo.git", path: "/workspace/repo" });
  await client.status("sb-1", "/workspace/repo");
  await client.branches("sb-1", { path: "/workspace/repo" });
  await client.diffUnstaged("sb-1", "/workspace/repo");
  await client.diffStaged("sb-1", "/workspace/repo");
  await client.diff("sb-1", "/workspace/repo", "main");
  await client.reset("sb-1", "/workspace/repo");
  await client.log("sb-1", { path: "/workspace/repo" });
  await client.show("sb-1", "/workspace/repo", "HEAD");
  await client.createBranch("sb-1", { path: "/workspace/repo", name: "feat" });
  await client.checkoutBranch("sb-1", {
    path: "/workspace/repo",
    branch: "feat",
    setUpstream: true,
  });
  await client.deleteBranch("sb-1", "/workspace/repo", "feat");
  await client.add("sb-1", "/workspace/repo", ["a.ts"]);
  await client.commit("sb-1", {
    path: "/workspace/repo",
    message: "msg",
    author: "Test User",
    email: "test@example.com",
  });
  await client.push("sb-1", { path: "/workspace/repo" });
  await client.pull("sb-1", { path: "/workspace/repo" });

  const diffCall = calls.find((call) => call.path === "/v1/sandbox/sb-1/git/diff");
  const showCall = calls.find((call) => call.path === "/v1/sandbox/sb-1/git/show");
  const checkoutCall = calls.find((call) => call.path === "/v1/sandbox/sb-1/git/checkout-branch");
  const addCall = calls.find((call) => call.path === "/v1/sandbox/sb-1/git/add");
  const commitCall = calls.find((call) => call.path === "/v1/sandbox/sb-1/git/commit");

  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/git/clone");
  assert.deepEqual(jsonOf(calls[0]!), {
    url: "https://example.com/repo.git",
    path: "/workspace/repo",
  });
  assert.equal(diffCall?.path, "/v1/sandbox/sb-1/git/diff");
  assert.deepEqual(jsonOf(diffCall!), { path: "/workspace/repo", target: "main" });
  assert.equal(showCall?.path, "/v1/sandbox/sb-1/git/show");
  assert.deepEqual(jsonOf(showCall!), { path: "/workspace/repo", revision: "HEAD" });
  assert.equal(checkoutCall?.path, "/v1/sandbox/sb-1/git/checkout-branch");
  assert.deepEqual(jsonOf(checkoutCall!), {
    path: "/workspace/repo",
    branch: "feat",
    set_upstream: true,
  });
  assert.equal(addCall?.path, "/v1/sandbox/sb-1/git/add");
  assert.deepEqual(jsonOf(addCall!), { path: "/workspace/repo", files: ["a.ts"] });
  assert.equal(commitCall?.path, "/v1/sandbox/sb-1/git/commit");
  assert.deepEqual(jsonOf(commitCall!), {
    path: "/workspace/repo",
    message: "msg",
    author: "Test User",
    email: "test@example.com",
  });
});

test("git client throws a clear error for empty json responses", async () => {
  const { transport } = createRecordedTransport({
    requestJson: async () => undefined,
  });
  const client = new GitClient(transport as never);

  await assert.rejects(
    () => client.status("sb-1", "/workspace/repo"),
    /Empty response from \/v1\/sandbox\/sb-1\/git\/status for sandbox sb-1/,
  );
});
