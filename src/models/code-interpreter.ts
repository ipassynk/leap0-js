import { z } from "zod";

export const CodeLanguage = {
  PYTHON: "python",
  TYPESCRIPT: "typescript",
} as const;

export const StreamEventType = {
  STDOUT: "stdout",
  STDERR: "stderr",
  EXIT: "exit",
  ERROR: "error",
} as const;

export const codeLanguageSchema = z.enum([CodeLanguage.PYTHON, CodeLanguage.TYPESCRIPT]);
export type CodeLanguage = z.infer<typeof codeLanguageSchema>;

export const streamEventTypeSchema = z.enum([
  StreamEventType.STDOUT,
  StreamEventType.STDERR,
  StreamEventType.EXIT,
  StreamEventType.ERROR,
]);
export type StreamEventType = z.infer<typeof streamEventTypeSchema>;

export const codeContextSchema = z
  .object({
    id: z.string(),
    language: z.union([z.number(), codeLanguageSchema, z.string()]),
    cwd: z.string(),
  })
  .catchall(z.unknown());
export type CodeContext = z.infer<typeof codeContextSchema>;

export const codeExecutionOutputSchema = z
  .object({
    isPrimary: z.boolean().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    markdown: z.string().optional(),
    svg: z.string().optional(),
    png: z.string().optional(),
    jpeg: z.string().optional(),
    pdf: z.string().optional(),
    latex: z.string().optional(),
    json: z.unknown().optional(),
    javascript: z.string().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());
export type CodeExecutionOutput = z.infer<typeof codeExecutionOutputSchema>;

export const codeExecutionErrorSchema = z
  .object({
    name: z.string().optional(),
    value: z.string().optional(),
    traceback: z.string().optional(),
  })
  .catchall(z.unknown());
export type CodeExecutionError = z.infer<typeof codeExecutionErrorSchema>;

export const executionLogsSchema = z.object({
  stdout: z.array(z.string()).optional(),
  stderr: z.array(z.string()).optional(),
});
export type ExecutionLogs = z.infer<typeof executionLogsSchema>;

export const codeExecutionResultSchema = z
  .object({
    contextId: z.string(),
    items: z.array(codeExecutionOutputSchema),
    logs: executionLogsSchema,
    error: codeExecutionErrorSchema.nullable().optional(),
    executionCount: z.number().optional(),
  })
  .catchall(z.unknown());
export type CodeExecutionResult = z.infer<typeof codeExecutionResultSchema>;

export const streamEventWireSchema = z.object({
  type: z.union([z.number(), streamEventTypeSchema]),
  data: z.union([z.string(), z.number()]).optional(),
  code: z.number().optional(),
});
export type StreamEventWire = z.infer<typeof streamEventWireSchema>;

export const streamEventSchema = z.object({
  type: streamEventTypeSchema,
  data: z.union([z.string(), z.number()]).optional(),
  code: z.number().optional(),
});
export type StreamEvent = z.infer<typeof streamEventSchema>;
