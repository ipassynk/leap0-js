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

  /**
   * Returns the base desktop URL for opening the remote UI in a browser.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @returns The base desktop URL.
   */
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

  /**
   * Returns display metadata for the desktop session.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns Desktop display metadata.
   */
  async displayInfo(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopDisplayInfo> {
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display",
      { method: "GET" },
      options,
    );
  }
  /**
   * Returns the currently active desktop screen geometry.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns Desktop screen geometry.
   */
  async screen(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopDisplayInfo> {
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display/screen",
      { method: "GET" },
      options,
    );
  }
  /**
   * Resizes the desktop screen to the requested dimensions.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param payload Screen resize parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns Updated desktop display metadata.
   */
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
  /**
   * Lists windows visible on the desktop.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The visible desktop windows.
   */
  async windows(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopWindow[]> {
    return this.requestJson(
      sandbox,
      z.object({ items: z.array(desktopWindowSchema) }),
      "/api/display/windows",
      { method: "GET" },
      options,
    ).then((r) => r.items);
  }
  /**
   * Captures a screenshot and returns raw image bytes.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Screenshot parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns Raw screenshot bytes.
   */
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
  /**
   * Captures a screenshot of a required rectangular region.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param payload Region screenshot parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns Raw screenshot bytes.
   */
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
  /**
   * Returns the current pointer position.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The current pointer position.
   */
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
  /**
   * Moves the desktop pointer to a coordinate.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param x Horizontal coordinate.
   * @param y Vertical coordinate.
   * @param options Optional request settings such as timeout and query params.
   * @returns The updated pointer position.
   */
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
  /**
   * Clicks the current pointer position or an explicit coordinate.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Click parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The resulting pointer position.
   */
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
  /**
   * Drags the pointer from one coordinate to another.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param payload Drag parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The resulting pointer position.
   */
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
  /**
   * Scrolls the desktop in the requested direction.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param payload Scroll parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The resulting pointer position.
   */
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
  /**
   * Types text into the active desktop input target.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param text Text to type.
   * @param options Optional request settings such as timeout and query params.
   * @returns Whether the action succeeded.
   */
  async typeText(sandbox: SandboxRef, text: string, options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/type"),
      { method: "POST", body: jsonBody({ text }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  /**
   * Sends a single key press to the desktop.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param key Key to press.
   * @param options Optional request settings such as timeout and query params.
   * @returns Whether the action succeeded.
   */
  async pressKey(sandbox: SandboxRef, key: string, options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/press"),
      { method: "POST", body: jsonBody({ key }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  /**
   * Sends a key chord such as `Ctrl+C` or `Cmd+Shift+P`.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param keys Keys to press together.
   * @param options Optional request settings such as timeout and query params.
   * @returns Whether the action succeeded.
   */
  async hotkey(sandbox: SandboxRef, keys: string[], options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/hotkey"),
      { method: "POST", body: jsonBody({ keys }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  /**
   * Returns current desktop recording state.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The current recording state.
   */
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
  /**
   * Starts desktop recording.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The updated recording state.
   */
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
  /**
   * Stops desktop recording.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns The updated recording state.
   */
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
  /**
   * Lists recorded desktop sessions.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns Desktop recording summaries.
   */
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
  /**
   * Fetches metadata for a single recording.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param id Recording identifier.
   * @param options Optional request settings such as timeout and query params.
   * @returns The recording metadata.
   */
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
  /**
   * Downloads a recording and returns raw file bytes.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param id Recording identifier.
   * @param options Optional request settings such as timeout and query params.
   * @returns Raw recording file bytes.
   */
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
  /**
   * Deletes a recording by ID.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param id Recording identifier.
   * @param options Optional request settings such as timeout and query params.
   */
  async deleteRecording(sandbox: SandboxRef, id: string, options?: RequestOptions): Promise<void> {
    await this.transport.requestUrl(
      this.requestUrl(sandbox, `/api/recordings/${encodeURIComponent(id)}`),
      { method: "DELETE" },
      options,
    );
  }
  /**
   * Returns desktop service health, accepting both healthy and degraded status codes.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns Desktop health information.
   */
  async health(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopHealth> {
    return this.requestJson(
      sandbox,
      desktopHealthSchema,
      "/api/healthz",
      { method: "GET" },
      { ...options, expectedStatus: [200, 503] },
    );
  }
  /**
   * Returns aggregate status for desktop-managed processes.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @returns Aggregate process status information.
   */
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
  /**
   * Returns status for a named desktop-managed process.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param name Process name.
   * @param options Optional request settings such as timeout and query params.
   * @returns Status for the named process.
   */
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
  /**
   * Restarts a named desktop-managed process.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param name Process name.
   * @param options Optional request settings such as timeout and query params.
   * @returns The restart operation result.
   */
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
  /**
   * Returns logs for a named desktop-managed process.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param name Process name.
   * @param options Optional request settings such as timeout and query params.
   * @returns Process logs.
   */
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
  /**
   * Returns error logs for a named desktop-managed process.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param name Process name.
   * @param options Optional request settings such as timeout and query params.
   * @returns Process error logs.
   */
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
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param options Optional request settings such as timeout and query params.
   * @yields Desktop status stream events.
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
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param timeout Timeout in seconds.
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
