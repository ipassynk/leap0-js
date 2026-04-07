import { z } from "zod";
import { Leap0Error } from "@/core/errors.js";
import { normalize } from "@/core/normalize.js";
import type {
  DesktopClickParams,
  DesktopDisplayInfo,
  DesktopDragParams,
  DesktopHealth,
  DesktopPointerPosition,
  DesktopProcessErrors,
  DesktopProcessLogs,
  DesktopProcessRestart,
  DesktopProcessStatus,
  DesktopProcessStatusList,
  DesktopRecordingStatus,
  DesktopRecordingSummary,
  DesktopScreenshotParams,
  DesktopScreenshotRegionParams,
  DesktopScrollParams,
  DesktopSetScreenParams,
  DesktopStatusStreamEvent,
  DesktopWindow,
  RequestOptions,
  SandboxRef,
} from "@/models/index.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sandboxBaseUrl, sandboxIdOf } from "@/core/utils.js";
import {
  desktopClickParamsSchema,
  desktopDisplayInfoSchema,
  desktopDragParamsSchema,
  desktopHealthSchema,
  desktopPointerPositionSchema,
  desktopProcessErrorsSchema,
  desktopProcessLogsSchema,
  desktopProcessRestartSchema,
  desktopProcessStatusListSchema,
  desktopProcessStatusSchema,
  desktopRecordingStatusSchema,
  desktopRecordingSummarySchema,
  desktopScreenshotParamsSchema,
  desktopScreenshotRegionParamsSchema,
  desktopScrollParamsSchema,
  desktopSetScreenParamsSchema,
  desktopWindowSchema,
} from "@/models/desktop.js";
import { asRecord } from "@/services/shared.js";

const desktopOkResponseSchema = z.object({ ok: z.boolean() });

/**
 * Drives the desktop sandbox APIs for browser and GUI automation.
 *
 * @throws {Leap0Error} If API calls, stream decoding, or response validation fail.
 */
export class DesktopClient {
  constructor(private readonly transport: Leap0Transport) {}

  private requestUrl(sandbox: SandboxRef, path: string): string {
    return `${sandboxBaseUrl(sandboxIdOf(sandbox), this.transport.sandboxDomain)}${path}`;
  }

  /** Returns the base desktop URL for opening the remote UI in a browser. */
  desktopUrl(sandbox: SandboxRef): string {
    return `${sandboxBaseUrl(sandboxIdOf(sandbox), this.transport.sandboxDomain)}/`;
  }

