import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "vitest";

import { Leap0Error } from "@/core/errors.js";
import { SandboxesClient } from "@/services/sandboxes.js";
import { createRecordedTransport, jsonOf } from "@tests/utils/helpers.ts";

function makeClient() {
  const { transport, calls } = createRecordedTransport({
    requestJson: (path: string, init: RequestInit, options: unknown) => {
      calls.push({ path, init, options: options as never });
      return Promise.resolve({
        id: "sb-1",
        template_id: "tpl-1",
        state: "running",
        vcpu: 2,
        memory_mib: 1024,
        disk_mib: 4096,
        auto_pause: false,
        created_at: "2026-01-01T00:00:00Z",
      });
    },
  });
  const client = new SandboxesClient(transport as never);
  return { client, calls };
}

const ENV_KEYS = ["OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_HEADERS"] as const;
let envSnapshot: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  envSnapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = envSnapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("sandboxes create validates payload and wraps result", async () => {
  const { client, calls } = makeClient();
  const result = await client.create({
    templateName: " custom ",
    vcpu: 2,
    memoryMib: 1024,
    timeoutMin: 10,
  });
  assert.equal(result.id, "sb-1");
  assert.equal(result.templateId, "tpl-1");
  assert.equal(result.memoryMib, 1024);
  assert.equal(result.diskMib, 4096);
  assert.equal(result.createdAt, "2026-01-01T00:00:00Z");
  assert.equal(calls[0]?.path, "/v1/sandbox");
  assert.equal((jsonOf(calls[0]!) as { template_name: string }).template_name, "custom");
});

test("sandboxes create rejects invalid parameters", async () => {
  const { client } = makeClient();
  await assert.rejects(() => client.create(null as never), /params must be an object/);
  await assert.rejects(
    () => client.create({ templateName: 123 as never }),
    /templateName must be a string/,
  );
  await assert.rejects(() => client.create({ vcpu: 0 }), Leap0Error);
  await assert.rejects(() => client.create({ memoryMib: 513 }), Leap0Error);
  await assert.rejects(() => client.create({ timeoutMin: 999 }), Leap0Error);
});

test("sandboxes get pause and delete target sandbox ids", async () => {
  const { client, calls } = makeClient();
  await client.get({ id: "sb-1" });
  await client.pause("sb-2");
  await client.delete("sb-3");
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/");
  assert.equal(calls[1]?.path, "/v1/sandbox/sb-2/pause");
  assert.equal(calls[2]?.path, "/v1/sandbox/sb-3/");
});

test("sandboxes runtime info targets system endpoints", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: (path: string, init: RequestInit, options: unknown) => {
      calls.push({ path, init, options: options as never });
      if (path.endsWith("/user-home-dir")) {
        return Promise.resolve({ user_home_dir: "/home/steven" });
      }
      return Promise.resolve({ workdir: "/home/steve/agent" });
    },
  });
  const client = new SandboxesClient(transport as never);

  assert.equal(await client.getUserHomeDir("sb-1"), "/home/steven");
  assert.equal(await client.getWorkdir("sb-1"), "/home/steve/agent");
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/system/user-home-dir");
  assert.equal(calls[1]?.path, "/v1/sandbox/sb-1/system/workdir");
});

test("sandboxes runtime info rejects non-object responses", async () => {
  const { transport } = createRecordedTransport({
    requestJson: (path: string) => {
      if (path.endsWith("/user-home-dir")) {
        return Promise.resolve(null);
      }
      return Promise.resolve("/tmp");
    },
  });
  const client = new SandboxesClient(transport as never);

  await assert.rejects(() => client.getUserHomeDir("sb-1"), /missing user_home_dir/);
  await assert.rejects(() => client.getWorkdir("sb-1"), /missing workdir/);
});

