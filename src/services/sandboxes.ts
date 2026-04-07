import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS } from "@/config/constants.js";
import { Leap0Error } from "@/core/errors.js";
import { normalize } from "@/core/normalize.js";
import {
  createSandboxRuntimeParamsSchema,
  sandboxDataSchema,
  toNetworkPolicyWire,
} from "@/models/sandbox.js";
import type {
  CreateSandboxParams,
  RequestOptions,
  SandboxData,
  SandboxRef,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import {
  ensureLeadingSlash,
  sandboxBaseUrl,
  sandboxIdOf,
  websocketUrlFromHttp,
} from "@/core/utils.js";
import { withErrorPrefix } from "@/services/shared.js";

function injectOtelEnv(
  envVars: Record<string, string> | undefined,
  enabled: boolean,
): Record<string, string> | undefined {
  if (!enabled) {
    return envVars;
  }

  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};
  const endpoint = env[OTEL_EXPORTER_OTLP_ENDPOINT]?.trim();
  if (!endpoint) {
    throw new Leap0Error(
      `otelExport=true requires ${OTEL_EXPORTER_OTLP_ENDPOINT} in the local environment`,
    );
  }

  const merged: Record<string, string> = {
    [OTEL_EXPORTER_OTLP_ENDPOINT]: endpoint,
  };
  const headers = env[OTEL_EXPORTER_OTLP_HEADERS]?.trim();
  if (headers) {
    merged[OTEL_EXPORTER_OTLP_HEADERS] = headers;
  }
  if (envVars) {
    Object.assign(merged, envVars);
  }
  return merged;
}

type SandboxFactory<T> = (data: SandboxData) => T;

/**
 * Creates, fetches, pauses, and deletes sandboxes.
 *
 * @throws {Leap0Error} If request validation, API calls, or response validation fail.
 */
export class SandboxesClient<T = SandboxData> {
  private readonly sandboxFactory?: SandboxFactory<T>;

  constructor(transport: Leap0Transport);
  constructor(transport: Leap0Transport, sandboxFactory: SandboxFactory<T>);
  constructor(
    private readonly transport: Leap0Transport,
    sandboxFactory?: SandboxFactory<T>,
  ) {
    this.sandboxFactory = sandboxFactory;
  }

  private wrap(data: SandboxData): T {
    return (this.sandboxFactory ? this.sandboxFactory(data) : data) as T;
  }

  /**
   * Creates a sandbox from a template and resource config.
   *
   * @param params Sandbox creation parameters.
   * @param options Optional request settings such as timeout and query params.
   * @throws {Leap0Error} If params are invalid, local OTEL env is missing, or sandbox creation fails.
   *
   * @example
   * ```ts
   * const sandbox = await client.sandboxes.create({
   *   templateName: "base",
   *   timeoutMin: 30,
   * });
   * ```
   */
  async create(params: CreateSandboxParams = {}, options: RequestOptions = {}): Promise<T> {
    const parsedParams = createSandboxRuntimeParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      throw new Leap0Error(parsedParams.error.issues[0]?.message ?? "Invalid sandbox parameters");
    }
    const normalizedParams = parsedParams.data;

    const effectiveOtelExport = normalizedParams.otelExport ?? Boolean(normalizedParams.telemetry);
    const payload = {
      template_name: normalizedParams.templateName,
      vcpu: normalizedParams.vcpu,
      memory_mib: normalizedParams.memoryMib,
      timeout_min: normalizedParams.timeoutMin,
      auto_pause: normalizedParams.autoPause ?? false,
      env_vars: injectOtelEnv(normalizedParams.envVars, effectiveOtelExport),
      network_policy: toNetworkPolicyWire(normalizedParams.networkPolicy),
    };

    return withErrorPrefix("Failed to create sandbox: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        "/v1/sandbox",
        { method: "POST", body: jsonBody(payload) },
        options,
      );
      return this.wrap(normalize(sandboxDataSchema, data));
    });
  }

  /** Pauses a running sandbox. */
  async pause(sandbox: SandboxRef, options: RequestOptions = {}): Promise<T> {
    return withErrorPrefix("Failed to pause sandbox: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/pause`,
        { method: "POST" },
        options,
      );
      return this.wrap(normalize(sandboxDataSchema, data));
    });
  }

  /** Fetches a sandbox by ID. */
  async get(sandbox: SandboxRef, options: RequestOptions = {}): Promise<T> {
    return withErrorPrefix("Failed to get sandbox: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/`,
        { method: "GET" },
        options,
      );
      return this.wrap(normalize(sandboxDataSchema, data));
    });
  }

  /** Deletes a sandbox by ID. */
  async delete(sandbox: SandboxRef, options: RequestOptions = {}): Promise<void> {
    await withErrorPrefix("Failed to delete sandbox: ", () =>
      this.transport.request(`/v1/sandbox/${sandboxIdOf(sandbox)}/`, { method: "DELETE" }, options),
    );
  }

  /**
   * Builds the public invoke URL for a sandbox.
   *
   * @param path Route path to append to the sandbox base URL.
   * @param port Optional forwarded port.
   * @returns The public HTTPS URL for the sandbox.
   */
  invokeUrl(sandbox: SandboxRef, path = "/", port?: number): string {
    return `${sandboxBaseUrl(sandboxIdOf(sandbox), this.transport.sandboxDomain, port)}${ensureLeadingSlash(path)}`;
  }

  /**
   * Builds the public websocket URL for a sandbox.
   *
   * @param path Route path to append to the sandbox base URL.
   * @param port Optional forwarded port.
   * @returns The public websocket URL for the sandbox.
   */
  websocketUrl(sandbox: SandboxRef, path = "/", port?: number): string {
    return websocketUrlFromHttp(this.invokeUrl(sandbox, path, port));
  }
}
