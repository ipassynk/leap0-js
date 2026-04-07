import { normalize } from "@/core/normalize.js";
import type { ProcessResult, RequestOptions, SandboxRef } from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { processResultSchema } from "@/models/process.js";
import { sandboxIdOf } from "@/core/utils.js";

const ENV_REF_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

function expandEnv(value: string, env: Record<string, string>): string {
  return value.replace(ENV_REF_RE, (match, bracketed, plain) => {
    const key = bracketed ?? plain;
    return env[key] ?? match;
  });
}

/**
 * Executes one-shot commands inside a sandbox.
 *
 * @throws {Leap0Error} If the process request or response validation fails.
 */
export class ProcessClient {
  constructor(private readonly transport: Leap0Transport) {}

  /**
   * Executes a one-shot command inside the sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Command execution parameters.
   * @param params.command Command line to execute.
   * @param params.cwd Optional working directory.
   * @param params.timeout Optional command timeout in milliseconds.
   * @param params.env Optional local values used to expand `$NAME` and `${NAME}` in string fields.
   * @param options Optional request settings such as timeout and query params.
   * @returns The process exit code and collected stdout/stderr output.
   *
   * @example
   * ```ts
   * const result = await sandbox.process.execute({ command: "node --version" });
   * ```
   */
  async execute(
    sandbox: SandboxRef,
    params: { command: string; cwd?: string; timeout?: number; env?: Record<string, string> },
    options: RequestOptions = {},
  ): Promise<ProcessResult> {
    const env = params.env;
    const payload = {
      command: env ? expandEnv(params.command, env) : params.command,
      cwd: params.cwd && env ? expandEnv(params.cwd, env) : params.cwd,
      timeout: params.timeout,
    };
    const data = await this.transport.requestJson<ProcessResult>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/process/execute`,
      { method: "POST", body: jsonBody(payload) },
      options,
    );
    return normalize(processResultSchema, data);
  }
}
