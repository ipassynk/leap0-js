/** Sandbox identifier accepted by SDK methods as either an ID string or object with `id`. */
export type SandboxRef = string | { id: string };
/** Snapshot identifier accepted by SDK methods as either an ID string or object with `id`. */
export type SnapshotRef = string | { id: string; name?: string };
/** Template identifier accepted by SDK methods as either an ID string or object with `id`. */
export type TemplateRef = string | { id: string; name?: string };
