import type {
  LspJsonRpcResponse,
  LspResponse,
  RequestOptions,
  SandboxRef,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sandboxIdOf, toFileUri } from "@/core/utils.js";

/** Starts and interacts with language servers inside a sandbox. */
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
  async didOpen(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    uri: string,
    text?: string,
    version = 1,
    options?: RequestOptions,
  ): Promise<void> {
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
      options,
    );
  }
  async didOpenPath(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    path: string,
    text?: string,
    version = 1,
    options?: RequestOptions,
  ): Promise<void> {
    await this.didOpen(sandbox, languageId, pathToProject, toFileUri(path), text, version, options);
  }
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
  async didClosePath(
    sandbox: SandboxRef,
    languageId: string,
    pathToProject: string,
    path: string,
    options?: RequestOptions,
  ): Promise<void> {
    await this.didClose(sandbox, languageId, pathToProject, toFileUri(path), options);
  }
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
