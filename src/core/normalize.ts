import type { z } from "zod";

function camelizeSegment(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeKeys(item));
  }

  if (
    value == null ||
    typeof value !== "object" ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [camelizeSegment(key), camelizeKeys(item)]),
  );
}

export function normalize<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(camelizeKeys(value));
}
