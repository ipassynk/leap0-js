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

/** Drives the desktop sandbox APIs for browser and GUI automation. */
export class DesktopClient {
  constructor(private readonly transport: Leap0Transport) {}

  private requestUrl(sandbox: SandboxRef, path: string): string {
    return `${sandboxBaseUrl(sandboxIdOf(sandbox), this.transport.sandboxDomain)}${path}`;
  }

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

  async displayInfo(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopDisplayInfo> {
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display",
      { method: "GET" },
      options,
    );
  }
  async screen(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopDisplayInfo> {
    return this.requestJson(
      sandbox,
      desktopDisplayInfoSchema,
      "/api/display/screen",
      { method: "GET" },
      options,
    );
  }
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
  async windows(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopWindow[]> {
    return this.requestJson(
      sandbox,
      z.object({ items: z.array(desktopWindowSchema) }),
      "/api/display/windows",
      { method: "GET" },
      options,
    ).then((r) => r.items);
  }
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
  async typeText(sandbox: SandboxRef, text: string, options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/type"),
      { method: "POST", body: jsonBody({ text }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  async pressKey(sandbox: SandboxRef, key: string, options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/press"),
      { method: "POST", body: jsonBody({ key }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
  async hotkey(sandbox: SandboxRef, keys: string[], options?: RequestOptions): Promise<boolean> {
    const data = await this.transport.requestJsonUrl(
      this.requestUrl(sandbox, "/api/input/hotkey"),
      { method: "POST", body: jsonBody({ keys }) },
      options,
    );
    return normalize(desktopOkResponseSchema, data).ok;
  }
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
  async deleteRecording(sandbox: SandboxRef, id: string, options?: RequestOptions): Promise<void> {
    await this.transport.requestUrl(
      this.requestUrl(sandbox, `/api/recordings/${encodeURIComponent(id)}`),
      { method: "DELETE" },
      options,
    );
  }
  async health(sandbox: SandboxRef, options?: RequestOptions): Promise<DesktopHealth> {
    return this.requestJson(
      sandbox,
      desktopHealthSchema,
      "/api/healthz",
      { method: "GET" },
      { ...options, expectedStatus: [200, 503] },
    );
  }
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
