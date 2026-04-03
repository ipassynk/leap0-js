import { z } from "zod";

export const ptySessionSchema = z
  .object({
    id: z.string(),
    cwd: z.string(),
    envs: z.record(z.string(), z.string()),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    createdAt: z.string(),
    active: z.boolean(),
    lazyStart: z.boolean(),
  })
  .catchall(z.unknown());
export type PtySession = z.infer<typeof ptySessionSchema>;

export const createPtySessionParamsSchema = z.object({
  sessionId: z.string().optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  cwd: z.string().optional(),
  envs: z.record(z.string(), z.string()).optional(),
  lazyStart: z.boolean().optional(),
});
export type CreatePtySessionParams = z.infer<typeof createPtySessionParamsSchema>;
