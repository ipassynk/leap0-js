import { z } from "zod";
import { networkPolicySchema, sandboxStateSchema } from "@/models/sandbox.js";

const snapshotNameSchema = z.string().trim().min(1).max(64);

export const snapshotDataSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    templateId: z.string(),
    vcpu: z.number(),
    memory: z.number(),
    disk: z.number(),
    state: sandboxStateSchema.nullish(),
    networkPolicy: networkPolicySchema.optional(),
    createdAt: z.string(),
  })
  .catchall(z.unknown());
/** Snapshot resource returned by the control plane API. */
export type SnapshotData = z.infer<typeof snapshotDataSchema>;

export const createSnapshotParamsSchema = z.object({
  name: snapshotNameSchema.optional(),
});
/** Parameters accepted when creating or naming a snapshot. */
export type CreateSnapshotParams = z.infer<typeof createSnapshotParamsSchema>;

export const listSnapshotsParamsSchema = z.object({
  query: z.string().max(64).optional(),
  sort: z.enum(["created_at", "template_id"]).optional(),
  orderBy: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});
/** Parameters accepted when listing snapshots. */
export type ListSnapshotsParams = z.infer<typeof listSnapshotsParamsSchema>;

export const listSnapshotsResponseSchema = z
  .object({
    items: z.array(snapshotDataSchema),
    totalItems: z.number().int().nonnegative(),
  })
  .catchall(z.unknown());
/** Paginated snapshot list response. */
export type ListSnapshotsResponse = z.infer<typeof listSnapshotsResponseSchema>;

export const resumeSnapshotParamsSchema = z.object({
  snapshotName: snapshotNameSchema,
  autoPause: z.boolean().optional(),
  timeout: z.number().int().min(1).max(28800).optional(),
  networkPolicy: networkPolicySchema.optional(),
});
/** Parameters accepted when resuming a snapshot into a new sandbox. */
export type ResumeSnapshotParams = z.infer<typeof resumeSnapshotParamsSchema>;
