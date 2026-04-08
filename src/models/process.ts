import { z } from "zod";

export const executeProcessParamsSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().optional(),
});

/** Parameters accepted when executing a one-shot process inside a sandbox. */
export type ExecuteProcessParams = z.infer<typeof executeProcessParamsSchema>;

export const processResultSchema = z
  .object({
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
  })
  .catchall(z.unknown());

/** Result of a one-shot process execution inside a sandbox. */
export type ProcessResult = z.infer<typeof processResultSchema>;
