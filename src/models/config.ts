import { z } from "zod";

export const apiKeyRequiredSchema = z.string().trim().min(1, "API key is required");
export const authHeaderSchema = z.string().trim().min(1, "authHeader cannot be empty");
export const timeoutSchema = z.number().positive("timeout must be a positive number");

export const leap0ConfigInputSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  sandboxDomain: z.string().optional(),
  timeout: z.number().positive().optional(),
  authHeader: z.string().optional(),
  bearer: z.boolean().optional(),
  sdkOtelEnabled: z.boolean().optional(),
});
/** User-provided configuration accepted by `Leap0Client`. */
export type Leap0ConfigInput = z.infer<typeof leap0ConfigInputSchema>;

export const leap0ConfigResolvedSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string(),
  sandboxDomain: z.string(),
  timeout: timeoutSchema,
  authHeader: authHeaderSchema,
  bearer: z.boolean(),
  sdkOtelEnabled: z.boolean(),
});
/** Fully resolved SDK configuration after env/default expansion. */
export type Leap0ConfigResolved = z.infer<typeof leap0ConfigResolvedSchema>;
