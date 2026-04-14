import type { PresignedUrl, SandboxData, SandboxState } from "@/models/index.js";
import { sandboxStateSchema } from "@/models/sandbox.js";
import {
  CodeInterpreterClient,
  DesktopClient,
  FilesystemClient,
  GitClient,
  LspClient,
  ProcessClient,
  PtyClient,
  SshClient,
} from "@/services/index.js";

import type { Leap0Client } from "@/client/index.js";

/** @internal Symbol used to access service clients on Leap0Client. */
export const SERVICES = Symbol.for("leap0.services");

function isSandboxData(value: unknown): value is SandboxData {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.templateId === "string" &&
    sandboxStateSchema.safeParse(record.state).success &&
    typeof record.vcpu === "number" &&
    typeof record.memory === "number" &&
    typeof record.disk === "number" &&
    typeof record.createdAt === "string"
  );
}

function unwrapSandboxData(value: unknown): SandboxData {
  if (value instanceof Sandbox || isSandboxData(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as { data?: unknown; toJSON?: () => unknown };
    if (isSandboxData(record.data)) {
      return record.data;
    }
    if (typeof record.toJSON === "function") {
      const json = record.toJSON();
      if (isSandboxData(json)) {
        return json;
      }
    }
  }
  throw new TypeError("Expected this.client.sandboxes.get() to return SandboxData or Sandbox");
}

type BoundSandboxMethod<Method> = Method extends (
  sandbox: infer _Sandbox,
  ...args: infer Args
) => infer Result
  ? (...args: Args) => Result
  : Method;

type BoundSandboxService<Service extends object> = {
  [Key in keyof Service]: BoundSandboxMethod<Service[Key]>;
};

class SandboxServiceProxy<Service extends object> {
  constructor(
    private readonly service: Service,
    private readonly sandbox: Sandbox,
  ) {}

  get proxy(): BoundSandboxService<Service> {
    return new Proxy(this.service, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") {
          return value;
        }
        return (...args: unknown[]) => Reflect.apply(value, target, [this.sandbox, ...args]);
      },
    }) as BoundSandboxService<Service>;
  }
}

/**
 * Bound sandbox handle with convenience methods and resource-scoped helpers.
 *
 * @throws {Leap0Error} If API requests or response validation fail.
 */
export class Sandbox implements SandboxData {
  /** Unique sandbox ID. */
  id!: string;
  /** Template ID the sandbox was created from. */
  templateId!: string;
  /** Template name, when available from the API response. */
  templateName?: string;
  /** Current sandbox lifecycle state. */
  state!: SandboxState;
  /** Number of virtual CPUs assigned to the sandbox. */
  vcpu!: number;
  /** Allocated memory in MiB. */
  memory!: number;
  /** Allocated disk in MiB. */
  disk!: number;
  /** Auto-shutdown timeout in minutes, when configured. */
  timeout?: number;
  /** Whether the sandbox automatically pauses when idle. */
  autoPause?: boolean;
  /** Environment variables configured for the sandbox. */
  envVars?: Record<string, string>;
  /** Network policy attached to the sandbox. */
  networkPolicy?: SandboxData["networkPolicy"];
  /** Creation timestamp in ISO 8601 format. */
  createdAt!: string;
  /** Last update timestamp in ISO 8601 format, when available. */
  updatedAt?: string;
  [key: string]: unknown;

  /** Filesystem operations scoped to this sandbox. */
  readonly filesystem: BoundSandboxService<FilesystemClient>;
  /** Git operations scoped to this sandbox. */
  readonly git: BoundSandboxService<GitClient>;
  /** One-shot process execution scoped to this sandbox. */
  readonly process: BoundSandboxService<ProcessClient>;
  /** PTY session management scoped to this sandbox. */
  readonly pty: BoundSandboxService<PtyClient>;
  /** Language-server operations scoped to this sandbox. */
  readonly lsp: BoundSandboxService<LspClient>;
  /** SSH access management scoped to this sandbox. */
  readonly ssh: BoundSandboxService<SshClient>;
  /** Code interpreter operations scoped to this sandbox. */
  readonly codeInterpreter: BoundSandboxService<CodeInterpreterClient>;
  /** Desktop automation operations scoped to this sandbox. */
  readonly desktop: BoundSandboxService<DesktopClient>;

