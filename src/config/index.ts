import {
  DEFAULT_BASE_URL,
  DEFAULT_CLIENT_TIMEOUT,
  DEFAULT_SANDBOX_DOMAIN,
} from "@/config/constants.js";
import { Leap0Error } from "@/core/errors.js";
import { leap0ConfigInputSchema, leap0ConfigResolvedSchema } from "@/models/config.js";
import type { Leap0ConfigInput, Leap0ConfigResolved } from "@/models/config.js";
import { trimSlash } from "@/core/utils.js";

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
}

function requireNonEmpty(value: string | undefined, label: string): string {
  if (!value?.trim()) {
    throw new Leap0Error(`${label} is required`);
  }
  return value.trim();
}

function resolveSdkOtelFromEnv(envOtel: string | undefined): boolean {
  if (envOtel === "true") {
    return true;
  }
  if (envOtel === "false") {
    return false;
  }
  return Boolean(readEnv("OTEL_EXPORTER_OTLP_ENDPOINT"));
}

/**
 * Resolves SDK configuration from explicit input and environment variables.
 *
 * Args:
 *   input: Partial client configuration overrides.
 *
 * Returns:
 *   The validated runtime configuration used by the SDK.
 */
export function resolveConfig(input: Leap0ConfigInput = {}): Leap0ConfigResolved {
  leap0ConfigInputSchema.parse(input);

  const apiKey = requireNonEmpty(input.apiKey ?? readEnv("LEAP0_API_KEY"), "API key");
  const baseUrl = trimSlash(
    (input.baseUrl ?? readEnv("LEAP0_BASE_URL") ?? DEFAULT_BASE_URL).trim(),
  );
  const sandboxDomain = trimSlash(
    (input.sandboxDomain ?? readEnv("LEAP0_SANDBOX_DOMAIN") ?? DEFAULT_SANDBOX_DOMAIN).trim(),
  );
  const timeout = input.timeout ?? DEFAULT_CLIENT_TIMEOUT;
  const authHeader = (input.authHeader ?? "authorization").trim();
  const bearer = input.bearer ?? true;
  const envOtel = readEnv("LEAP0_SDK_OTEL_ENABLED");
  const sdkOtelEnabled = input.sdkOtelEnabled ?? resolveSdkOtelFromEnv(envOtel);

  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Leap0Error("timeout must be a positive number");
  }
  if (!authHeader) {
    throw new Leap0Error("authHeader cannot be empty");
  }

  return leap0ConfigResolvedSchema.parse({
    apiKey,
    baseUrl,
    sandboxDomain,
    timeout,
    authHeader,
    bearer,
    sdkOtelEnabled,
  });
}
