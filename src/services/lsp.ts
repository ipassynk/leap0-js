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

  private normalizeDidOpenArgs(
    textOrOptions?: string | RequestOptions,
    versionOrOptions?: number | RequestOptions,
    options?: RequestOptions,
  ): { text: string | undefined; version: number; options: RequestOptions | undefined } {
    if (textOrOptions && typeof textOrOptions === "object") {
      return { text: undefined, version: 1, options: textOrOptions };
    }
    if (versionOrOptions && typeof versionOrOptions === "object") {
      return { text: textOrOptions, version: 1, options: versionOrOptions };
    }
    return { text: textOrOptions, version: versionOrOptions ?? 1, options };
  }

  /**
   * Starts a language server for a project path inside the sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param options Optional request settings such as timeout and query params.
   * @returns The language server response payload.
   */
  async start(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    options?: RequestOptions,
  ): Promise<LspResponse> {
    return await this.json(
      sandbox,
      "start",
      { language_id: languageId, path_to_project: pathToProject },
      options,
    );
  }
  /**
   * Stops a previously started language server.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param options Optional request settings such as timeout and query params.
   * @returns The language server response payload.
   */
  async stop(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    options?: RequestOptions,
  ): Promise<LspResponse> {
    return await this.json(
      sandbox,
      "stop",
      { language_id: languageId, path_to_project: pathToProject },
      options,
    );
  }
  /**
   * Opens a document in the language server.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param uri File URI to open.
   * @param textOrOptions Optional in-memory document text, or request options when opening from disk.
   * @param versionOrOptions Optional document version, or request options when no explicit version is needed.
   * @param options Optional request options.
   *
   * @example
   * ```ts
   * await sandbox.lsp.didOpen(
   *   "typescript",
   *   "/workspace/app",
   *   "file:///workspace/app/src/index.ts",
   *   "const x = 1;",
   *   1,
   * );
   * ```
   */
  async didOpen(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    uri: string,
    textOrOptions?: string | RequestOptions,
    versionOrOptions?: number | RequestOptions,
    options?: RequestOptions,
  ): Promise<void> {
    const {
      text,
      version,
      options: normalizedOptions,
    } = this.normalizeDidOpenArgs(textOrOptions, versionOrOptions, options);
    const payload: Record<string, unknown> = {
      language_id: languageId,
      path_to_project: pathToProject,
      uri,
      version,
    };
    if (text !== undefined) payload.text = text;
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/lsp/did-open`,
      { method: "POST", body: jsonBody(payload) },
      normalizedOptions,
    );
  }
  /**
   * Opens a document by filesystem path instead of a file URI.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param path Filesystem path to open.
   * @param textOrOptions Optional in-memory document text, or request options when opening from disk.
   * @param versionOrOptions Optional document version, or request options when no explicit version is needed.
   * @param options Optional request options.
   */
  async didOpenPath(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    path: string,
    textOrOptions?: string | RequestOptions,
    versionOrOptions?: number | RequestOptions,
    options?: RequestOptions,
  ): Promise<void> {
    await this.didOpen(
      sandbox,
      languageId,
      pathToProject,
      toFileUri(path),
      textOrOptions,
      versionOrOptions,
      options,
    );
  }
  /**
   * Closes a previously opened document.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param uri File URI to close.
   * @param options Optional request settings such as timeout and query params.
   */
  async didClose(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    uri: string,
    options?: RequestOptions,
  ): Promise<void> {
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/lsp/did-close`,
      {
        method: "POST",
        body: jsonBody({ language_id: languageId, path_to_project: pathToProject, uri }),
      },
      options,
    );
  }
  /**
   * Closes a document by filesystem path instead of a file URI.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param path Filesystem path to close.
   * @param options Optional request settings such as timeout and query params.
   */
  async didClosePath(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    path: string,
    options?: RequestOptions,
  ): Promise<void> {
    await this.didClose(sandbox, languageId, pathToProject, toFileUri(path), options);
  }
  /**
   * Requests completion items at a line/character position.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param uri File URI to inspect.
   * @param line Zero-based line number.
   * @param character Zero-based character offset.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async completions(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    uri: string,
    line: number,
    character: number,
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.json(
      sandbox,
      "completions",
      {
        language_id: languageId,
        path_to_project: pathToProject,
        uri,
        position: { line, character },
      },
      options,
    );
  }
  /**
   * Requests completion items for a filesystem path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param path Filesystem path to inspect.
   * @param line Zero-based line number.
   * @param character Zero-based character offset.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async completionsPath(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    path: string,
    line: number,
    character: number,
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.completions(
      sandbox,
      languageId,
      pathToProject,
      toFileUri(path),
      line,
      character,
      options,
    );
  }
  /**
   * Returns document symbols for an open document.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param uri File URI to inspect.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async documentSymbols(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    uri: string,
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.json(
      sandbox,
      "document-symbols",
      { language_id: languageId, path_to_project: pathToProject, uri },
      options,
    );
  }
  /**
   * Returns document symbols for a filesystem path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param languageId Language server identifier.
   * @param pathToProject Project path inside the sandbox.
   * @param path Filesystem path to inspect.
   * @param options Optional request settings such as timeout and query params.
   * @returns The raw JSON-RPC response from the language server.
   */
  async documentSymbolsPath(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    path: string,
    options?: RequestOptions,
  ): Promise<LspJsonRpcResponse> {
    return await this.documentSymbols(sandbox, languageId, pathToProject, toFileUri(path), options);
  }
}
