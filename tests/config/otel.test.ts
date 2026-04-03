import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

import * as otelModule from "@/core/otel.js";
import { Leap0Client } from "@/client/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("client initializes otel when sdk otel is enabled", async () => {
  const initSpy = vi.spyOn(otelModule, "initOtel").mockImplementation(() => {});

  const client = new Leap0Client({ apiKey: "key", sdkOtelEnabled: true });
  try {
    assert.equal(initSpy.mock.calls.length, 1);
  } finally {
    await client.close();
  }
});

test("client skips otel initialization when disabled", async () => {
  const initSpy = vi.spyOn(otelModule, "initOtel");

  const client = new Leap0Client({ apiKey: "key", sdkOtelEnabled: false });
  try {
    assert.equal(initSpy.mock.calls.length, 0);
  } finally {
    await client.close();
  }
});

test("client shuts down otel on close and swallows shutdown errors", async () => {
  vi.spyOn(otelModule, "initOtel").mockImplementation(() => {});
  const shutdownSpy = vi.spyOn(otelModule, "shutdownOtel").mockRejectedValue(new Error("boom"));
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const client = new Leap0Client({ apiKey: "key", sdkOtelEnabled: true });
  await client.close();
  await client.close();

  assert.equal(shutdownSpy.mock.calls.length, 1);
  assert.equal(warnSpy.mock.calls.length, 1);
});
