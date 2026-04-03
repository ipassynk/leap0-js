import { Leap0Error } from "@/core/errors.js";
import { normalize } from "@/core/normalize.js";
import type {
  CreateTemplateParams,
  RequestOptions,
  TemplateData,
  TemplateRef,
} from "@/models/index.js";
import { createTemplateParamsSchema, templateDataSchema } from "@/models/template.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { templateIdOf } from "@/core/utils.js";
import { withErrorPrefix } from "@/services/shared.js";

/** Uploads and manages reusable container templates. */
export class TemplatesClient {
  constructor(private readonly transport: Leap0Transport) {}

  /** Uploads a new template from a container image URI. */
  async create(params: CreateTemplateParams, options: RequestOptions = {}): Promise<TemplateData> {
    const parsed = createTemplateParamsSchema.parse(params);

    if (
      !parsed.name.trim() ||
      parsed.name.length > 64 ||
      /\s/.test(parsed.name) ||
      parsed.name.startsWith("system/")
    ) {
      throw new Leap0Error(
        "name must be non-empty, <= 64 chars, contain no whitespace, and not start with system/",
      );
    }
    if (!parsed.uri.trim() || parsed.uri.length > 500) {
      throw new Leap0Error("uri must be non-empty and <= 500 chars");
    }
    return withErrorPrefix("Failed to create template: ", async () => {
      const data = await this.transport.requestJson<TemplateData>(
        "/v1/template",
        { method: "POST", body: jsonBody(parsed) },
        options,
      );
      return normalize(templateDataSchema, data);
    });
  }

  /** Renames a template. */
  async rename(
    template: TemplateRef,
    params: { name: string },
    options: RequestOptions = {},
  ): Promise<void> {
    await withErrorPrefix("Failed to rename template: ", () =>
      this.transport.request(
        `/v1/template/${templateIdOf(template)}`,
        { method: "PATCH", body: jsonBody(params) },
        options,
      ),
    );
  }

  /** Deletes a template by ID. */
  async delete(template: TemplateRef, options: RequestOptions = {}): Promise<void> {
    await withErrorPrefix("Failed to delete template: ", () =>
      this.transport.request(
        `/v1/template/${templateIdOf(template)}`,
        { method: "DELETE" },
        options,
      ),
    );
  }
}
