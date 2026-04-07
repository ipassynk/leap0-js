import { z } from "zod";

export const sshAccessSchema = z
  .object({
    id: z.string(),
    sandboxId: z.string(),
    password: z.string(),
    expiresAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    sshCommand: z.string(),
  })
  .catchall(z.unknown());
/** SSH credential bundle generated for sandbox access. */
export type SshAccess = z.infer<typeof sshAccessSchema>;

export const sshValidationSchema = z
  .object({
    valid: z.boolean(),
    sandboxId: z.string(),
  })
  .catchall(z.unknown());
/** Result of validating an SSH credential pair. */
export type SshValidation = z.infer<typeof sshValidationSchema>;
