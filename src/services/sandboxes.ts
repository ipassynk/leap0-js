import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS } from "@/config/constants.js";
import { Leap0Error } from "@/core/errors.js";
import { normalize } from "@/core/normalize.js";
import {
  createPresignedUrlParamsSchema,
  createSandboxRuntimeParamsSchema,
  listSandboxesParamsSchema,
  listSandboxesResponseSchema,
  presignedUrlSchema,
  sandboxDataSchema,
  toNetworkPolicyWire,
} from "@/models/sandbox.js";
import type {
  CreatePresignedUrlParams,
  CreateSandboxParams,
  ListSandboxesParams,
  ListSandboxesResponse,
  PresignedUrl,
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
   * @returns The created sandbox resource.
   * @throws {Leap0Error} If params are invalid, local OTEL env is missing, or sandbox creation fails.
   *
   * @example
   * ```ts
   * const sandbox = await client.sandboxes.create({
   *   templateName: "base",
   *   timeout: 1800,
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
      memory: normalizedParams.memory,
      timeout: normalizedParams.timeout,
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

  /**
   * Lists sandboxes for the authenticated organization.
   *
   * @param params Optional filter, sort, and pagination parameters.
   * @param options Optional request settings such as timeout and headers.
   * @returns Paginated sandbox summaries.
   */
  async list(
    params: ListSandboxesParams = {},
    options: RequestOptions = {},
  ): Promise<ListSandboxesResponse> {
    return withErrorPrefix("Failed to list sandboxes: ", async () => {
      const parsed = listSandboxesParamsSchema.parse(params);
      const data = await this.transport.requestJson<unknown>(
        "/v1/sandboxes",
        { method: "GET" },
        {
          ...options,
          query: {
            ...options.query,
            state: parsed.state,
            sort: parsed.sort,
            "order-by": parsed.orderBy,
            page: parsed.page,
            "page-size": parsed.pageSize,
          },
        },
      );
      return normalize(listSandboxesResponseSchema, data);
    });
  }

  /**
   * Pauses a running sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The updated sandbox resource.
   */
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

  /**
   * Fetches a sandbox by ID.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The current sandbox resource.
   */
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

  /**
   * Deletes a sandbox by ID.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   */
  async delete(sandbox: SandboxRef, options: RequestOptions = {}): Promise<void> {
    await withErrorPrefix("Failed to delete sandbox: ", () =>
      this.transport.request(`/v1/sandbox/${sandboxIdOf(sandbox)}/`, { method: "DELETE" }, options),
    );
  }

  /**
   * Fetches the resolved home directory for the sandbox user.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The resolved sandbox user home directory.
   */
  async getUserHomeDir(sandbox: SandboxRef, options: RequestOptions = {}): Promise<string> {
    return withErrorPrefix("Failed to get sandbox user home directory: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/system/user-home-dir`,
        { method: "GET" },
        options,
      );
      if (
        typeof data !== "object" ||
        data === null ||
        typeof (data as { user_home_dir?: unknown }).user_home_dir !== "string"
      ) {
        throw new Leap0Error("Sandbox user home directory response missing user_home_dir");
      }
      return (data as { user_home_dir: string }).user_home_dir;
    });
  }

  /**
   * Fetches the configured working directory for the sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The configured sandbox workdir.
   */
  async getWorkdir(sandbox: SandboxRef, options: RequestOptions = {}): Promise<string> {
    return withErrorPrefix("Failed to get sandbox workdir: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/system/workdir`,
        { method: "GET" },
        options,
      );
      if (
        typeof data !== "object" ||
        data === null ||
        typeof (data as { workdir?: unknown }).workdir !== "string"
      ) {
        throw new Leap0Error("Sandbox workdir response missing workdir");
      }
      return (data as { workdir: string }).workdir;
    });
  }

  /**
   * Creates a temporary public URL for a specific sandbox port.
   */
  async createPresignedUrl(
    sandbox: SandboxRef,
    params: CreatePresignedUrlParams,
    options: RequestOptions = {},
  ): Promise<PresignedUrl> {
    const parsed = createPresignedUrlParamsSchema.parse(params);
    return withErrorPrefix("Failed to create presigned URL: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/presigned-url`,
        {
          method: "POST",
          body: jsonBody({
            port: parsed.port,
            expires_in: parsed.expiresIn,
          }),
        },
        options,
      );
      return normalize(presignedUrlSchema, data);
    });
  }

  /**
   * Deletes a previously issued presigned URL.
   */
  async deletePresignedUrl(
    sandbox: SandboxRef,
    id: string,
    options: RequestOptions = {},
  ): Promise<void> {
    const trimmedID = id.trim();
    if (!trimmedID) {
      throw new Leap0Error("id must be a non-empty string");
    }
    await withErrorPrefix("Failed to delete presigned URL: ", () =>
      this.transport.request(
	      `/v1/sandbox/${sandboxIdOf(sandbox)}/presigned-url/${trimmedID}`,
        { method: "DELETE" },
        options,
      ),
    );
  }


  /**
   * Builds the public invoke URL for a sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
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
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Route path to append to the sandbox base URL.
   * @param port Optional forwarded port.
   * @returns The public websocket URL for the sandbox.
   */
  websocketUrl(sandbox: SandboxRef, path = "/", port?: number): string {
    return websocketUrlFromHttp(this.invokeUrl(sandbox, path, port));
  }
}
