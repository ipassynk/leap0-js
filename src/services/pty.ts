import { z } from "zod";
import { Leap0WebSocketError } from "@/core/errors.js";
import { normalize } from "@/core/normalize.js";
import type {
  CreatePtySessionParams,
  PtySession,
  RequestOptions,
  SandboxRef,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { ptySessionSchema } from "@/models/pty.js";
import { sandboxIdOf, websocketUrlFromHttp } from "@/core/utils.js";

/** Thin wrapper around an interactive PTY websocket connection. */
export class PtyConnection {
  constructor(private readonly socket: WebSocket) {}

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.socket.send(data);
  }

  recv(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.socket.removeEventListener("message", onMessage);
        this.socket.removeEventListener("error", onError);
        this.socket.removeEventListener("close", onClose);
      };
      const onMessage = (event: MessageEvent) => {
        cleanup();
        const value = event.data;
        if (typeof value === "string") {
          resolve(new TextEncoder().encode(value));
          return;
        }
        if (value instanceof Blob) {
          value
            .arrayBuffer()
            .then((buffer) => resolve(new Uint8Array(buffer)))
            .catch(reject);
          return;
        }
        resolve(new Uint8Array(value));
      };
      const onError = () => {
        cleanup();
        reject(new Leap0WebSocketError("PTY websocket error"));
      };
      const onClose = () => {
        cleanup();
        reject(new Leap0WebSocketError("PTY websocket closed"));
      };
      this.socket.addEventListener("message", onMessage, { once: true });
      this.socket.addEventListener("error", onError, { once: true });
      this.socket.addEventListener("close", onClose, { once: true });
    });
  }

  close(): void {
    this.socket.close();
  }
}

/** Creates and manages PTY sessions for interactive terminals. */
export class PtyClient {
  constructor(private readonly transport: Leap0Transport) {}

  async list(sandbox: SandboxRef, options: RequestOptions = {}): Promise<PtySession[]> {
    const data = await this.transport.requestJson(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty`,
      { method: "GET" },
      options,
    );
    return normalize(z.object({ items: z.array(ptySessionSchema) }), data).items;
  }

  async create(
    sandbox: SandboxRef,
    params: CreatePtySessionParams = {},
    options: RequestOptions = {},
  ): Promise<PtySession> {
    const data = await this.transport.requestJson(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty`,
      {
        method: "POST",
        body: jsonBody({
          id: params.sessionId,
          cwd: params.cwd,
          envs: params.envs,
          cols: params.cols,
          rows: params.rows,
          lazy_start: params.lazyStart,
        }),
      },
      options,
    );
    return normalize(ptySessionSchema, data);
  }

  async get(
    sandbox: SandboxRef,
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<PtySession> {
    const data = await this.transport.requestJson(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty/${encodeURIComponent(sessionId)}`,
      { method: "GET" },
      options,
    );
    return normalize(ptySessionSchema, data);
  }

  async delete(
    sandbox: SandboxRef,
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
      options,
    );
  }

  async resize(
    sandbox: SandboxRef,
    sessionId: string,
    cols: number,
    rows: number,
    options: RequestOptions = {},
  ): Promise<PtySession> {
    const data = await this.transport.requestJson(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty/${encodeURIComponent(sessionId)}/resize`,
      { method: "POST", body: jsonBody({ cols, rows }) },
      options,
    );
    return normalize(ptySessionSchema, data);
  }

  websocketUrl(sandbox: SandboxRef, sessionId: string): string {
    return websocketUrlFromHttp(
      `${this.transport.baseUrl}/v1/sandbox/${sandboxIdOf(sandbox)}/pty/${encodeURIComponent(sessionId)}/connect`,
    );
  }

  websocketHeaders(): Record<string, string> {
    return { authorization: this.transport.apiKey };
  }

  connect(sandbox: SandboxRef, sessionId: string): PtyConnection {
    return new PtyConnection(
      new WebSocket(this.websocketUrl(sandbox, sessionId), {
        headers: this.websocketHeaders(),
      } as never),
    );
  }
}
