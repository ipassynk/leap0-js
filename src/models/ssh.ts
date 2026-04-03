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
export type SshAccess = z.infer<typeof sshAccessSchema>;

export const sshValidationSchema = z
  .object({
    valid: z.boolean(),
    sandboxId: z.string(),
  })
  .catchall(z.unknown());
export type SshValidation = z.infer<typeof sshValidationSchema>;
