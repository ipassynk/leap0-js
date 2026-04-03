import { z } from "zod";
import { networkPolicySchema, sandboxStateSchema } from "@/models/sandbox.js";

const snapshotNameSchema = z.string().trim().min(1).max(64);

export const snapshotDataSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    templateId: z.string(),
    vcpu: z.number(),
    memoryMib: z.number(),
    diskMib: z.number(),
    state: sandboxStateSchema.nullish(),
    networkPolicy: networkPolicySchema.optional(),
    createdAt: z.string(),
  })
  .catchall(z.unknown());
export type SnapshotData = z.infer<typeof snapshotDataSchema>;

export const createSnapshotParamsSchema = z.object({
  name: snapshotNameSchema.optional(),
});
export type CreateSnapshotParams = z.infer<typeof createSnapshotParamsSchema>;

export const resumeSnapshotParamsSchema = z.object({
  snapshotName: snapshotNameSchema,
  autoPause: z.boolean().optional(),
  timeoutMin: z.number().int().min(1).max(480).optional(),
  networkPolicy: networkPolicySchema.optional(),
});
export type ResumeSnapshotParams = z.infer<typeof resumeSnapshotParamsSchema>;