  /** Creates a sandbox handle bound to a parent client. */
  constructor(
    private readonly client: Leap0Client,
    data: SandboxData,
  ) {
    this.update(data);
    const svc = client[SERVICES];
    this.filesystem = new SandboxServiceProxy(svc.filesystem, this).proxy;
    this.git = new SandboxServiceProxy(svc.git, this).proxy;
    this.process = new SandboxServiceProxy(svc.process, this).proxy;
    this.pty = new SandboxServiceProxy(svc.pty, this).proxy;
    this.lsp = new SandboxServiceProxy(svc.lsp, this).proxy;
    this.ssh = new SandboxServiceProxy(svc.ssh, this).proxy;
    this.codeInterpreter = new SandboxServiceProxy(svc.codeInterpreter, this).proxy;
    this.desktop = new SandboxServiceProxy(svc.desktop, this).proxy;
  }

  /**
   * Applies fresh sandbox data onto the current handle.
   *
   * @param data Latest sandbox payload.
   * @returns The updated sandbox handle.
   */
  private update(data: SandboxData): this {
    this.id = data.id;
    this.templateId = data.templateId;
    this.templateName = data.templateName;
    this.state = data.state;
    this.vcpu = data.vcpu;
    this.memory = data.memory;
    this.disk = data.disk;
    this.timeout = data.timeout;
    this.autoPause = data.autoPause;
    this.envVars = data.envVars;
    this.networkPolicy = data.networkPolicy;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    return this;
  }

  /**
   * Fetches the latest sandbox state from the API.
   *
   * @returns The refreshed sandbox handle.
   *
   * @throws {Leap0Error} If fetching the sandbox fails.
   */
  async refresh(): Promise<this> {
    const latest = await this.client.sandboxes.get(this.id);
    this.update(unwrapSandboxData(latest));
    return this;
  }

  /**
   * Pauses the sandbox and updates local state.
   *
   * @param options Optional request settings.
   * @returns The paused sandbox handle.
   *
   * @throws {Leap0Error} If pausing the sandbox fails.
   */
  async pause(options?: { timeout?: number }): Promise<this> {
    this.update((await this.client.sandboxes.pause(this.id, options)) as SandboxData);
    return this;
  }

  /**
   * Deletes the sandbox.
   *
   * @param options Optional request settings.
   *
   * @throws {Leap0Error} If deleting the sandbox fails.
   */
  async delete(options?: { timeout?: number }): Promise<void> {
    await this.client.sandboxes.delete(this.id, options);
  }

  /**
   * Creates a temporary public URL for a specific sandbox port.
   *
   * @param port Sandbox port to expose.
   * @param expiresIn Optional expiration in seconds.
   * @param options Optional request settings.
   * @returns The created presigned URL.
   */
  async createPresignedUrl(
    port: number,
    expiresIn?: number,
    options?: { timeout?: number },
  ): Promise<PresignedUrl> {
    return this.client.sandboxes.createPresignedUrl(this.id, { port, expiresIn }, options);
  }

  /**
   * Deletes a previously issued presigned URL.
   *
   * @param id Presigned URL identifier.
   * @param options Optional request settings.
   */
  async deletePresignedUrl(id: string, options?: { timeout?: number }): Promise<void> {
    await this.client.sandboxes.deletePresignedUrl(this.id, id, options);
  }

  /**
   * Returns the public invoke URL for the sandbox.
   *
   * @param path Route path to append.
   * @param port Optional forwarded port.
   * @returns The public HTTPS URL.
   */
  invokeUrl(path = "/", port?: number): string {
    return this.client.sandboxes.invokeUrl(this.id, path, port);
  }

  /**
   * Returns the public websocket URL for the sandbox.
   *
   * @param path Route path to append.
   * @param port Optional forwarded port.
   * @returns The public websocket URL.
   */
  websocketUrl(path = "/", port?: number): string {
    return this.client.sandboxes.websocketUrl(this.id, path, port);
  }

  /**
   * Fetches the resolved home directory for the sandbox user.
   *
   * @param options Optional request settings.
   * @returns The resolved sandbox user home directory.
   */
  async getUserHomeDir(options?: { timeout?: number }): Promise<string> {
    return this.client.sandboxes.getUserHomeDir(this.id, options);
  }

  /**
   * Fetches the configured working directory for the sandbox.
   *
   * @param options Optional request settings.
   * @returns The configured sandbox workdir.
   */
  async getWorkdir(options?: { timeout?: number }): Promise<string> {
    return this.client.sandboxes.getWorkdir(this.id, options);
  }

}