test("sandboxes create and delete presigned urls", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: (path: string, init: RequestInit, options: unknown) => {
      calls.push({ path, init, options: options as never });
      return Promise.resolve({
        id: "psu-1",
        token: "tok_1",
        url: "https://tok_1.leap0.app",
        sandbox_id: "sb-1",
        port: 8080,
        expires_at: "2026-01-01T00:15:00Z",
        created_at: "2026-01-01T00:00:00Z",
      });
    },
    request: (path: string, init: RequestInit, options: unknown) => {
      calls.push({ path, init, options: options as never });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  const client = new SandboxesClient(transport as never);

  const created = await client.createPresignedUrl("sb-1", { port: 8080, expiresIn: 900 });
  await client.deletePresignedUrl("sb-1", created.id);

  assert.equal(created.url, "https://tok_1.leap0.app");
  assert.equal(calls[0]?.path, "/v1/sandbox/sb-1/presigned-url");
  assert.deepEqual(jsonOf(calls[0]!) as { port: number; expires_in_minutes: number }, {
    port: 8080,
    expires_in: 900,
  });
  assert.equal(calls[1]?.path, "/v1/sandbox/sb-1/presigned-url/psu-1");
});


test("sandboxes list sends query params and normalizes response", async () => {
  const { transport, calls } = createRecordedTransport({
    requestJson: (path: string, init: RequestInit, options: unknown) => {
      calls.push({ path, init, options: options as never });
      return Promise.resolve({
        items: [
          {
            id: "sb-1",
            template_id: "tpl-1",
            state: "running",
            launch_time: "2026-01-01T00:00:05Z",
            state_change_time: "2026-01-01T00:00:10Z",
            timeout_at: 1735689900,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        total_items: 1,
      });
    },
  });
  const client = new SandboxesClient(transport as never);

  const result = await client.list({
    state: "running",
    sort: "state",
    orderBy: "asc",
    page: 2,
    pageSize: 10,
  });

  assert.equal(calls[0]?.path, "/v1/sandboxes");
  assert.deepEqual(calls[0]?.options.query, {
    state: "running",
    sort: "state",
    "order-by": "asc",
    page: 2,
    "page-size": 10,
  });
  assert.equal(result.totalItems, 1);
  assert.equal(result.items[0]?.templateId, "tpl-1");
  assert.equal(result.items[0]?.launchTime, "2026-01-01T00:00:05Z");
});

test("sandboxes build invoke and websocket urls", () => {
  const { client } = makeClient();
  assert.equal(client.invokeUrl("sb-1", "healthz"), "https://sb-1.sandbox.example.com/healthz");
  assert.equal(client.websocketUrl("sb-1", "/ws"), "wss://sb-1.sandbox.example.com/ws");
});

test("sandboxes create injects otel env when enabled", async () => {
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
  process.env.OTEL_EXPORTER_OTLP_HEADERS = "authorization=token";
  const { client, calls } = makeClient();

  await client.create({
    otelExport: true,
    envVars: { APP_ENV: "test" },
  });

  assert.deepEqual((jsonOf(calls[0]!) as { env_vars: Record<string, string> }).env_vars, {
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
    OTEL_EXPORTER_OTLP_HEADERS: "authorization=token",
    APP_ENV: "test",
  });
});

test("sandboxes create accepts telemetry alias for otel export", async () => {
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
  delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
  const { client, calls } = makeClient();

  await client.create({ telemetry: true });

  assert.deepEqual((jsonOf(calls[0]!) as { env_vars: Record<string, string> }).env_vars, {
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
  });
});

test("sandboxes create rejects otel export without endpoint", async () => {
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
  const { client } = makeClient();

  await assert.rejects(() => client.create({ otelExport: true }), /OTEL_EXPORTER_OTLP_ENDPOINT/);
});

test("sandboxes create serializes network policy using api field names", async () => {
  const { client, calls } = makeClient();

  await client.create({
    networkPolicy: {
      mode: "custom",
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

  assert.deepEqual((jsonOf(calls[0]!) as { network_policy: unknown }).network_policy, {
    mode: "custom",
    allow_domains: ["example.com"],
    allow_cidrs: ["10.0.0.0/8"],
    transforms: [
      {
        domain: "example.com",
        inject_headers: { authorization: "token" },
        strip_headers: ["cookie"],
      },
    ],
  });
});
