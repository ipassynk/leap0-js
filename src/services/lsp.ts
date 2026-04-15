import type {
  LspJsonRpcResponse,
  LspResponse,
  RequestOptions,
  SandboxRef,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sandboxIdOf, toFileUri } from "@/core/utils.js";

/**
 * Starts and interacts with language servers inside a sandbox.
 *
 * @throws {Leap0Error} If an API call fails.
 * @throws {Error} If the service returns an unexpected empty response.
 */
export class LspClient {
  constructor(private readonly transport: Leap0Transport) {}

  private async json<T>(
    sandbox: SandboxRef,
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const path = `/v1/sandbox/${sandboxIdOf(sandbox)}/lsp/${endpoint}`;
    const result = await this.transport.requestJson<T>(
      path,
      { method: "POST", body: jsonBody(body) },
      options,
    );
    if (result == null) {
      throw new Error(`Empty response from ${path}`);
    }
    return result;
  }

  /**
   * Starts a language server for a project path inside the sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Language server start parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The language server response payload.
   */
  async start(
    sandbox: SandboxRef,
    params: { languageId: string; pathToProject: string },
    options?: RequestOptions,
  ): Promise<LspResponse> {
    return await this.json(
      sandbox,
      "start",
      { language_id: params.languageId, path_to_project: params.pathToProject },
      options,
    );
  }
  /**
   * Stops a previously started language server.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Language server stop parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The language server response payload.
   */
  async stop(
    sandbox: SandboxRef,
    params: { languageId: string; pathToProject: string },
    options?: RequestOptions,
  ): Promise<LspResponse> {
    return await this.json(
      sandbox,
      "stop",
      { language_id: params.languageId, path_to_project: params.pathToProject },
      options,
    );
  }
  /**
   * Opens a document in the language server.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Document open parameters.
   * @param options Optional request options.
   *
   * @example
   * ```ts
   * await sandbox.lsp.didOpen({
   *   languageId: "typescript",
   *   pathToProject: "/workspace/app",
   *   uri: "file:///workspace/app/src/index.ts",
   *   text: "const x = 1;",
   *   version: 1,
   * });
   * ```
   */
  async didOpen(
    sandbox: SandboxRef,
    params: {
      languageId: string;
      pathToProject: string;
      uri: string;
      text?: string;
      version?: number;
    },
    options?: RequestOptions,
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      language_id: params.languageId,
      path_to_project: params.pathToProject,
      uri: params.uri,
      version: params.version ?? 1,
    };
    if (params.text !== undefined) payload.text = params.text;
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/lsp/did-open`,
      { method: "POST", body: jsonBody(payload) },
      options,
    );
  }
  /**
   * Opens a document by filesystem path instead of a file URI.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Document open parameters using a filesystem path.
   * @param options Optional request options.
   */
  async didOpenPath(
    sandbox: SandboxRef,
    params: {
      languageId: string;
      pathToProject: string;
      path: string;
      text?: string;
      version?: number;
    },
    options?: RequestOptions,
  ): Promise<void> {
    await this.didOpen(
      sandbox,
      {
        languageId: params.languageId,
        pathToProject: params.pathToProject,
        uri: toFileUri(params.path),
        text: params.text,
        version: params.version,
      },
      options,
    );
  }
  /**
   * Closes a previously opened document.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Document close parameters.
   * @param options Optional request settings such as timeout and query params.
   */
  async didClose(
    sandbox: SandboxRef,
    params: { languageId: string; pathToProject: string; uri: string },
    options?: RequestOptions,
  ): Promise<void> {
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/lsp/did-close`,
      {
        method: "POST",
        body: jsonBody({
          language_id: params.languageId,
          path_to_project: params.pathToProject,
          uri: params.uri,
        }),
      },
      options,
    );
  }
  /**
   * Closes a document by filesystem path instead of a file URI.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Document close parameters using a filesystem path.
   * @param options Optional request settings such as timeout and query params.
   */
  async didClosePath(
    sandbox: SandboxRef,
    params: { languageId: string; pathToProject: string; path: string },
    options?: RequestOptions,
  ): Promise<void> {
    await this.didClose(
      sandbox,
      {
        languageId: params.languageId,
        pathToProject: params.pathToProject,
        uri: toFileUri(params.path),
      },
      options,
    );
  }
  /**
   * Requests completion items at a line/character position.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Completion request parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async completions(
    sandbox: SandboxRef,
    params: {
      languageId: string;
      pathToProject: string;
      uri: string;
      line: number;
      character: number;
    },
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.json(
      sandbox,
      "completions",
      {
        language_id: params.languageId,
        path_to_project: params.pathToProject,
        uri: params.uri,
        position: { line: params.line, character: params.character },
      },
      options,
    );
  }
  /**
   * Requests completion items for a filesystem path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Completion request parameters using a filesystem path.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async completionsPath(
    sandbox: SandboxRef,
    params: {
      languageId: string;
      pathToProject: string;
      path: string;
      line: number;
      character: number;
    },
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.completions(
      sandbox,
      {
        languageId: params.languageId,
        pathToProject: params.pathToProject,
        uri: toFileUri(params.path),
        line: params.line,
        character: params.character,
      },
      options,
    );
  }
  /**
   * Returns document symbols for an open document.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Document symbol request parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async documentSymbols(
    sandbox: SandboxRef,
    params: { languageId: string; pathToProject: string; uri: string },
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.json(
      sandbox,
      "document-symbols",
      {
        language_id: params.languageId,
        path_to_project: params.pathToProject,
        uri: params.uri,
      },
      options,
    );
  }
  /**
   * Returns document symbols for a filesystem path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Document symbol request parameters using a filesystem path.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async documentSymbolsPath(
    sandbox: SandboxRef,
    params: { languageId: string; pathToProject: string; path: string },
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.documentSymbols(
      sandbox,
      {
        languageId: params.languageId,
        pathToProject: params.pathToProject,
        uri: toFileUri(params.path),
      },
      options,
    );
  }
}
