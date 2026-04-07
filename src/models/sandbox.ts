import { z } from "zod";

import {
  DEFAULT_MEMORY_MIB,
  DEFAULT_TEMPLATE_NAME,
  DEFAULT_TIMEOUT_MIN,
  DEFAULT_VCPU,
} from "@/config/constants.js";

/** Supported outbound network policy modes for a sandbox. */
export const NetworkPolicyMode = {
  ALLOW_ALL: "allow-all",
  DENY_ALL: "deny-all",
  CUSTOM: "custom",
} as const;

export const SandboxState = {
  STARTING: "starting",
  RUNNING: "running",
  SNAPSHOTTING: "snapshotting",
  PAUSED: "paused",
  UNPAUSING: "unpausing",
  DELETING: "deleting",
  DELETED: "deleted",
} as const;

export const networkPolicyModeSchema = z.enum([
  NetworkPolicyMode.ALLOW_ALL,
  NetworkPolicyMode.DENY_ALL,
  NetworkPolicyMode.CUSTOM,
]);
export type NetworkPolicyMode = z.infer<typeof networkPolicyModeSchema>;

function isValidDomainPattern(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const host = trimmed.startsWith("*.") ? trimmed.slice(2) : trimmed;
  if (!host || host.startsWith(".") || host.endsWith(".")) {
    return false;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    return false;
  }

  const labels = host.split(".");
  if (labels.length < 2) {
    return false;
  }
  return labels.every(
    (label) =>
      label.length > 0 &&
      !label.startsWith("-") &&
      !label.endsWith("-") &&
      /^[A-Za-z0-9-]+$/.test(label),
  );
}

function isValidCidr(value: string): boolean {
  if (value.indexOf("/") !== value.lastIndexOf("/")) {
    return false;
  }
  const [address, prefix] = value.split("/");
  if (!address || prefix === undefined || !/^\d+$/.test(prefix)) {
    return false;
  }
  const octets = address.split(".");
  if (octets.length !== 4) {
    return false;
  }
  if (!octets.every((octet) => /^\d+$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255)) {
    return false;
  }
  const prefixNumber = Number(prefix);
  return prefixNumber >= 0 && prefixNumber <= 32;
}

const domainPatternSchema = z.string().refine(isValidDomainPattern, {
  message: "domain must be a valid domain pattern",
});

const cidrSchema = z.string().refine(isValidCidr, {
  message: "CIDR must be a valid IPv4 CIDR block",
});

export const networkPolicySchema = z.object({
  mode: networkPolicyModeSchema,
  allowedDomains: z.array(domainPatternSchema).max(50).optional(),
  allowedCidrs: z.array(cidrSchema).max(10).optional(),
  transforms: z
    .array(
      z.object({
        domain: domainPatternSchema,
        injectHeaders: z.record(z.string(), z.string()).optional(),
        stripHeaders: z.array(z.string()).optional(),
      }),
    )
    .max(20)
    .optional(),
});
/** Network policy configuration applied to sandbox egress traffic. */
export type NetworkPolicy = z.infer<typeof networkPolicySchema>;

export const sandboxStateSchema = z.enum([
  SandboxState.STARTING,
  SandboxState.RUNNING,
  SandboxState.SNAPSHOTTING,
  SandboxState.PAUSED,
  SandboxState.UNPAUSING,
  SandboxState.DELETING,
  SandboxState.DELETED,
]);
/** Lifecycle states reported for a sandbox. */
export type SandboxState = z.infer<typeof sandboxStateSchema>;

export const sandboxDataSchema = z
  .object({
    id: z.string(),
    templateId: z.string(),
    templateName: z.string().optional(),
    state: sandboxStateSchema,
    vcpu: z.number(),
    memoryMib: z.number(),
    diskMib: z.number(),
    timeoutMin: z.number().optional(),
    autoPause: z.boolean().optional(),
    envVars: z.record(z.string(), z.string()).optional(),
    networkPolicy: networkPolicySchema.optional(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
  })
  .catchall(z.unknown());
/** Sandbox resource returned by the control plane API. */
export type SandboxData = z.infer<typeof sandboxDataSchema>;

export const createSandboxParamsSchema = z.object({
  templateName: z.string().optional(),
  vcpu: z.number().int().positive().optional(),
  memoryMib: z.number().int().positive().optional(),
  timeoutMin: z.number().int().positive().optional(),
  autoPause: z.boolean().optional(),
  otelExport: z.boolean().optional(),
  telemetry: z.boolean().optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  networkPolicy: networkPolicySchema.optional(),
});
/** Parameters accepted when creating a sandbox. */
export type CreateSandboxParams = z.infer<typeof createSandboxParamsSchema>;

export const createSandboxRuntimeParamsSchema = z
  .object(
    {
      templateName: z.preprocess(
        (value) => value ?? DEFAULT_TEMPLATE_NAME,
        z
          .string({ invalid_type_error: "templateName must be a string" })
          .trim()
          .min(1, "templateName must be 1-64 characters")
          .max(64, "templateName must be 1-64 characters"),
      ),
      vcpu: z.preprocess(
        (value) => value ?? DEFAULT_VCPU,
        z
          .number({ invalid_type_error: "vcpu must be between 1 and 8" })
          .int("vcpu must be between 1 and 8")
          .min(1, "vcpu must be between 1 and 8")
          .max(8, "vcpu must be between 1 and 8"),
      ),
      memoryMib: z.preprocess(
        (value) => value ?? DEFAULT_MEMORY_MIB,
        z
          .number({ invalid_type_error: "memoryMib must be even and between 512 and 8192" })
          .int("memoryMib must be even and between 512 and 8192")
          .min(512, "memoryMib must be even and between 512 and 8192")
          .max(8192, "memoryMib must be even and between 512 and 8192")
          .refine((value) => value % 2 === 0, {
            message: "memoryMib must be even and between 512 and 8192",
          }),
      ),
      timeoutMin: z.preprocess(
        (value) => value ?? DEFAULT_TIMEOUT_MIN,
        z
          .number({ invalid_type_error: "timeoutMin must be between 1 and 480" })
          .int("timeoutMin must be between 1 and 480")
          .min(1, "timeoutMin must be between 1 and 480")
          .max(480, "timeoutMin must be between 1 and 480"),
      ),
      autoPause: z.boolean().optional(),
      otelExport: z.boolean().optional(),
      telemetry: z.boolean().optional(),
      envVars: z.record(z.string(), z.string()).optional(),
      networkPolicy: networkPolicySchema.optional(),
    },
    { invalid_type_error: "params must be an object" },
  )
  .passthrough();

type NetworkPolicyWire = {
  mode: NetworkPolicyMode;
  allow_domains?: string[];
  allow_cidrs?: string[];
  transforms?: Array<{
    domain: string;
    inject_headers?: Record<string, string>;
    strip_headers?: string[];
  }>;
};

/** Converts SDK network policy input into the wire format expected by the API. */
export function toNetworkPolicyWire(
  policy: NetworkPolicy | undefined,
): NetworkPolicyWire | undefined {
  if (policy == null) return undefined;

  return {
    mode: policy.mode,
    allow_domains: policy.allowedDomains,
    allow_cidrs: policy.allowedCidrs,
    transforms: policy.transforms?.map((transform) => ({
      domain: transform.domain,
      inject_headers: transform.injectHeaders,
      strip_headers: transform.stripHeaders,
    })),
  };
}
