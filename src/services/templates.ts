import { normalize } from "@/core/normalize.js";
import type {
  CreateTemplateParams,
  RenameTemplateParams,
  RequestOptions,
  TemplateData,
  TemplateRef,
} from "@/models/index.js";
import {
  createTemplateRequestSchema,
  renameTemplateParamsSchema,
  templateDataSchema,
  templateNameSchema,
} from "@/models/template.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { templateIdOf } from "@/core/utils.js";
import { withErrorPrefix } from "@/services/shared.js";

/**
 * Uploads and manages reusable container templates.
 *
 * @throws {Leap0Error} If request validation, API calls, or response validation fail.
 */
export class TemplatesClient {
  constructor(private readonly transport: Leap0Transport) {}

  private validateTemplateName(name: string): string {
    return templateNameSchema.parse(name);
  }

  /**
   * Uploads a new template from a container image URI.
   *
   * @param params.name Template name to create.
   * @param params.uri Container image URI to import.
   * @param params.credentials Optional private registry credentials.
   * @param options Optional request settings such as timeout and query params.
   * @returns The created template.
   */
  async create(params: CreateTemplateParams, options: RequestOptions = {}): Promise<TemplateData> {
    const parsed = createTemplateRequestSchema.parse(params);
    return withErrorPrefix("Failed to create template: ", async () => {
      const data = await this.transport.requestJson<TemplateData>(
        "/v1/template",
        { method: "POST", body: jsonBody(parsed) },
        options,
      );
      return normalize(templateDataSchema, data);
    });
  }

  /**
   * Renames a template.
   *
   * @param template Template ID or template-like object.
   * @param params New template name.
   * @param options Optional request settings such as timeout and query params.
   */
  async rename(
    template: TemplateRef,
    params: RenameTemplateParams,
    options: RequestOptions = {},
  ): Promise<void> {
    const parsed = renameTemplateParamsSchema.parse(params);
    this.validateTemplateName(parsed.name);
    await withErrorPrefix("Failed to rename template: ", async () => {
      await this.transport.request(
        `/v1/template/${templateIdOf(template)}`,
        { method: "PATCH", body: jsonBody(parsed) },
        options,
      );
    });
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
