import { normalize } from "@/core/normalize.js";
import type { ProcessResult, RequestOptions, SandboxRef } from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { processResultSchema } from "@/models/process.js";
import { sandboxIdOf } from "@/core/utils.js";

/** Executes one-shot commands inside a sandbox. */
export class ProcessClient {
  constructor(private readonly transport: Leap0Transport) {}

  /** Executes a command and returns stdout, stderr, and exit code output. */
  async execute(
    sandbox: SandboxRef,
    params: { command: string; cwd?: string; timeout?: number },
    options: RequestOptions = {},
  ): Promise<ProcessResult> {
    const data = await this.transport.requestJson<ProcessResult>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/process/execute`,
      { method: "POST", body: jsonBody(params) },
      options,
    );
    return normalize(processResultSchema, data);
  }
}
