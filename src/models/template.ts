import { z } from "zod";

export const TEMPLATE_NAME_ERROR_MESSAGE =
  "name must be non-empty, <= 64 chars, contain no whitespace, and not start with system/";
export const TEMPLATE_URI_ERROR_MESSAGE = "uri must be non-empty and <= 500 chars";

/** Supported private registry credential types for template imports. */
export const RegistryCredentialType = {
  BASIC: "basic",
  AWS: "aws",
  GCP: "gcp",
  AZURE: "azure",
} as const;

export const templateImageConfigSchema = z
  .object({
    entrypoint: z.array(z.string()).nullable().optional(),
    cmd: z.array(z.string()).nullable().optional(),
    workingDir: z.string().optional(),
    user: z.string().optional(),
    env: z.record(z.string(), z.string()).nullable().optional(),
  })
  .catchall(z.unknown());
/** OCI image configuration captured for a template. */
export type TemplateImageConfig = z.infer<typeof templateImageConfigSchema>;

export const templateDataSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    digest: z.string(),
    imageConfig: templateImageConfigSchema,
    isSystem: z.boolean(),
    createdAt: z.string(),
  })
  .catchall(z.unknown());
/** Template resource returned by the control plane API. */
export type TemplateData = z.infer<typeof templateDataSchema>;

export const registryCredentialTypeSchema = z.enum([
  RegistryCredentialType.BASIC,
  RegistryCredentialType.AWS,
  RegistryCredentialType.GCP,
  RegistryCredentialType.AZURE,
]);
/** Registry credential type discriminator. */
export type RegistryCredentialType = z.infer<typeof registryCredentialTypeSchema>;

export const basicRegistryCredentialsSchema = z.object({
  type: z.literal(RegistryCredentialType.BASIC),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const awsRegistryCredentialsSchema = z.object({
  type: z.literal(RegistryCredentialType.AWS),
  aws_access_key_id: z.string().min(1),
  aws_secret_access_key: z.string().min(1),
  aws_region: z.string().optional(),
});

export const gcpRegistryCredentialsSchema = z.object({
  type: z.literal(RegistryCredentialType.GCP),
  gcp_service_account_json: z.string().min(1),
});

export const azureRegistryCredentialsSchema = z.object({
  type: z.literal(RegistryCredentialType.AZURE),
  azure_client_id: z.string().min(1),
  azure_client_secret: z.string().min(1),
  azure_tenant_id: z.string().min(1),
});

export const registryCredentialsSchema = z.discriminatedUnion("type", [
  basicRegistryCredentialsSchema,
  awsRegistryCredentialsSchema,
  gcpRegistryCredentialsSchema,
  azureRegistryCredentialsSchema,
]);

/** Username/password credentials for a private registry. */
export type BasicRegistryCredentials = z.infer<typeof basicRegistryCredentialsSchema>;
/** AWS registry credentials for ECR-backed template imports. */
export type AwsRegistryCredentials = z.infer<typeof awsRegistryCredentialsSchema>;
/** GCP registry credentials for Artifact Registry or GCR-backed imports. */
export type GcpRegistryCredentials = z.infer<typeof gcpRegistryCredentialsSchema>;
/** Azure registry credentials for ACR-backed template imports. */
export type AzureRegistryCredentials = z.infer<typeof azureRegistryCredentialsSchema>;
/** Union of all supported private registry credential payloads. */
export type RegistryCredentials = z.infer<typeof registryCredentialsSchema>;

export const createTemplateParamsSchema = z.object({
  name: z.string(),
  uri: z.string(),
  credentials: registryCredentialsSchema.optional(),
});
/** Parameters accepted when creating a template from a container image URI. */
export type CreateTemplateParams = z.infer<typeof createTemplateParamsSchema>;

export const templateNameSchema = z.string().superRefine((name, ctx) => {
  if (
    !name.trim() ||
    name.length > 64 ||
    /\s/.test(name) ||
    name.toLowerCase().startsWith("system/")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: TEMPLATE_NAME_ERROR_MESSAGE,
    });
  }
});

export const templateUriSchema = z.string().superRefine((uri, ctx) => {
  if (!uri.trim() || uri.length > 500) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: TEMPLATE_URI_ERROR_MESSAGE,
    });
  }
});

export const createTemplateRequestSchema = createTemplateParamsSchema.extend({
  name: templateNameSchema,
  uri: templateUriSchema,
});

export const renameTemplateParamsSchema = z.object({
  name: templateNameSchema,
});
/** Parameters accepted when renaming a template. */
export type RenameTemplateParams = z.infer<typeof renameTemplateParamsSchema>;
