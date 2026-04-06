import { z } from "zod";

export const processResultSchema = z
  .object({
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
  })
  .catchall(z.unknown());

export type ProcessResult = z.infer<typeof processResultSchema>;
