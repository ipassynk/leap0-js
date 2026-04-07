import { DEFAULT_BASE_URL } from "@/config/constants.js";
import type { SandboxRef, SnapshotRef, TemplateRef } from "@/models/index.js";

/**
 * Extracts a sandbox ID from a string or sandbox-like object.
 *
 * @param sandbox Sandbox reference value.
 * @returns The sandbox ID string.
 */
export function sandboxIdOf(sandbox: SandboxRef): string {
  return typeof sandbox === "string" ? sandbox : sandbox.id;
}

/**
 * Extracts a snapshot ID from a string or snapshot-like object.
 *
 * @param snapshot Snapshot reference value.
 * @returns The snapshot ID string.
 */
export function snapshotIdOf(snapshot: SnapshotRef): string {
  return typeof snapshot === "string" ? snapshot : snapshot.id;
}

/**
 * Extracts a template ID from a string or template-like object.
 *
 * @param template Template reference value.
 * @returns The template ID string.
 */
export function templateIdOf(template: TemplateRef): string {
  return typeof template === "string" ? template : template.id;
}

/**
 * Removes trailing slashes from a string.
 *
 * @param value Value to normalize.
 * @returns The normalized string.
 */
export function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Ensures a path starts with a leading slash.
 *
 * @param value Path fragment to normalize.
 * @returns The normalized path.
 */
export function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

/**
 * Builds the public base URL for a sandbox host.
 *
 * @param sandboxId Sandbox identifier.
 * @param sandboxDomain Shared sandbox domain suffix.
 * @param port Optional forwarded port.
 * @returns The HTTPS origin for the sandbox.
 */
export function sandboxBaseUrl(sandboxId: string, sandboxDomain: string, port?: number): string {
  const host =
    port == null ? `${sandboxId}.${sandboxDomain}` : `${sandboxId}-${port}.${sandboxDomain}`;
  return `https://${host}`;
}

/**
 * Converts an HTTP sandbox URL to a websocket URL.
 *
 * @param url HTTP or HTTPS URL.
 * @returns The websocket URL.
 */
export function websocketUrlFromHttp(url: string): string {
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
}

/**
 * Appends query parameters to a request path.
 *
 * @param path Path to append query parameters to.
 * @param query Query values to serialize.
 * @returns The path with query string applied.
 */
export function withQuery(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(path, DEFAULT_BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

/**
 * Converts a filesystem path into a file URI.
 *
 * @param path Absolute or relative file path.
 * @returns The corresponding file URI.
 */
export function toFileUri(path: string): string {
  if (path.startsWith("file://")) return path;
  return `file://${path.startsWith("/") ? "" : "/"}${path}`;
}
