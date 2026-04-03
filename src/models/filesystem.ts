import { z } from "zod";

export const fileInfoSchema = z
  .object({
    name: z.string(),
    path: z.string(),
    isDir: z.boolean(),
    size: z.number(),
    mode: z.string(),
    mtime: z.number(),
    owner: z.string(),
    group: z.string(),
    isSymlink: z.boolean(),
    linkTarget: z.string().optional(),
  })
  .catchall(z.unknown());
export type FileInfo = z.infer<typeof fileInfoSchema>;

export const lsResultSchema = z.object({
  items: z.array(fileInfoSchema),
});
export type LsResult = z.infer<typeof lsResultSchema>;

export const searchMatchSchema = z
  .object({
    path: z.string(),
    line: z.number(),
    content: z.string(),
  })
  .catchall(z.unknown());
export type SearchMatch = z.infer<typeof searchMatchSchema>;

export type TreeEntry = {
  name: string;
  type: "file" | "directory";
  children?: TreeEntry[];
};

export const treeEntrySchema: z.ZodType<TreeEntry> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(["file", "directory"]),
    children: z.array(treeEntrySchema).optional(),
  }),
);

export const treeResultSchema = z.object({
  items: z.array(treeEntrySchema),
});
export type TreeResult = z.infer<typeof treeResultSchema>;

export const fileEditSchema = z.object({
  find: z.string(),
  replace: z.string().nullable().optional(),
});
export type FileEdit = z.infer<typeof fileEditSchema>;

export const editFileResultSchema = z
  .object({
    diff: z.string(),
    replacements: z.number(),
  })
  .catchall(z.unknown());
export type EditFileResult = z.infer<typeof editFileResultSchema>;

export const editResultSchema = z
  .object({
    file: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  })
  .catchall(z.unknown());
export type EditResult = z.infer<typeof editResultSchema>;

export const editFilesResultSchema = z.object({
  items: z.array(editResultSchema),
});
export type EditFilesResult = z.infer<typeof editFilesResultSchema>;

export const setPermissionsParamsSchema = z
  .object({
    mode: z.string().trim().min(1).optional(),
    owner: z.string().trim().min(1).optional(),
    group: z.string().trim().min(1).optional(),
  })
  .refine(
    (params) =>
      params.mode !== undefined || params.owner !== undefined || params.group !== undefined,
    {
      message: "setPermissions requires at least one of mode, owner, or group",
    },
  );
