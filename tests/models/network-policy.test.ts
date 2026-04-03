import assert from "node:assert/strict";
import { test } from "vitest";

import {
  NetworkPolicyMode,
  createSandboxParamsSchema,
  networkPolicyModeSchema,
} from "@/models/sandbox.js";

test("network policy mode constants match API values", () => {
  assert.equal(NetworkPolicyMode.ALLOW_ALL, "allow-all");
  assert.equal(NetworkPolicyMode.DENY_ALL, "deny-all");
  assert.equal(NetworkPolicyMode.CUSTOM, "custom");
});

test("network policy schema accepts all supported modes", () => {
  assert.equal(networkPolicyModeSchema.parse("allow-all"), NetworkPolicyMode.ALLOW_ALL);
  assert.equal(networkPolicyModeSchema.parse("deny-all"), NetworkPolicyMode.DENY_ALL);
  assert.equal(networkPolicyModeSchema.parse("custom"), NetworkPolicyMode.CUSTOM);
});

test("createSandboxParamsSchema accepts network policy modes", () => {
  const allowAll = createSandboxParamsSchema.parse({
    networkPolicy: { mode: NetworkPolicyMode.ALLOW_ALL },
  });
  const denyAll = createSandboxParamsSchema.parse({
    networkPolicy: { mode: NetworkPolicyMode.DENY_ALL },
  });
  const custom = createSandboxParamsSchema.parse({
    networkPolicy: {
      mode: NetworkPolicyMode.CUSTOM,
      allowedDomains: ["example.com"],
      allowedCidrs: ["10.0.0.0/8"],
      transforms: [
        {
          domain: "example.com",
          injectHeaders: { authorization: "token" },
          stripHeaders: ["cookie"],
        },
      ],
    },
  });

  assert.equal(allowAll.networkPolicy?.mode, NetworkPolicyMode.ALLOW_ALL);
  assert.equal(denyAll.networkPolicy?.mode, NetworkPolicyMode.DENY_ALL);
  assert.equal(custom.networkPolicy?.mode, NetworkPolicyMode.CUSTOM);
});

test("network policy schema enforces backend domain and cidr rules", () => {
  assert.throws(() =>
    createSandboxParamsSchema.parse({
      networkPolicy: { mode: NetworkPolicyMode.CUSTOM, allowedDomains: ["localhost"] },
    }),
  );
  assert.throws(() =>
    createSandboxParamsSchema.parse({
      networkPolicy: { mode: NetworkPolicyMode.CUSTOM, allowedCidrs: ["not-a-cidr"] },
    }),
  );
  assert.throws(() =>
    createSandboxParamsSchema.parse({
      networkPolicy: {
        mode: NetworkPolicyMode.CUSTOM,
        transforms: [{ domain: "bad domain" }],
      },
    }),
  );
});
