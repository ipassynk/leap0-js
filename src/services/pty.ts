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

/**
 * Thin wrapper around an interactive PTY websocket connection.
 *
 * @throws {Leap0WebSocketError} If the websocket errors or closes while receiving data.
 */
export class PtyConnection {
  constructor(private readonly socket: WebSocket) {}

  /**
   * Sends raw data to the PTY websocket.
   *
   * @param data Raw payload to send.
   */
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.socket.send(data);
  }

  /**
   * Waits for the next websocket message.
   *
   * @returns The next websocket payload as bytes.
   * @throws {Leap0WebSocketError} If the websocket errors or closes before a message arrives.
   */
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

  /** Closes the websocket connection. */
  close(): void {
    this.socket.close();
  }
}

/**
 * Creates and manages PTY sessions for interactive terminals.
 *
 * @throws {Leap0Error} If API calls or response validation fail.
 */
export class PtyClient {
  constructor(private readonly transport: Leap0Transport) {}

  /**
   * Lists PTY sessions for a sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The PTY sessions in the sandbox.
   */
  async list(sandbox: SandboxRef, options: RequestOptions = {}): Promise<PtySession[]> {
    const data = await this.transport.requestJson(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty`,
      { method: "GET" },
      options,
    );
    return normalize(z.object({ items: z.array(ptySessionSchema) }), data).items;
  }

  /**
   * Creates a PTY session.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params PTY session creation parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The created PTY session.
   */
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

  /**
   * Fetches a PTY session by ID.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param sessionId PTY session identifier.
   * @param options Optional request settings such as timeout and query params.
   * @returns The requested PTY session.
   */
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

  /**
   * Deletes a PTY session.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param sessionId PTY session identifier.
   * @param options Optional request settings such as timeout and query params.
   */
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

  /**
   * Resizes an existing PTY session.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Resize parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The updated PTY session.
   */
  async resize(
    sandbox: SandboxRef,
    params: { sessionId: string; cols: number; rows: number },
    options: RequestOptions = {},
  ): Promise<PtySession> {
    const data = await this.transport.requestJson(
      `/v1/sandbox/${sandboxIdOf(sandbox)}/pty/${encodeURIComponent(params.sessionId)}/resize`,
      { method: "POST", body: jsonBody({ cols: params.cols, rows: params.rows }) },
      options,
    );
    return normalize(ptySessionSchema, data);
  }

  /**
   * Returns the websocket URL for a PTY session.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param sessionId PTY session identifier.
   * @returns The PTY websocket URL.
   */
  websocketUrl(sandbox: SandboxRef, sessionId: string): string {
    return websocketUrlFromHttp(
      `${this.transport.baseUrl}/v1/sandbox/${sandboxIdOf(sandbox)}/pty/${encodeURIComponent(sessionId)}/connect`,
    );
  }

  /**
   * Returns auth headers to use when opening the PTY websocket manually.
   *
   * @returns Headers required for PTY websocket authentication.
   */
  websocketHeaders(): Record<string, string> {
    return { authorization: this.transport.apiKey };
  }

  /**
   * Opens a websocket connection for an existing PTY session.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param sessionId PTY session identifier.
   * @returns The PTY websocket connection wrapper.
   * @throws {Leap0WebSocketError} If subsequent websocket reads fail.
   *
   * @example
   * ```ts
   * const pty = sandbox.pty.connect("shell");
   * pty.send("ls\n");
   * const output = await pty.recv();
   * ```
   */
  connect(sandbox: SandboxRef, sessionId: string): PtyConnection {
    return new PtyConnection(
      new WebSocket(this.websocketUrl(sandbox, sessionId), {
        headers: this.websocketHeaders(),
      } as never),
    );
  }
}
