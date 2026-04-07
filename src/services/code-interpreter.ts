import { z } from "zod";
import { Leap0Error } from "@/core/errors.js";
import { normalize } from "@/core/normalize.js";
import type {
  CodeContext,
  CodeExecutionResult,
  CodeLanguage,
  RequestOptions,
  SandboxRef,
  StreamEvent,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sandboxBaseUrl, sandboxIdOf } from "@/core/utils.js";
import { StreamEventType } from "@/models/index.js";
import {
  codeContextSchema,
  codeExecutionResultSchema,
  streamEventWireSchema,
} from "@/models/code-interpreter.js";

/**
 * Talks to the sandbox-hosted code interpreter service.
 *
 * @throws {Leap0Error} If API calls, stream decoding, or response validation fail.
 */
export class CodeInterpreterClient {
  constructor(private readonly transport: Leap0Transport) {}

  private requestPath(sandbox: SandboxRef, path: string): string {
    return `${sandboxBaseUrl(sandboxIdOf(sandbox), this.transport.sandboxDomain)}${path}`;
  }

  private async fetchJson<T>(
    sandbox: SandboxRef,
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<T> {
    return (await this.transport.requestJsonUrl<T>(
      this.requestPath(sandbox, path),
      init,
      options,
    ))!;
  }

  /**
   * Returns whether the code interpreter service is healthy.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns Whether the code interpreter reports a healthy status.
   */
  async health(sandbox: SandboxRef, options: RequestOptions = {}): Promise<boolean> {
    const data = await this.fetchJson<Record<string, unknown>>(
      sandbox,
      "/healthz",
      { method: "GET" },
      options,
    );
    return data?.status === "ok";
  }
  /**
   * Creates a reusable interpreter context.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param language Interpreter language for the context.
   * @param cwd Optional working directory.
   * @param options Optional request settings such as timeout and query params.
   * @returns The created interpreter context.
   */
  async createContext(
    sandbox: SandboxRef,
    language: CodeLanguage = "python" as CodeLanguage,
    cwd?: string,
    options: RequestOptions = {},
  ): Promise<CodeContext> {
    const payload: Record<string, unknown> = { language };
    if (cwd !== undefined) payload.cwd = cwd;
    return normalize(
      codeContextSchema,
      await this.fetchJson(
        sandbox,
        "/contexts",
        { method: "POST", body: jsonBody(payload) },
        options,
      ),
    );
  }
  /**
   * Lists active interpreter contexts.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The active interpreter contexts.
   */
  async listContexts(sandbox: SandboxRef, options: RequestOptions = {}): Promise<CodeContext[]> {
    return (
      normalize(
        z.object({ items: z.array(codeContextSchema).optional() }),
        await this.fetchJson(sandbox, "/contexts", { method: "GET" }, options),
      ).items ?? []
    );
  }
  /**
   * Fetches a single interpreter context by ID.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param contextId Interpreter context ID.
   * @param options Optional request settings such as timeout and query params.
   * @returns The requested interpreter context.
   */
  async getContext(
    sandbox: SandboxRef,
    contextId: string,
    options: RequestOptions = {},
  ): Promise<CodeContext> {
    return normalize(
      codeContextSchema,
      await this.fetchJson(
        sandbox,
        `/contexts/${encodeURIComponent(contextId)}`,
        { method: "GET" },
        options,
      ),
    );
  }
  /**
   * Deletes an interpreter context by ID.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param contextId Interpreter context ID.
   * @param options Optional request settings such as timeout and query params.
   */
  async deleteContext(
    sandbox: SandboxRef,
    contextId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.fetchJson(
      sandbox,
      `/contexts/${encodeURIComponent(contextId)}`,
      { method: "DELETE" },
      options,
    );
  }
  /**
   * Executes code and waits for the final result.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Execution parameters.
   * @param params.code Source code to execute.
   * @param params.language Optional interpreter language.
   * @param params.contextId Optional existing context ID to reuse.
   * @param params.envVars Optional environment variables for execution.
   * @param params.timeoutMs Optional execution timeout in milliseconds.
   * @param options Optional request settings such as timeout and query params.
   * @returns The completed execution result.
   *
   * @example
   * ```ts
   * const result = await sandbox.codeInterpreter.execute({
   *   language: "python",
   *   code: "print('hello')",
   * });
   * ```
   */
  async execute(
    sandbox: SandboxRef,
    params: {
      code: string;
      language?: CodeLanguage;
      contextId?: string;
      envVars?: Record<string, string>;
      timeoutMs?: number;
    },
    options: RequestOptions = {},
  ): Promise<CodeExecutionResult> {
    const payload: Record<string, unknown> = {
      code: params.code,
      language: params.language ?? "python",
    };
    if (params.contextId !== undefined) payload.context_id = params.contextId;
    if (params.envVars !== undefined) payload.env_vars = params.envVars;
    if (params.timeoutMs !== undefined) payload.timeout_ms = params.timeoutMs;
    return normalize(
      codeExecutionResultSchema,
      await this.fetchJson(
        sandbox,
        "/execute",
        { method: "POST", body: jsonBody(payload) },
        options,
      ),
    );
  }

  private static readonly WIRE_TYPE_MAP: Record<number, StreamEvent["type"]> = {
    0: StreamEventType.STDOUT,
    1: StreamEventType.STDERR,
    2: StreamEventType.EXIT,
    3: StreamEventType.ERROR,
  };

  private static mapWireType(type: number | StreamEvent["type"]): StreamEvent["type"] {
    if (typeof type === "string") {
      return type;
    }
    const mappedType = CodeInterpreterClient.WIRE_TYPE_MAP[type];
    if (!mappedType) {
      throw new Leap0Error(`Unknown stream event type: ${type}`);
    }
    return mappedType;
  }

  /**
   * Streams code execution events until the interpreter exits.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Stream execution parameters.
   * @param params.code Source code to execute.
   * @param params.language Optional interpreter language.
   * @param params.contextId Optional existing context ID to reuse.
   * @param params.timeoutMs Optional execution timeout in milliseconds.
   * @param options Optional request settings such as timeout and query params.
   * @yields Streamed execution events.
   * @throws {Leap0Error} If the stream returns malformed events or reports an execution error.
   *
   * @example
   * ```ts
   * for await (const event of sandbox.codeInterpreter.executeStream({
   *   language: "python",
   *   code: "print('hello')",
   * })) {
   *   console.log(event);
   * }
   * ```
   */
  async *executeStream(
    sandbox: SandboxRef,
    params: {
      code: string;
      language?: CodeLanguage;
      contextId?: string;
      timeoutMs?: number;
    },
    options: RequestOptions = {},
  ): AsyncIterable<StreamEvent> {
    const payload: Record<string, unknown> = {
      code: params.code,
      language: params.language ?? "python",
    };
    if (params.contextId !== undefined) payload.context_id = params.contextId;
    if (params.timeoutMs !== undefined) payload.timeout_ms = params.timeoutMs;
    for await (const event of this.transport.streamJsonUrl(
      this.requestPath(sandbox, "/execute/async"),
      { method: "POST", body: jsonBody(payload) },
      options,
    )) {
      if (!event || typeof event !== "object") {
        throw new Leap0Error("Malformed code execution stream event");
      }
      const record = event as Record<string, unknown>;
      if (record.envelope === "error") {
        throw new Leap0Error(typeof record.message === "string" ? record.message : "Stream error");
      }
      const wire = streamEventWireSchema.parse(event);
      const mappedType = CodeInterpreterClient.mapWireType(wire.type);
      const streamEvent: StreamEvent = { type: mappedType };
      if (wire.data !== undefined) streamEvent.data = wire.data;
      if (wire.code !== undefined) streamEvent.code = wire.code;
      yield streamEvent;
    }
  }
}
