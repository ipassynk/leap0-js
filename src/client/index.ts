import { resolveConfig } from "@/config/index.js";
import type { Leap0ConfigInput } from "@/models/index.js";
import { initOtel, shutdownOtel } from "@/core/otel.js";
import { Leap0Transport } from "@/core/transport.js";
import {
  CodeInterpreterClient,
  DesktopClient,
  FilesystemClient,
  GitClient,
  LspClient,
  ProcessClient,
  PtyClient,
  SandboxesClient,
  SnapshotsClient,
  SshClient,
  TemplatesClient,
} from "@/services/index.js";

import { Sandbox, SERVICES } from "@/client/sandbox.js";

/** @internal Internal service map used by Sandbox to bind per-sandbox proxies. */
export interface ClientServices {
  filesystem: FilesystemClient;
  git: GitClient;
  process: ProcessClient;
  pty: PtyClient;
  lsp: LspClient;
  ssh: SshClient;
  codeInterpreter: CodeInterpreterClient;
  desktop: DesktopClient;
}

/**
 * Top-level Leap0 SDK client that exposes all service groups.
 *
 * @throws {Leap0Error} If config validation fails during client construction.
 *
 * @example
 * ```ts
 * const client = new Leap0Client({ apiKey: process.env.LEAP0_API_KEY! });
 * const sandbox = await client.sandboxes.create({ templateName: "base" });
 * ```
 */
export class Leap0Client {
  private closed = false;
  private readonly sdkOtelEnabled: boolean;
  private readonly transport: Leap0Transport;

  /** Sandbox lifecycle APIs bound to this client. */
  readonly sandboxes: SandboxesClient<Sandbox>;
  /** Snapshot lifecycle APIs bound to this client. */
  readonly snapshots: SnapshotsClient<Sandbox>;
  /** Template management APIs bound to this client. */
  readonly templates: TemplatesClient;

  /** @internal - used by Sandbox to bind service proxies. */
  readonly [SERVICES]: ClientServices;

  /**
   * Creates a client using explicit config or environment variables.
   *
   * @param config Optional SDK configuration overrides.
   * @throws {Leap0Error} If config validation fails during client construction.
   */
  constructor(config: Leap0ConfigInput = {}) {
    const resolved = resolveConfig(config);
    this.transport = new Leap0Transport(resolved);
    this.sdkOtelEnabled = resolved.sdkOtelEnabled;
    if (resolved.sdkOtelEnabled) {
      initOtel();
    }

    const wrapSandbox = (data: import("@/models/index.js").SandboxData) => new Sandbox(this, data);

    this.sandboxes = new SandboxesClient(this.transport, wrapSandbox);
    this.snapshots = new SnapshotsClient(this.transport, wrapSandbox);
    this.templates = new TemplatesClient(this.transport);

    this[SERVICES] = {
      filesystem: new FilesystemClient(this.transport),
      git: new GitClient(this.transport),
      process: new ProcessClient(this.transport),
      pty: new PtyClient(this.transport),
      lsp: new LspClient(this.transport),
      ssh: new SshClient(this.transport),
      codeInterpreter: new CodeInterpreterClient(this.transport),
      desktop: new DesktopClient(this.transport),
    };
  }

  /**
   * Closes the underlying transport.
   *
   * @throws {Leap0Error} If shutting down the transport fails.
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    let transportError: unknown;
    try {
      await this.transport.close();
    } catch (error) {
      transportError = error;
    }
    if (this.sdkOtelEnabled) {
      try {
        await shutdownOtel();
      } catch (error) {
        console.warn("Failed to shutdown OpenTelemetry providers", error);
      }
    }
    this.closed = true;
    if (transportError !== undefined) {
      throw transportError;
    }
  }
}

export { Sandbox } from "@/client/sandbox.js";
