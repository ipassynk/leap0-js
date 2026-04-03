import type {
  CreateSnapshotParams,
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
  resumeSnapshotParamsSchema,
  snapshotDataSchema,
} from "@/models/snapshot.js";
import { sandboxDataSchema, toNetworkPolicyWire } from "@/models/sandbox.js";
import { Leap0Transport, jsonBody } from "@/core/transport.js";
import { sandboxIdOf, snapshotIdOf } from "@/core/utils.js";
import { withErrorPrefix } from "@/services/shared.js";

import type { SandboxFactory } from "@/services/sandboxes.js";

/** Creates, restores, and deletes named snapshots. */
export class SnapshotsClient<T = SandboxData> {
  constructor(
    private readonly transport: Leap0Transport,
    private readonly sandboxFactory?: SandboxFactory<T>,
  ) {}

  private wrap(data: SandboxData): T {
    return (this.sandboxFactory ? this.sandboxFactory(data) : data) as T;
  }

  /** Creates a snapshot from a running sandbox. */
  async create(
    sandbox: SandboxRef,
    params: CreateSnapshotParams = {},
    options: RequestOptions = {},
  ): Promise<SnapshotData> {
    const parsed = createSnapshotParamsSchema.parse(params);
    return withErrorPrefix("Failed to create snapshot: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/snapshot/create`,
        { method: "POST", body: jsonBody(parsed) },
        options,
      );
      return normalize(snapshotDataSchema, data);
    });
  }

  /** Creates a snapshot and terminates the source sandbox. */
  async pause(
    sandbox: SandboxRef,
    params: CreateSnapshotParams = {},
    options: RequestOptions = {},
  ): Promise<SnapshotData> {
    const parsed = createSnapshotParamsSchema.parse(params);
    return withErrorPrefix("Failed to pause sandbox into snapshot: ", async () => {
      const data = await this.transport.requestJson<unknown>(
        `/v1/sandbox/${sandboxIdOf(sandbox)}/snapshot/pause`,
        { method: "POST", body: jsonBody(parsed) },
        options,
      );
      return normalize(snapshotDataSchema, data);
    });
  }

  /** Restores a sandbox from a snapshot. */
  async resume(params: ResumeSnapshotParams, options: RequestOptions = {}): Promise<T> {
    const parsed = resumeSnapshotParamsSchema.parse(params);
    return withErrorPrefix("Failed to resume snapshot: ", async () => {
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

  /** Deletes a snapshot by ID. */
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
