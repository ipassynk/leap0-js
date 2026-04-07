import { z } from "zod";

export const processResultSchema = z
  .object({
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
  })
  .catchall(z.unknown());

/** Result of a one-shot process execution inside a sandbox. */
export type ProcessResult = z.infer<typeof processResultSchema>;
