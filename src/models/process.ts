import { z } from "zod";

export const processResultSchema = z
  .object({
    exitCode: z.number(),
    result: z.string(),
  })
  .catchall(z.unknown());
export type ProcessResult = z.infer<typeof processResultSchema>;
