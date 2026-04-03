import assert from "node:assert/strict";
import { test } from "vitest";

import {
  createTemplateParamsSchema,
  RegistryCredentialType,
  templateDataSchema,
} from "@/models/template.js";
import { TemplatesClient } from "@/services/templates.js";

test("accepts basic registry credentials", () => {
  const parsed = createTemplateParamsSchema.parse({
    name: "private-basic",
    uri: "registry.example.com/org/app:latest",
    credentials: {
      type: RegistryCredentialType.BASIC,
      username: "my-user",
      password: "my-password",
    },
  });
  assert.equal(parsed.credentials?.type, RegistryCredentialType.BASIC);
});

test("accepts AWS registry credentials", () => {
  const parsed = createTemplateParamsSchema.parse({
    name: "private-aws",
    uri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/app:latest",
    credentials: {
      type: RegistryCredentialType.AWS,
      aws_access_key_id: "AKIA...",
      aws_secret_access_key: "secret",
      aws_region: "us-east-1",
    },
  });
  assert.equal(parsed.credentials?.type, RegistryCredentialType.AWS);
});

test("accepts GCP registry credentials", () => {
  const parsed = createTemplateParamsSchema.parse({
    name: "private-gcp",
    uri: "us-docker.pkg.dev/project/repo/app:latest",
    credentials: {
      type: RegistryCredentialType.GCP,
      gcp_service_account_json: '{"type":"service_account"}',
    },
  });
  assert.equal(parsed.credentials?.type, RegistryCredentialType.GCP);
});

test("accepts Azure registry credentials", () => {
  const parsed = createTemplateParamsSchema.parse({
    name: "private-azure",
    uri: "registry.azurecr.io/app:latest",
    credentials: {
      type: RegistryCredentialType.AZURE,
      azure_client_id: "client-id",
      azure_client_secret: "client-secret",
      azure_tenant_id: "tenant-id",
    },
  });
  assert.equal(parsed.credentials?.type, RegistryCredentialType.AZURE);
});

test("rejects invalid basic credentials missing password", () => {
  assert.throws(() =>
    createTemplateParamsSchema.parse({
      name: "private-basic",
      uri: "registry.example.com/org/app:latest",
      credentials: { type: RegistryCredentialType.BASIC, username: "my-user" },
    }),
  );
});

test("TemplatesClient validates credentials before transport", async () => {
  let called = false;
  const client = new TemplatesClient({
    requestJson: async () => {
      called = true;
      return {};
    },
  } as never);

  await assert.rejects(() =>
    client.create({
      name: "private-aws",
      uri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/app:latest",
      credentials: { type: RegistryCredentialType.AWS, aws_access_key_id: "AKIA..." } as never,
    }),
  );

  assert.equal(called, false);
});

test("template data accepts image configs without entrypoint or cmd", () => {
  const parsed = templateDataSchema.parse({
    id: "tpl-1",
    name: "custom",
    digest: "sha256:abc",
    imageConfig: { env: { APP_ENV: "test" } },
    isSystem: false,
    createdAt: "2026-01-01T00:00:00Z",
  });

  assert.deepEqual(parsed.imageConfig, { env: { APP_ENV: "test" } });
});
