import type {
  CreateSnapshotParams,
  ListSnapshotsParams,
  ListSnapshotsResponse,
  RequestOptions,
  ResumeSnapshotParams,
  SandboxData,
  SandboxRef,
  SnapshotData,
  SnapshotRef,
} from "@/models/index.js";
import { normalize } from "@/core/normalize.js";
import {
  createSnapshotParamsSchema,
  listSnapshotsParamsSchema,
  listSnapshotsResponseSchema,
  resumeSnapshotParamsSchema,
  snapshotDataSchema,
} from "@/models/snapshot.js";
import { sandboxDataSchema, toNetworkPolicyWire } from "@/models/sandbox.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sandboxIdOf, snapshotIdOf } from "@/core/utils.js";
import { withErrorPrefix } from "@/services/shared.js";

/**
 * Creates, restores, and deletes named snapshots.
 *
 * @throws {Leap0Error} If request validation, API calls, or response validation fail.
 */
export class SnapshotsClient<T = SandboxData> {
  constructor(
    private readonly transport: Leap0Transport,
    private readonly sandboxFactory?: (data: SandboxData) => T,
  ) {}

  private wrap(data: SandboxData): T {
    return (this.sandboxFactory ? this.sandboxFactory(data) : data) as T;
  }

  /**
   * Lists snapshots for the authenticated organization.
   *
   * @param params Optional filter, sort, and pagination parameters.
   * @param options Optional request settings such as timeout and headers.
   * @returns Paginated snapshot summaries.
   */
  async list(
    params: ListSnapshotsParams = {},
    options: RequestOptions = {},
  ): Promise<ListSnapshotsResponse> {
    return withErrorPrefix("Failed to list snapshots: ", async () => {
      const parsed = listSnapshotsParamsSchema.parse(params);
      const data = await this.transport.requestJson<unknown>(
        "/v1/snapshots",
        { method: "GET" },
        {
          ...options,
          query: {
            ...options.query,
            query: parsed.query,
            sort: parsed.sort,
            "order-by": parsed.orderBy,
            page: parsed.page,
            "page-size": parsed.pageSize,
          },
        },
      );
      return normalize(listSnapshotsResponseSchema, data);
    });
  }

  /**
   * Creates a snapshot from a running sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Optional snapshot naming parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The created snapshot resource.
   */
  async create(
    sandbox: SandboxRef,
    params: CreateSnapshotParams = {},
    options: RequestOptions = {},
  ): Promise<SnapshotData> {
    return withErrorPrefix("Failed to create snapshot: ", async () => {
      const parsed = createSnapshotParamsSchema.parse(params);
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/snapshot/create`,
        { method: "POST", body: jsonBody(parsed) },
        options,
      );
      return normalize(snapshotDataSchema, data);
    });
  }

  /**
   * Creates a snapshot and terminates the source sandbox.
   *
   * @param sandbox Sandbox ID or sandbox-like object.
   * @param params Optional snapshot naming parameters.
   * @param options Optional request settings such as timeout and query params.
   * @returns The created snapshot resource.
   */
  async pause(
    sandbox: SandboxRef,
    params: CreateSnapshotParams = {},
    options: RequestOptions = {},
  ): Promise<SnapshotData> {
    return withErrorPrefix("Failed to pause sandbox into snapshot: ", async () => {
      const parsed = createSnapshotParamsSchema.parse(params);
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/snapshot/pause`,
        { method: "POST", body: jsonBody(parsed) },
        options,
      );
      return normalize(snapshotDataSchema, data);
    });
  }

  /**
   * Restores a sandbox from a snapshot.
   *
   * @param params Snapshot name and optional sandbox overrides.
   * @param options Optional request settings such as timeout and query params.
   * @returns The restored sandbox, optionally wrapped in a custom sandbox type.
   */
  async resume(params: ResumeSnapshotParams, options: RequestOptions = {}): Promise<T> {
    return withErrorPrefix("Failed to resume snapshot: ", async () => {
      const parsed = resumeSnapshotParamsSchema.parse(params);
      const data = await this.transport.requestJson<unknown>(
        "/v1/snapshot/resume",
        {
          method: "POST",
          body: jsonBody({
            snapshot_name: parsed.snapshotName,
            auto_pause: parsed.autoPause,
            timeout_min: parsed.timeoutMin,
            network_policy: toNetworkPolicyWire(parsed.networkPolicy),
          }),
        },
        options,
      );
      return this.wrap(normalize(sandboxDataSchema, data));
    });
  }

  /**
   * Deletes a snapshot by ID.
   *
   * @param snapshot Snapshot ID or snapshot-like object.
   * @param options Optional request settings such as timeout and query params.
   */
  async delete(snapshot: SnapshotRef, options: RequestOptions = {}): Promise<void> {
    await withErrorPrefix("Failed to delete snapshot: ", () =>
      this.transport.request(
        `/v1/snapshot/${snapshotIdOf(snapshot)}`,
        { method: "DELETE" },
        options,
      ),
    );
  }
}
