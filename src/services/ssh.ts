import { normalize } from "@/core/normalize.js";
import type { RequestOptions, SandboxRef, SshAccess, SshValidation } from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sshAccessSchema, sshValidationSchema } from "@/models/ssh.js";
import { sandboxIdOf } from "@/core/utils.js";

/** Manages SSH access credentials for a sandbox. */
export class SshClient {
  constructor(private readonly transport: Leap0Transport) {}

  async createAccess(sandbox: SandboxRef, options: RequestOptions = {}): Promise<SshAccess> {
    const data = await this.transport.requestJson<SshAccess>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/access`,
      { method: "POST" },
      options,
    );
    return normalize(sshAccessSchema, data);
  }

  async deleteAccess(sandbox: SandboxRef, options: RequestOptions = {}): Promise<void> {
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/access`,
      { method: "DELETE" },
      options,
    );
  }

  async validateAccess(
    sandbox: SandboxRef,
    accessId: string,
    password: string,
    options: RequestOptions = {},
  ): Promise<SshValidation> {
    const data = await this.transport.requestJson<SshValidation>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/validate`,
      { method: "POST", body: jsonBody({ id: accessId, password }) },
      options,
    );
    return normalize(sshValidationSchema, data);
  }

  async regenerateAccess(sandbox: SandboxRef, options: RequestOptions = {}): Promise<SshAccess> {
    const data = await this.transport.requestJson<SshAccess>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/regen`,
      { method: "POST" },
      options,
    );
    return normalize(sshAccessSchema, data);
  }
}
