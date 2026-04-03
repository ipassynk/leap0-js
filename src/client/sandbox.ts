import type { SandboxData, SandboxState } from "@/models/index.js";
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
    typeof record.memoryMib === "number" &&
    typeof record.diskMib === "number" &&
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
 */
export class Sandbox implements SandboxData {
  id!: string;
  templateId!: string;
  templateName?: string;
  state!: SandboxState;
  vcpu!: number;
  memoryMib!: number;
  diskMib!: number;
  timeoutMin?: number;
  autoPause?: boolean;
  envVars?: Record<string, string>;
  networkPolicy?: SandboxData["networkPolicy"];
  createdAt!: string;
  updatedAt?: string;
  [key: string]: unknown;

  readonly filesystem: BoundSandboxService<FilesystemClient>;
  readonly git: BoundSandboxService<GitClient>;
  readonly process: BoundSandboxService<ProcessClient>;
  readonly pty: BoundSandboxService<PtyClient>;
  readonly lsp: BoundSandboxService<LspClient>;
  readonly ssh: BoundSandboxService<SshClient>;
  readonly codeInterpreter: BoundSandboxService<CodeInterpreterClient>;
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
   * Args:
   *   data: Latest sandbox payload.
   *
   * Returns:
   *   The updated sandbox handle.
   */
  private update(data: SandboxData): this {
    this.id = data.id;
    this.templateId = data.templateId;
    this.templateName = data.templateName;
    this.state = data.state;
    this.vcpu = data.vcpu;
    this.memoryMib = data.memoryMib;
    this.diskMib = data.diskMib;
    this.timeoutMin = data.timeoutMin;
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
   * Returns:
   *   The refreshed sandbox handle.
   */
  async refresh(): Promise<this> {
    const latest = await this.client.sandboxes.get(this.id);
    this.update(unwrapSandboxData(latest));
    return this;
  }

  /**
   * Pauses the sandbox and updates local state.
   *
   * Args:
   *   options: Optional request settings.
   *
   * Returns:
   *   The paused sandbox handle.
   */
  async pause(options?: { timeout?: number }): Promise<this> {
    this.update((await this.client.sandboxes.pause(this.id, options)) as SandboxData);
    return this;
  }

  /**
   * Deletes the sandbox.
   *
   * Args:
   *   options: Optional request settings.
   */
  async delete(options?: { timeout?: number }): Promise<void> {
    await this.client.sandboxes.delete(this.id, options);
  }

  /**
   * Returns the public invoke URL for the sandbox.
   *
   * Args:
   *   path: Route path to append.
   *   port: Optional forwarded port.
   *
   * Returns:
   *   The public HTTPS URL.
   */
  invokeUrl(path = "/", port?: number): string {
    return this.client.sandboxes.invokeUrl(this.id, path, port);
  }

  /**
   * Returns the public websocket URL for the sandbox.
   *
   * Args:
   *   path: Route path to append.
   *   port: Optional forwarded port.
   *
   * Returns:
   *   The public websocket URL.
   */
  websocketUrl(path = "/", port?: number): string {
    return this.client.sandboxes.websocketUrl(this.id, path, port);
  }
}
