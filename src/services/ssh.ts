import { normalize } from "@/core/normalize.js";
import type { RequestOptions, SandboxRef, SshAccess, SshValidation } from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sshAccessSchema, sshValidationSchema } from "@/models/ssh.js";
import { sandboxIdOf } from "@/core/utils.js";

/**
 * Manages SSH access credentials for a sandbox.
 *
 * @throws {Leap0Error} If API calls or response validation fail.
 */
export class SshClient {
  constructor(private readonly transport: Leap0Transport) {}

  /**
   * Creates SSH credentials for a sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The generated SSH access payload.
   */
  async createAccess(sandbox: SandboxRef, options: RequestOptions = {}): Promise<SshAccess> {
    const data = await this.transport.requestJson<SshAccess>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/access`,
      { method: "POST" },
      options,
    );
    return normalize(sshAccessSchema, data);
  }

  /**
   * Deletes a specific SSH credential for a sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params SSH credential deletion parameters.
   * @param options Optional request settings such as timeout and query params.
   */
  async deleteAccess(
    sandbox: SandboxRef,
    params: { id: string },
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/${params.id}`,
      { method: "DELETE" },
      options,
    );
  }

  /**
   * Verifies a specific previously issued SSH credential pair.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params SSH credential validation parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The validation result.
   */
  async validateAccess(
    sandbox: SandboxRef,
    params: { id: string; password: string },
    options: RequestOptions = {},
  ): Promise<SshValidation> {
    const data = await this.transport.requestJson<SshValidation>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/${params.id}/validate`,
      { method: "POST", body: jsonBody({ password: params.password }) },
      options,
    );
    return normalize(sshValidationSchema, data);
  }

  /**
   * Rotates a specific SSH credential for a sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params SSH credential rotation parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The newly generated SSH access payload.
   */
  async regenerateAccess(
    sandbox: SandboxRef,
    params: { id: string },
    options: RequestOptions = {},
  ): Promise<SshAccess> {
    const data = await this.transport.requestJson<SshAccess>(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/ssh/${params.id}/regen`,
      { method: "POST" },
      options,
    );
    return normalize(sshAccessSchema, data);
  }
}
