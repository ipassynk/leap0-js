import { z } from "zod";

export const gitResultSchema = z
  .object({
    output: z.string(),
    exitCode: z.number(),
  })
  .catchall(z.unknown());
/** Raw git command output and exit code returned by sandbox git operations. */
export type GitResult = z.infer<typeof gitResultSchema>;

export const gitCommitResultSchema = z
  .object({
    sha: z.string().optional(),
    result: gitResultSchema,
  })
  .catchall(z.unknown());
/** Result of a git commit operation, including commit SHA when available. */
export type GitCommitResult = z.infer<typeof gitCommitResultSchema>;
