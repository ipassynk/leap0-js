import assert from "node:assert/strict";
import { test } from "vitest";

import * as sdk from "@/index.js";

test("public index exports core sdk surface", () => {
  assert.ok(sdk.Leap0Client);
  assert.ok(sdk.Sandbox);
  assert.ok(sdk.SandboxesClient);
  assert.ok(sdk.SnapshotsClient);
  assert.ok(sdk.TemplatesClient);
  assert.ok(sdk.FilesystemClient);
  assert.ok(sdk.GitClient);
  assert.ok(sdk.ProcessClient);
  assert.ok(sdk.PtyClient);
  assert.ok(sdk.LspClient);
  assert.ok(sdk.SshClient);
  assert.ok(sdk.CodeInterpreterClient);
  assert.ok(sdk.DesktopClient);
  assert.equal(sdk.RegistryCredentialType.AWS, "aws");
  assert.equal(sdk.NetworkPolicyMode.ALLOW_ALL, "allow-all");
  assert.equal(sdk.NetworkPolicyMode.DENY_ALL, "deny-all");
  assert.equal(sdk.SandboxState.RUNNING, "running");
  assert.equal(sdk.CodeLanguage.PYTHON, "python");
  assert.equal(sdk.StreamEventType.STDOUT, "stdout");
  assert.equal(typeof sdk.SDK_VERSION, "string");
});
