import { z } from "zod";

export const lspResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .catchall(z.unknown());
export type LspResponse = z.infer<typeof lspResponseSchema>;

export const lspJsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type LspJsonRpcError = z.infer<typeof lspJsonRpcErrorSchema>;

export const lspJsonRpcResponseSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number(), z.null()]),
    result: z.unknown().optional(),
    error: lspJsonRpcErrorSchema.optional(),
  })
  .refine((value) => (value.result === undefined) !== (value.error === undefined), {
    message: "Exactly one of result or error must be present",
  });
export type LspJsonRpcResponse<T = unknown> = Omit<
  z.infer<typeof lspJsonRpcResponseSchema>,
  "result"
> & { result?: T };
