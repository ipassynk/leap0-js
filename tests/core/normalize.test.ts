import assert from "node:assert/strict";
import { test } from "vitest";

import { camelizeKeys } from "@/core/normalize.js";

test("camelizeKeys converts nested API response keys", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const bytes = new Uint8Array([1, 2, 3]);
  const result = camelizeKeys({
    template_id: "tpl-1",
    memory_mib: 1024,
    network_policy: {
      allow_domains: ["example.com"],
      transforms: [{ inject_headers: { authorization: "token" }, strip_headers: ["cookie"] }],
    },
    snapshots: [{ created_at: "2026-01-01T00:00:00Z" }],
    created_at_date: createdAt,
    file_bytes: bytes,
  });

  assert.deepEqual(result, {
    templateId: "tpl-1",
    memoryMib: 1024,
    networkPolicy: {
      allowDomains: ["example.com"],
      transforms: [{ injectHeaders: { authorization: "token" }, stripHeaders: ["cookie"] }],
    },
    snapshots: [{ createdAt: "2026-01-01T00:00:00Z" }],
    createdAtDate: createdAt,
    fileBytes: bytes,
  });
  assert.ok((result as { createdAtDate: unknown }).createdAtDate instanceof Date);
  assert.equal((result as { createdAtDate: Date }).createdAtDate.getTime(), createdAt.getTime());
  assert.ok((result as { fileBytes: unknown }).fileBytes instanceof Uint8Array);
  assert.deepEqual(Array.from((result as { fileBytes: Uint8Array }).fileBytes), [1, 2, 3]);
});
