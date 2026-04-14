import { Leap0Client } from "../src/index.js";

async function main(): Promise<void> {
  const client = new Leap0Client();

  try {
    const sandbox = await client.sandboxes.create();
    try {
      const access = await sandbox.ssh.createAccess();
      console.log("ssh command:", access.sshCommand);

      const validation = await sandbox.ssh.validateAccess(access.id, access.password);
      console.log("ssh valid:", validation.valid);

      const rotated = await sandbox.ssh.regenerateAccess(access.id);
      console.log("rotated ssh command:", rotated.sshCommand);
    } finally {
      await sandbox.delete();
    }
  } finally {
    await client.close();
  }
}

void main();