  private async requestJson<T>(
    sandbox: SandboxRef,
    schema: z.ZodType<T>,
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<T> {
    return normalize(
      schema,
      await this.transport.requestJsonUrl(this.requestUrl(sandbox, path), init, options),
    );
  }

  /** Returns display metadata for the desktop session. */
  async displayInfo(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopDisplayInfo> {
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display",
      { method: "GET" },
      options,
    );
  }
  /** Returns the currently active desktop screen geometry. */
  async screen(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopDisplayInfo> {
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display/screen",
      { method: "GET" },
      options,
    );
  }
  /** Resizes the desktop screen to the requested dimensions. */
  async resizeScreen(
    sandbox: SandboxRef,
    payload: DesktopSetScreenParams,
    options?: RequestOptions,
  ): Promise<DesktopDisplayInfo> {
    const parsed = desktopSetScreenParamsSchema.parse(payload);
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display/screen",
      { method: "POST", body: jsonBody(parsed) },
      options,
    );
  }
  /** Lists windows visible on the desktop. */
  async windows(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopWindow[]> {
    return this.requestJson(
      sandbox,
      z.object({ items: z.array(desktopWindowSchema) }),
      "/api/display/windows",
      { method: "GET" },
      options,
    ).then((r) => r.items);
  }
  /** Captures a screenshot and returns raw image bytes. */
  async screenshot(
    sandbox: SandboxRef,
    params: DesktopScreenshotParams = {},
    options?: RequestOptions,
  ): Promise<Uint8Array> {
    const parsed = desktopScreenshotParamsSchema.parse(params);
    return await this.transport.requestBytesUrl(
      this.requestUrl(sandbox, "/api/screenshot"),
      { method: "GET" },
      { ...options, query: parsed },
    );
  }
  /** Captures a screenshot of a required rectangular region. */
  async screenshotRegion(
    sandbox: SandboxRef,
    payload: DesktopScreenshotRegionParams,
    options?: RequestOptions,
  ): Promise<Uint8Array> {
    const parsed = desktopScreenshotRegionParamsSchema.parse(payload);
    return await this.transport.requestBytesUrl(
      this.requestUrl(sandbox, "/api/screenshot/region"),
      { method: "POST", body: jsonBody(parsed) },
      options,
    );
  }
  /** Returns the current pointer position. */
  async pointerPosition(
    sandbox: SandboxRef,
    options?: RequestOptions,
  ): Promise<DesktopPointerPosition> {
    return this.requestJson(
      sandbox,
      desktopPointerPositionSchema,
      "/api/input/position",
      { method: "GET" },
      options,
    );
  }
  /** Moves the desktop pointer to a coordinate. */
  async movePointer(
    sandbox: SandboxRef,
    x: number,
    y: number,
    options?: RequestOptions,
  ): Promise<DesktopPointerPosition> {
    return this.requestJson(
      sandbox,
      desktopPointerPositionSchema,
      "/api/input/move",
      { method: "POST", body: jsonBody({ x, y }) },
      options,
    );
  }
  /** Clicks the current pointer position or an explicit coordinate. */
  async click(
    sandbox: SandboxRef,
    params: DesktopClickParams = {},
    options?: RequestOptions,
  ): Promise<DesktopPointerPosition> {
    const parsed = desktopClickParamsSchema.parse(params);
    return this.requestJson(
      sandbox,
      desktopPointerPositionSchema,
      "/api/input/click",
      { method: "POST", body: jsonBody(parsed) },
      options,
    );
  }
  /** Drags the pointer from one coordinate to another. */
  async drag(
    sandbox: SandboxRef,
    payload: DesktopDragParams,
    options?: RequestOptions,
  ): Promise<DesktopPointerPosition> {
    const parsed = desktopDragParamsSchema.parse(payload);
    return this.requestJson(
      sandbox,
      desktopPointerPositionSchema,
      "/api/input/drag",
      {
        method: "POST",
        body: jsonBody({
          from_x: parsed.fromX,
          from_y: parsed.fromY,
          to_x: parsed.toX,
          to_y: parsed.toY,
          button: parsed.button,
        }),
      },
      options,
    );
  }
  /** Scrolls the desktop in the requested direction. */
  async scroll(
    sandbox: SandboxRef,
    payload: DesktopScrollParams,
    options?: RequestOptions,
  ): Promise<DesktopPointerPosition> {
    const parsed = desktopScrollParamsSchema.parse(payload);
    return this.requestJson(
      sandbox,
      desktopPointerPositionSchema,
      "/api/input/scroll",
      { method: "POST", body: jsonBody(parsed) },
      options,
    );
  }
  /** Types text into the active desktop input target. */
  async typeText(sandbox: SandboxRef, text: string, options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/type"),
      { method: "POST", body: jsonBody({ text }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  /** Sends a single key press to the desktop. */
  async pressKey(sandbox: SandboxRef, key: string, options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/press"),
      { method: "POST", body: jsonBody({ key }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  /** Sends a key chord such as `Ctrl+C` or `Cmd+Shift+P`. */
  async hotkey(sandbox: SandboxRef, keys: string[], options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/hotkey"),
      { method: "POST", body: jsonBody({ keys }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  /** Returns current desktop recording state. */
  async recordingStatus(
    sandbox: SandboxRef,
    options?: RequestOptions,
  ): Promise<DesktopRecordingStatus> {
    return this.requestJson(
      sandbox,
      desktopRecordingStatusSchema,
      "/api/recording",
      { method: "GET" },
      options,
    );
  }
  /** Starts desktop recording. */
  async startRecording(
    sandbox: SandboxRef,
    options?: RequestOptions,
  ): Promise<DesktopRecordingStatus> {
    return this.requestJson(
      sandbox,
      desktopRecordingStatusSchema,
      "/api/recording/start",
      { method: "POST" },
      options,
    );
  }
  /** Stops desktop recording. */
  async stopRecording(
    sandbox: SandboxRef,
    options?: RequestOptions,
  ): Promise<DesktopRecordingStatus> {
    return this.requestJson(
      sandbox,
      desktopRecordingStatusSchema,
      "/api/recording/stop",
      { method: "POST" },
      options,
    );
  }
  /** Lists recorded desktop sessions. */
  async recordings(
    sandbox: SandboxRef,
    options?: RequestOptions,
  ): Promise<DesktopRecordingSummary[]> {
    return this.requestJson(
      sandbox,
      z.object({ items: z.array(desktopRecordingSummarySchema) }),
      "/api/recordings",
      { method: "GET" },
      options,
    ).then((r) => r.items);
  }
  /** Fetches metadata for a single recording. */
  async getRecording(
    sandbox: SandboxRef,
    id: string,
    options?: RequestOptions,
  ): Promise<DesktopRecordingSummary> {
    return this.requestJson(
      sandbox,
      desktopRecordingSummarySchema,
      `/api/recordings/${encodeURIComponent(id)}`,
      { method: "GET" },
      options,
    );
  }
  /** Downloads a recording and returns raw file bytes. */
  async downloadRecording(
    sandbox: SandboxRef,
    id: string,
    options?: RequestOptions,
  ): Promise<Uint8Array> {
    return await this.transport.requestBytesUrl(
      this.requestUrl(sandbox, `/api/recordings/${encodeURIComponent(id)}/download`),
      { method: "GET" },
      options,
    );
  }
  /** Deletes a recording by ID. */
  async deleteRecording(sandbox: SandboxRef, id: string, options?: RequestOptions): Promise<void> {
    await this.transport.requestUrl(
      this.requestUrl(sandbox, `/api/recordings/${encodeURIComponent(id)}`),
      { method: "DELETE" },
      options,
    );
  }
  /** Returns desktop service health, accepting both healthy and degraded status codes. */
  async health(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopHealth> {
    return this.requestJson(
      sandbox,
      desktopHealthSchema,
      "/api/healthz",
      { method: "GET" },
      { ...options, expectedStatus: [200, 503] },
    );
  }
  /** Returns aggregate status for desktop-managed processes. */
  async processStatus(
    sandbox: SandboxRef,
    options?: RequestOptions,
  ): Promise<DesktopProcessStatusList> {
    return this.requestJson(
      sandbox,
      desktopProcessStatusListSchema,
      "/api/status",
      { method: "GET" },
      options,
    );
  }
  /** Returns status for a named desktop-managed process. */
  async getProcess(
    sandbox: SandboxRef,
    name: string,
    options?: RequestOptions,
  ): Promise<DesktopProcessStatus> {
    return this.requestJson(
      sandbox,
      desktopProcessStatusSchema,
      `/api/process/${encodeURIComponent(name)}/status`,
      { method: "GET" },
      options,
    );
  }
  /** Restarts a named desktop-managed process. */
  async restartProcess(
    sandbox: SandboxRef,
    name: string,
    options?: RequestOptions,
  ): Promise<DesktopProcessRestart> {
    return this.requestJson(
      sandbox,
      desktopProcessRestartSchema,
      `/api/process/${encodeURIComponent(name)}/restart`,
      { method: "POST" },
      options,
    );
  }
  /** Returns logs for a named desktop-managed process. */
  async processLogs(
    sandbox: SandboxRef,
    name: string,
    options?: RequestOptions,
  ): Promise<DesktopProcessLogs> {
    return this.requestJson(
      sandbox,
      desktopProcessLogsSchema,
      `/api/process/${encodeURIComponent(name)}/logs`,
      { method: "GET" },
      options,
    );
  }
  /** Returns error logs for a named desktop-managed process. */
  async processErrors(
    sandbox: SandboxRef,
    name: string,
    options?: RequestOptions,
  ): Promise<DesktopProcessErrors> {
    return this.requestJson(
      sandbox,
      desktopProcessErrorsSchema,
      `/api/process/${encodeURIComponent(name)}/errors`,
      { method: "GET" },
      options,
    );
  }

  /**
   * Streams desktop process status updates.
   *
   * @throws {Leap0Error} If the stream returns malformed events or reports an error envelope.
   */
  async *statusStream(
    sandbox: SandboxRef,
    options: RequestOptions = {},
  ): AsyncIterable<DesktopStatusStreamEvent> {
    for await (const event of this.transport.streamJsonUrl(
      this.requestUrl(sandbox, "/api/status/stream"),
      { method: "GET" },
      options,
    )) {
      if (!event || typeof event !== "object") {
        throw new Leap0Error("Malformed desktop status stream event");
      }
      const record = asRecord(event);
      if (typeof record.message === "string") {
        throw new Leap0Error("Desktop status stream error", { body: record.message });
      }
      yield normalize(desktopProcessStatusListSchema, event);
    }
  }

  /**
   * Waits until the desktop reports a running state or all tracked processes are up.
   *
   * @throws {Leap0Error} If the desktop never becomes ready or a non-retryable error occurs.
   *
   * @example
   * ```ts
   * await sandbox.desktop.waitUntilReady();
   * ```
   */
  async waitUntilReady(sandbox: SandboxRef, timeout = 60): Promise<void> {
    const deadline = Date.now() + timeout * 1000;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
        for await (const status of this.statusStream(sandbox, { timeout: remaining })) {
          if (status.status === "running") {
            return;
          }
          if (
            status.total > 0 &&
            status.running >= status.total
          ) {
            return;
          }
        }
        const retryDelay = deadline - Date.now();
        if (retryDelay <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(500, retryDelay)));
      } catch (error) {
        lastError = error;
        if (error instanceof Leap0Error && !error.retryable) throw error;
        // Transient error, retry with backoff
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(500, remaining)));
      }
    }
    throw new Leap0Error(
      `Desktop did not become ready within ${timeout}s${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
    );
  }
}
