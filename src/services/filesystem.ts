import { z } from "zod";
import { normalize } from "@/core/normalize.js";
import type {
  EditFileResult,
  EditFilesResult,
  FileEdit,
  FileInfo,
  LsResult,
  RequestOptions,
  SandboxRef,
  SearchMatch,
  TreeResult,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import {
  editFileResultSchema,
  editFilesResultSchema,
  fileInfoSchema,
  lsResultSchema,
  searchMatchSchema,
  setPermissionsParamsSchema,
  treeResultSchema,
} from "@/models/filesystem.js";
import { sandboxIdOf } from "@/core/utils.js";

type JsonObject = Record<string, unknown>;

function assertReadFileParams(params: {
  offset?: number;
  limit?: number;
  head?: number;
  tail?: number;
}): void {
  if (params.head !== undefined && params.tail !== undefined) {
    throw new Error("read-file head and tail are mutually exclusive");
  }
}

function compact(obj: JsonObject): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Performs filesystem operations inside a sandbox.
 *
 * @throws {Leap0Error} If API calls or response validation fail.
 */
export class FilesystemClient {
  constructor(private readonly transport: Leap0Transport) {}

  private fsPath(sandbox: SandboxRef, endpoint: string): string {
    return `/v1/sandbox/${sandboxIdOf(sandbox)}/filesystem/${endpoint}`;
  }

  /**
   * Lists directory contents, optionally recursively.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Directory path to list.
   * @param params Listing options.
   * @param options Optional request settings such as timeout and query params.
   * @returns The directory listing result.
   */
  async ls(
    sandbox: SandboxRef,
    path: string,
    params: { recursive?: boolean; exclude?: string[] } = {},
    options: RequestOptions = {},
  ): Promise<LsResult> {
    const data = await this.transport.requestJson<LsResult>(
      this.fsPath(sandbox, "ls"),
      {
        method: "POST",
        body: jsonBody(compact({ path, recursive: params.recursive, exclude: params.exclude })),
      },
      options,
    );
    return normalize(lsResultSchema, data);
  }

  /**
   * Fetches metadata for a path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Filesystem path to stat.
   * @param options Optional request settings such as timeout and query params.
   * @returns The path metadata.
   */
  async stat(sandbox: SandboxRef, path: string, options: RequestOptions = {}): Promise<FileInfo> {
    const data = await this.transport.requestJson<FileInfo>(
      this.fsPath(sandbox, "stat"),
      { method: "POST", body: jsonBody({ path }) },
      options,
    );
    return normalize(fileInfoSchema, data);
  }

  /**
   * Creates a directory. Set `recursive` to create parent directories.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Directory path to create.
   * @param params Directory creation options.
   * @param options Optional request settings such as timeout and query params.
   */
  async mkdir(
    sandbox: SandboxRef,
    path: string,
    params: { recursive?: boolean; permissions?: string } = {},
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      this.fsPath(sandbox, "mkdir"),
      {
        method: "POST",
        body: jsonBody(
          compact({ path, recursive: params.recursive, permissions: params.permissions }),
        ),
      },
      options,
    );
  }

  /**
   * Writes raw bytes to a single file path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File path to write.
   * @param content File bytes to write.
   * @param params File write options.
   * @param options Optional request settings such as timeout and query params.
   */
  async writeBytes(
    sandbox: SandboxRef,
    path: string,
    content: Uint8Array,
    params: { permissions?: string } = {},
    options: RequestOptions = {},
  ): Promise<void> {
    const query: Record<string, string> = { path };
    if (params.permissions) query.permissions = params.permissions;
    await this.transport.request(
      this.fsPath(sandbox, "write-file"),
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: content as BodyInit,
      },
      { ...options, query },
    );
  }

  /**
   * Writes UTF-8 text to a single file path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File path to write.
   * @param content UTF-8 text content to write.
   * @param params File write options.
   * @param options Optional request settings such as timeout and query params.
   */
  async writeFile(
    sandbox: SandboxRef,
    path: string,
    content: string,
    params: { permissions?: string } = {},
    options: RequestOptions = {},
  ): Promise<void> {
    await this.writeBytes(sandbox, path, new TextEncoder().encode(content), params, options);
  }

  /**
   * Writes multiple files in a single request using multipart upload.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param files Files keyed by destination path.
   * @param options Optional request settings such as timeout and query params.
   */
  async writeFilesBytes(
    sandbox: SandboxRef,
    files: Record<string, Uint8Array>,
    options: RequestOptions = {},
  ): Promise<void> {
    const form = new FormData();
    for (const [filePath, data] of Object.entries(files)) {
      form.append(filePath, new Blob([data as BlobPart]));
    }
    await this.transport.request(
      this.fsPath(sandbox, "write-files"),
      { method: "POST", body: form },
      options,
    );
  }

  /**
   * Writes multiple UTF-8 text files in a single request.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param files Files keyed by destination path.
   * @param options Optional request settings such as timeout and query params.
   */
  async writeFiles(
    sandbox: SandboxRef,
    files: Record<string, string>,
    options: RequestOptions = {},
  ): Promise<void> {
    const bytesFiles: Record<string, Uint8Array> = {};
    const encoder = new TextEncoder();
    for (const [filePath, content] of Object.entries(files)) {
      bytesFiles[filePath] = encoder.encode(content);
    }
    await this.writeFilesBytes(sandbox, bytesFiles, options);
  }

  /**
   * Reads a single file and returns its raw bytes.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File path to read.
   * @param params Read options.
   * @param options Optional request settings such as timeout and query params.
   * @returns The file contents as bytes.
   * @throws {Error} If both `head` and `tail` are provided.
   * @throws {Leap0Error} If the read request fails.
   */
  async readBytes(
    sandbox: SandboxRef,
    path: string,
    params: { offset?: number; limit?: number; head?: number; tail?: number } = {},
    options: RequestOptions = {},
  ): Promise<Uint8Array> {
    assertReadFileParams(params);
    return await this.transport.requestBytes(
      this.fsPath(sandbox, "read-file"),
      { method: "POST", body: jsonBody(compact({ path, ...params })) },
      options,
    );
  }

  /**
   * Reads a single file and returns its content decoded as text.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File path to read.
   * @param params Read options.
   * @param options Optional request settings such as timeout and query params.
   * @returns The file contents decoded as text.
   * @throws {Error} If both `head` and `tail` are provided.
   * @throws {Leap0Error} If the read request fails.
   *
   * @example
   * ```ts
   * const readme = await sandbox.filesystem.readFile("/workspace/README.md");
   * ```
   */
  async readFile(
    sandbox: SandboxRef,
    path: string,
    params: { offset?: number; limit?: number; head?: number; tail?: number } = {},
    options: RequestOptions = {},
  ): Promise<string> {
    assertReadFileParams(params);
    return await this.transport.requestText(
      this.fsPath(sandbox, "read-file"),
      { method: "POST", body: jsonBody(compact({ path, ...params })) },
      options,
    );
  }

  /**
   * Reads multiple files and returns raw bytes keyed by path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param paths File paths to read.
   * @param options Optional request settings such as timeout and query params.
   * @returns File contents keyed by path.
   * @throws {Error} If the multipart response is malformed.
   * @throws {Leap0Error} If the read request fails.
   */
  async readFilesBytes(
    sandbox: SandboxRef,
    paths: string[],
    options: RequestOptions = {},
  ): Promise<Record<string, Uint8Array>> {
    const response = await this.transport.request(
      this.fsPath(sandbox, "read-files"),
      { method: "POST", body: jsonBody({ paths }) },
      options,
    );
    // Server returns multipart/form-data, parse it
    const formData = await response.formData();
    const result: Record<string, Uint8Array> = {};
    for (const [name, value] of formData.entries()) {
      if (!(value instanceof Blob)) {
        const valueType = typeof value;
        throw new Error(
          `Failed to parse /read-files response: expected Blob/File for entry "${name}", received ${valueType}`,
        );
      }
      result[name] = new Uint8Array(await value.arrayBuffer());
    }
    return result;
  }

  /**
   * Reads multiple files and returns decoded text keyed by path.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param paths File paths to read.
   * @param options Optional request settings such as timeout and query params.
   * @returns Decoded file contents keyed by path.
   */
  async readFiles(
    sandbox: SandboxRef,
    paths: string[],
    options: RequestOptions = {},
  ): Promise<Record<string, string>> {
    const bytesResult = await this.readFilesBytes(sandbox, paths, options);
    const decoder = new TextDecoder();
    const result: Record<string, string> = {};
    for (const [filePath, bytes] of Object.entries(bytesResult)) {
      result[filePath] = decoder.decode(bytes);
    }
    return result;
  }

  /**
   * Deletes a file or directory. Set `recursive` for non-empty directories.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File or directory path to delete.
   * @param recursive Whether to delete directories recursively.
   * @param options Optional request settings such as timeout and query params.
   */
  async delete(
    sandbox: SandboxRef,
    path: string,
    recursive = false,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      this.fsPath(sandbox, "delete"),
      { method: "POST", body: jsonBody({ path, recursive }) },
      options,
    );
  }

  /**
   * Sets file mode and optionally changes owner and group.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File or directory path to update.
   * @param params Permission update parameters.
   * @param options Optional request settings such as timeout and query params.
   * @throws {Leap0Error} If params are invalid or the request fails.
   */
  async setPermissions(
    sandbox: SandboxRef,
    path: string,
    params: { mode?: string; owner?: string; group?: string } = {},
    options: RequestOptions = {},
  ): Promise<void> {
    const parsed = setPermissionsParamsSchema.parse(params);
    await this.transport.request(
      this.fsPath(sandbox, "set-permissions"),
      {
        method: "POST",
        body: jsonBody(
          compact({ path, mode: parsed.mode, owner: parsed.owner, group: parsed.group }),
        ),
      },
      options,
    );
  }

  /**
   * Finds file paths matching a glob pattern.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Base directory to search.
   * @param pattern Glob pattern to match.
   * @param params Glob options.
   * @param options Optional request settings such as timeout and query params.
   * @returns Matching file paths.
   */
  async glob(
    sandbox: SandboxRef,
    path: string,
    pattern: string,
    params: { exclude?: string[] } = {},
    options: RequestOptions = {},
  ): Promise<string[]> {
    const data = await this.transport.requestJson(
      this.fsPath(sandbox, "glob"),
      { method: "POST", body: jsonBody(compact({ path, pattern, exclude: params.exclude })) },
      options,
    );
    return z.object({ items: z.array(z.string()) }).parse(data).items;
  }

  /**
   * Searches for a text pattern across files in a directory.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Base directory to search.
   * @param pattern Text or regex pattern to search for.
   * @param params Grep options.
   * @param options Optional request settings such as timeout and query params.
   * @returns Matching search results.
   */
  async grep(
    sandbox: SandboxRef,
    path: string,
    pattern: string,
    params: { include?: string; exclude?: string[] } = {},
    options: RequestOptions = {},
  ): Promise<SearchMatch[]> {
    const data = await this.transport.requestJson<SearchMatch[]>(
      this.fsPath(sandbox, "grep"),
      {
        method: "POST",
        body: jsonBody(
          compact({ path, pattern, include: params.include, exclude: params.exclude }),
        ),
      },
      options,
    );
    return normalize(z.object({ items: z.array(searchMatchSchema) }), data).items;
  }

  /**
   * Applies one or more find-and-replace edits to a single file.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File path to edit.
   * @param edits Edit operations to apply.
   * @param options Optional request settings such as timeout and query params.
   * @returns The single-file edit result.
   */
  async editFile(
    sandbox: SandboxRef,
    path: string,
    edits: FileEdit[],
    options: RequestOptions = {},
  ): Promise<EditFileResult> {
    const data = await this.transport.requestJson<EditFileResult>(
      this.fsPath(sandbox, "edit-file"),
      { method: "POST", body: jsonBody({ path, edits }) },
      options,
    );
    return normalize(editFileResultSchema, data);
  }

  /**
   * Replaces text across multiple files at once.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Multi-file edit parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The multi-file edit result.
   */
  async editFiles(
    sandbox: SandboxRef,
    params: { paths: string[]; find: string; replace?: string },
    options: RequestOptions = {},
  ): Promise<EditFilesResult> {
    const payload = {
      files: params.paths,
      find: params.find,
      ...(params.replace == null ? {} : { replace: params.replace }),
    };
    const data = await this.transport.requestJson<EditFilesResult>(
      this.fsPath(sandbox, "edit-files"),
      {
        method: "POST",
        body: jsonBody(payload),
      },
      options,
    );
    return normalize(editFilesResultSchema, data);
  }

  /**
   * Moves or renames a file or directory.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param srcPath Source path.
   * @param dstPath Destination path.
   * @param overwrite Whether to overwrite an existing destination.
   * @param options Optional request settings such as timeout and query params.
   */
  async move(
    sandbox: SandboxRef,
    srcPath: string,
    dstPath: string,
    overwrite = false,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      this.fsPath(sandbox, "move"),
      { method: "POST", body: jsonBody({ src_path: srcPath, dst_path: dstPath, overwrite }) },
      options,
    );
  }

  /**
   * Copies a file or directory.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param srcPath Source path.
   * @param dstPath Destination path.
   * @param params Copy options.
   * @param options Optional request settings such as timeout and query params.
   */
  async copy(
    sandbox: SandboxRef,
    srcPath: string,
    dstPath: string,
    params: { recursive?: boolean; overwrite?: boolean } = {},
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      this.fsPath(sandbox, "copy"),
      {
        method: "POST",
        body: jsonBody(
          compact({
            src_path: srcPath,
            dst_path: dstPath,
            recursive: params.recursive,
            overwrite: params.overwrite,
          }),
        ),
      },
      options,
    );
  }

  /**
   * Checks whether a path exists in the sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path File or directory path to check.
   * @param options Optional request settings such as timeout and query params.
   * @returns Whether the path exists.
   */
  async exists(sandbox: SandboxRef, path: string, options: RequestOptions = {}): Promise<boolean> {
    const data = await this.transport.requestJson(
      this.fsPath(sandbox, "exists"),
      { method: "POST", body: jsonBody({ path }) },
      options,
    );
    return z.object({ exists: z.boolean() }).parse(data).exists;
  }

  /**
   * Gets a recursive directory tree.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param path Root path for the tree.
   * @param params Tree options.
   * @param options Optional request settings such as timeout and query params.
   * @returns The recursive tree result.
   */
  async tree(
    sandbox: SandboxRef,
    path: string,
    params: { maxDepth?: number; exclude?: string[] } = {},
    options: RequestOptions = {},
  ): Promise<TreeResult> {
    const data = await this.transport.requestJson<TreeResult>(
      this.fsPath(sandbox, "tree"),
      {
        method: "POST",
        body: jsonBody(compact({ path, max_depth: params.maxDepth, exclude: params.exclude })),
      },
      options,
    );
    return normalize(treeResultSchema, data);
  }
}
