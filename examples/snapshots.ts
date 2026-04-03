import { Leap0Client } from "../src/index.js";

async function main(): Promise<void> {
  const client = new Leap0Client();

  try {
    const sandbox = await client.sandboxes.create();
    try {
      await sandbox.filesystem.writeFile("/workspace/checkpoint.txt", "before snapshot\n");

      const snapshot = await client.snapshots.create(sandbox, { name: "example-checkpoint" });
      console.log("snapshot:", snapshot.id);

      const restored = await client.snapshots.resume({
        snapshotName: snapshot.name ?? "example-checkpoint",
      });
      try {
        const content = await restored.filesystem.readFile("/workspace/checkpoint.txt");
        console.log("restored file:", content.trim());
      } finally {
        await restored.delete();
      }
    } finally {
      await sandbox.delete();
    }
  } finally {
    await client.close();
  }
}

void main();
