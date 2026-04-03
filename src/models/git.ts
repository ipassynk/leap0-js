import { z } from "zod";

export const gitResultSchema = z
  .object({
    output: z.string(),
    exitCode: z.number(),
  })
  .catchall(z.unknown());
export type GitResult = z.infer<typeof gitResultSchema>;

export const gitCommitResultSchema = z
  .object({
    sha: z.string().optional(),
    result: gitResultSchema,
  })
  .catchall(z.unknown());
export type GitCommitResult = z.infer<typeof gitCommitResultSchema>;
