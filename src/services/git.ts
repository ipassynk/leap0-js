import { normalize } from "@/core/normalize.js";
import type { GitCommitResult, GitResult, RequestOptions, SandboxRef } from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { gitCommitResultSchema, gitResultSchema } from "@/models/git.js";
import { sandboxIdOf } from "@/core/utils.js";

type JsonObject = Record<string, unknown>;

function compact(obj: JsonObject): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Runs git operations inside a sandbox repository.
 *
 * @throws {Leap0Error} If an API call fails.
 * @throws {Error} If the service returns an unexpected empty response.
 */
export class GitClient {
  constructor(private readonly transport: Leap0Transport) {}

  private async json<T>(
    sandbox: SandboxRef,
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const path = `/v1/sandbox/${sandboxIdOf(sandbox)}/git/${endpoint}`;
    const result = await this.transport.requestJson<T>(
      path,
      { method: "POST", body: jsonBody(body) },
      options,
    );
    if (result === undefined) {
      throw new Error(`Empty response from ${path} for sandbox ${sandboxIdOf(sandbox)}`);
    }
    return result;
  }

  /**
   * Clones a git repository into the sandbox filesystem.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params.url Repository URL to clone.
   * @param params.path Destination path inside the sandbox.
   * @param options Optional request settings such as timeout and query params.
   * @returns The git command result.
   *
   * @example
   * ```ts
   * await sandbox.git.clone({
   *   url: "https://github.com/example/repo.git",
   *   path: "/workspace/repo",
   *   branch: "main",
   * });
   * ```
   */
  async clone(
    sandbox: SandboxRef,
    params: {
      url: string;
      path: string;
      branch?: string;
      commitId?: string;
      depth?: number;
      username?: string;
      password?: string;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "clone",
        compact({
          url: params.url,
          path: params.path,
          branch: params.branch,
          commit_id: params.commitId,
          depth: params.depth,
          username: params.username,
          password: params.password,
        }),
        options,
      ),
    );
  }

  /** Returns repository status information for a sandbox path. */
  async status(sandbox: SandboxRef, path: string, options?: RequestOptions): Promise<GitResult> {
    return normalize(gitResultSchema, await this.json(sandbox, "status", { path }, options));
  }

  /** Lists branches for a repository path. */
  async branches(
    sandbox: SandboxRef,
    params: {
      path: string;
      branchType?: "local" | "remote" | "all";
      contains?: string;
      notContains?: string;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "branches",
        compact({
          path: params.path,
          branch_type: params.branchType ?? "local",
          contains: params.contains,
          not_contains: params.notContains,
        }),
        options,
      ),
    );
  }

  /** Returns the unstaged diff for a repository path. */
  async diffUnstaged(
    sandbox: SandboxRef,
    path: string,
    contextLines?: number,
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "diff-unstaged",
        compact({ path, context_lines: contextLines }),
        options,
      ),
    );
  }

  /** Returns the staged diff for a repository path. */
  async diffStaged(
    sandbox: SandboxRef,
    path: string,
    contextLines?: number,
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "diff-staged",
        compact({ path, context_lines: contextLines }),
        options,
      ),
    );
  }

  /** Returns a diff against a target revision, branch, or commit. */
  async diff(
    sandbox: SandboxRef,
    path: string,
    target: string,
    contextLines?: number,
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "diff",
        compact({ path, target, context_lines: contextLines }),
        options,
      ),
    );
  }

  /** Resets staged and unstaged changes for a repository path. */
  async reset(sandbox: SandboxRef, path: string, options?: RequestOptions): Promise<GitResult> {
    return normalize(gitResultSchema, await this.json(sandbox, "reset", { path }, options));
  }

  /** Returns commit history for a repository path. */
  async log(
    sandbox: SandboxRef,
    params: {
      path: string;
      maxCount?: number;
      startTimestamp?: string;
      endTimestamp?: string;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "log",
        compact({
          path: params.path,
          max_count: params.maxCount,
          start_timestamp: params.startTimestamp,
          end_timestamp: params.endTimestamp,
        }),
        options,
      ),
    );
  }

  /** Shows a revision for a repository path. */
  async show(
    sandbox: SandboxRef,
    path: string,
    revision = "HEAD",
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(sandbox, "show", { path, revision }, options),
    );
  }

  /** Creates a new branch, optionally checking it out immediately. */
  async createBranch(
    sandbox: SandboxRef,
    params: {
      path: string;
      name: string;
      checkout?: boolean;
      baseBranch?: string;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "create-branch",
        compact({
          path: params.path,
          name: params.name,
          checkout: params.checkout,
          base_branch: params.baseBranch,
        }),
        options,
      ),
    );
  }

  /** Checks out an existing branch or creates one on demand. */
  async checkoutBranch(
    sandbox: SandboxRef,
    params: {
      path: string;
      branch: string;
      create?: boolean;
      setUpstream?: boolean;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "checkout-branch",
        compact({
          path: params.path,
          branch: params.branch,
          create: params.create,
          set_upstream: params.setUpstream,
        }),
        options,
      ),
    );
  }

  /** Deletes a branch from the repository. */
  async deleteBranch(
    sandbox: SandboxRef,
    path: string,
    name: string,
    force = false,
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(sandbox, "delete-branch", { path, name, force }, options),
    );
  }

  /** Adds files to the git index. */
  async add(
    sandbox: SandboxRef,
    path: string,
    files: string[],
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(gitResultSchema, await this.json(sandbox, "add", { path, files }, options));
  }

  /**
   * Creates a git commit from staged changes.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params.path Repository path inside the sandbox.
   * @param params.message Commit message.
   * @param params.author Optional author name.
   * @param params.email Optional author email.
   * @param params.allowEmpty Whether to allow empty commits.
   * @param options Optional request settings such as timeout and query params.
   * @returns The commit result, including the created commit ID when available.
   */
  async commit(
    sandbox: SandboxRef,
    params: {
      path: string;
      message: string;
      author?: string;
      email?: string;
      allowEmpty?: boolean;
    },
    options?: RequestOptions,
  ): Promise<GitCommitResult> {
    return normalize(
      gitCommitResultSchema,
      await this.json(
        sandbox,
        "commit",
        compact({
          path: params.path,
          message: params.message,
          author: params.author,
          email: params.email,
          allow_empty: params.allowEmpty,
        }),
        options,
      ),
    );
  }

  /** Pushes local commits to a remote. */
  async push(
    sandbox: SandboxRef,
    params: {
      path: string;
      remote?: string;
      branch?: string;
      setUpstream?: boolean;
      username?: string;
      password?: string;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "push",
        compact({
          path: params.path,
          remote: params.remote,
          branch: params.branch,
          set_upstream: params.setUpstream,
          username: params.username,
          password: params.password,
        }),
        options,
      ),
    );
  }

  /** Pulls remote changes into the local repository. */
  async pull(
    sandbox: SandboxRef,
    params: {
      path: string;
      remote?: string;
      branch?: string;
      rebase?: boolean;
      setUpstream?: boolean;
      username?: string;
      password?: string;
    },
    options?: RequestOptions,
  ): Promise<GitResult> {
    return normalize(
      gitResultSchema,
      await this.json(
        sandbox,
        "pull",
        compact({
          path: params.path,
          remote: params.remote,
          branch: params.branch,
          rebase: params.rebase,
          set_upstream: params.setUpstream,
          username: params.username,
          password: params.password,
        }),
        options,
      ),
    );
  }
}
