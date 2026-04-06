import { Leap0Client } from "../src/index.js";

async function main(): Promise<void> {
  const client = new Leap0Client();
  let sandbox: Awaited<ReturnType<Leap0Client["sandboxes"]["create"]>> | undefined;

  try {
    sandbox = await client.sandboxes.create();
    const result = await sandbox.process.execute({ command: "echo hello from leap0" });
    console.log("sandbox:", sandbox.id);
    console.log("exit code:", result.exitCode);
    console.log("stdout:", result.stdout.trim());
    console.log("stderr:", result.stderr.trim());
  } finally {
    if (sandbox) {
      await sandbox.delete();
    }
    await client.close();
  }
}

void main();
