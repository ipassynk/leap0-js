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

/** Internal service map used by Sandbox to bind per-sandbox proxies. */
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
 */
export class Leap0Client {
  private closed = false;
  private readonly sdkOtelEnabled: boolean;
  private readonly transport: Leap0Transport;

  readonly sandboxes: SandboxesClient<Sandbox>;
  readonly snapshots: SnapshotsClient<Sandbox>;
  readonly templates: TemplatesClient;

  /** @internal - used by Sandbox to bind service proxies. */
  readonly [SERVICES]: ClientServices;

  /** Creates a client using explicit config or environment variables. */
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

  /** Closes the underlying transport. */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await this.transport.close();
    if (this.sdkOtelEnabled) {
      try {
        await shutdownOtel();
      } catch (error) {
        console.warn("Failed to shutdown OpenTelemetry providers", error);
      }
    }
  }
}

export { Sandbox } from "@/client/sandbox.js";
