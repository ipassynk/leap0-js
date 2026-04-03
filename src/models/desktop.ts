import { z } from "zod";

export const desktopDisplayInfoSchema = z
  .object({
    display: z.string(),
    width: z.number(),
    height: z.number(),
  })
  .catchall(z.unknown());
export type DesktopDisplayInfo = z.infer<typeof desktopDisplayInfoSchema>;

export const desktopPointerPositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .catchall(z.unknown());
export type DesktopPointerPosition = z.infer<typeof desktopPointerPositionSchema>;

export const desktopSetScreenParamsSchema = z
  .object({
    width: z.number().int().min(320).max(7680),
    height: z.number().int().min(320).max(4320),
  })
  .catchall(z.unknown());
export type DesktopSetScreenParams = z.infer<typeof desktopSetScreenParamsSchema>;

export const desktopScreenshotParamsSchema = z.object({
  format: z.enum(["png", "jpg", "jpeg"]).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
}).refine((params) => (params.width === undefined) === (params.height === undefined), {
  message: "width and height must be provided together",
});
export type DesktopScreenshotParams = z.infer<typeof desktopScreenshotParamsSchema>;

export const desktopScreenshotRegionParamsSchema = z
  .object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    format: z.enum(["png", "jpg", "jpeg"]).optional(),
    quality: z.number().int().min(1).max(100).optional(),
  })
  .catchall(z.unknown());
export type DesktopScreenshotRegionParams = z.infer<typeof desktopScreenshotRegionParamsSchema>;

export const desktopClickParamsSchema = z
  .object({
    x: z.number().int().min(0).optional(),
    y: z.number().int().min(0).optional(),
    button: z.number().int().min(1).max(3).optional(),
  })
  .catchall(z.unknown())
  .refine((params) => (params.x === undefined) === (params.y === undefined), {
    message: "x and y must be provided together or both omitted",
  });
export type DesktopClickParams = z.infer<typeof desktopClickParamsSchema>;

export const desktopDragParamsSchema = z
  .object({
    fromX: z.number().int().min(0),
    fromY: z.number().int().min(0),
    toX: z.number().int().min(0),
    toY: z.number().int().min(0),
    button: z.number().int().min(1).max(3).optional(),
  })
  .catchall(z.unknown());
export type DesktopDragParams = z.infer<typeof desktopDragParamsSchema>;

export const desktopScrollParamsSchema = z
  .object({
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number().int().min(1).max(100).optional(),
  })
  .catchall(z.unknown());
export type DesktopScrollParams = z.infer<typeof desktopScrollParamsSchema>;

export const desktopWindowSchema = z
  .object({
    id: z.string().optional(),
    desktop: z.number().optional(),
    pid: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    class: z.string().optional(),
    host: z.string().optional(),
    title: z.string().optional(),
    focused: z.boolean().optional(),
  })
  .catchall(z.unknown());
export type DesktopWindow = z.infer<typeof desktopWindowSchema>;

export const desktopHealthSchema = z
  .object({
    ok: z.boolean(),
  })
  .catchall(z.unknown());
export type DesktopHealth = z.infer<typeof desktopHealthSchema>;

export const desktopRecordingSummarySchema = z
  .object({
    id: z.string().optional(),
    fileName: z.string().optional(),
    download: z.string().optional(),
    mimeType: z.string().optional(),
    sizeBytes: z.number().optional(),
    createdAt: z.string().optional(),
    active: z.boolean().optional(),
  })
  .catchall(z.unknown());
export type DesktopRecordingSummary = z.infer<typeof desktopRecordingSummarySchema>;

export const desktopRecordingStatusSchema = z
  .object({
    id: z.string().optional(),
    active: z.boolean().optional(),
    startedAt: z.string().optional(),
    stoppedAt: z.string().optional(),
    download: z.string().optional(),
    mimeType: z.string().optional(),
    fileName: z.string().optional(),
    display: z.string().optional(),
    resolution: z.string().optional(),
  })
  .catchall(z.unknown());
export type DesktopRecordingStatus = z.infer<typeof desktopRecordingStatusSchema>;

export const desktopProcessStatusSchema = z
  .object({
    name: z.string().optional(),
    running: z.boolean().optional(),
    pid: z.number().optional(),
    stdoutLog: z.string().optional(),
    stderrLog: z.string().optional(),
  })
  .catchall(z.unknown());
export type DesktopProcessStatus = z.infer<typeof desktopProcessStatusSchema>;

export const desktopProcessStatusListSchema = z
  .object({
    status: z.enum(["running", "degraded", "stopped"]).optional(),
    items: z.array(desktopProcessStatusSchema).optional(),
    running: z.number().optional(),
    total: z.number().optional(),
  })
  .catchall(z.unknown());
export type DesktopProcessStatusList = z.infer<typeof desktopProcessStatusListSchema>;

export const desktopStatusStreamEventSchema = desktopProcessStatusListSchema;
export type DesktopStatusStreamEvent = z.infer<typeof desktopStatusStreamEventSchema>;

export const desktopProcessLogsSchema = z
  .object({
    process: z.string().optional(),
    logs: z.string().optional(),
  })
  .catchall(z.unknown());
export type DesktopProcessLogs = z.infer<typeof desktopProcessLogsSchema>;

export const desktopProcessErrorsSchema = z
  .object({
    process: z.string().optional(),
    errors: z.string().optional(),
  })
  .catchall(z.unknown());
export type DesktopProcessErrors = z.infer<typeof desktopProcessErrorsSchema>;

export const desktopProcessRestartSchema = z
  .object({
    message: z.string().optional(),
    status: desktopProcessStatusSchema.optional(),
  })
  .catchall(z.unknown());
export type DesktopProcessRestart = z.infer<typeof desktopProcessRestartSchema>;
