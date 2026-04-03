import { ZodError } from "zod";
import {
  DEFAULT_BASE_URL,
  DEFAULT_CLIENT_TIMEOUT,
  DEFAULT_SANDBOX_DOMAIN,
} from "@/config/constants.js";
import { Leap0Error } from "@/core/errors.js";
import {
  apiKeyRequiredSchema,
  authHeaderSchema,
  leap0ConfigInputSchema,
  leap0ConfigResolvedSchema,
  timeoutSchema,
} from "@/models/config.js";
import type { Leap0ConfigInput, Leap0ConfigResolved } from "@/models/config.js";
import { trimSlash } from "@/core/utils.js";

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
}

function resolveSdkOtelFromEnv(envOtel: string | undefined): boolean {
  const normalizedOtel = envOtel?.trim();
  if (normalizedOtel === undefined || normalizedOtel === "") {
    return Boolean(readEnv("OTEL_EXPORTER_OTLP_ENDPOINT"));
  }
  const lowered = normalizedOtel.toLowerCase();
  if (lowered === "true") {
    return true;
  }
  if (lowered === "false") {
    return false;
  }
  throw new Leap0Error(`Invalid LEAP0_SDK_OTEL_ENABLED value: ${normalizedOtel}`);
}

function wrapConfigError(error: unknown): never {
  if (error instanceof ZodError) {
    throw new Leap0Error(
      `Invalid Leap0 config: ${error.issues.map((issue) => issue.message).join("; ")}`,
      {
        cause: error,
        body: error.issues,
      },
    );
  }
  throw error;
}

function parseConfigOrThrow<T>(
  result: { success: true; data: T } | { success: false; error: ZodError },
): T {
  if (result.success) {
    return result.data;
  }
  wrapConfigError(result.error);
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
  try {
    parseConfigOrThrow(leap0ConfigInputSchema.safeParse(input));
    const apiKey = parseConfigOrThrow(
      apiKeyRequiredSchema.safeParse(input.apiKey ?? readEnv("LEAP0_API_KEY")),
    );
    const baseUrl = trimSlash(
      (input.baseUrl ?? readEnv("LEAP0_BASE_URL") ?? DEFAULT_BASE_URL).trim(),
    );
    const sandboxDomain = trimSlash(
      (input.sandboxDomain ?? readEnv("LEAP0_SANDBOX_DOMAIN") ?? DEFAULT_SANDBOX_DOMAIN).trim(),
    );
    const timeout = parseConfigOrThrow(
      timeoutSchema.safeParse(input.timeout ?? DEFAULT_CLIENT_TIMEOUT),
    );
    const authHeader = parseConfigOrThrow(
      authHeaderSchema.safeParse(input.authHeader ?? "authorization"),
    );
    const bearer = input.bearer ?? true;
    const envOtel = readEnv("LEAP0_SDK_OTEL_ENABLED");
    const sdkOtelEnabled = input.sdkOtelEnabled ?? resolveSdkOtelFromEnv(envOtel);

    return parseConfigOrThrow(
      leap0ConfigResolvedSchema.safeParse({
        apiKey,
        baseUrl,
        sandboxDomain,
        timeout,
        authHeader,
        bearer,
        sdkOtelEnabled,
      }),
    );
  } catch (error) {
    wrapConfigError(error);
  }
}
