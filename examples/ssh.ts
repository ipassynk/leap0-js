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
    } finally {
      await sandbox.delete();
    }
  } finally {
    await client.close();
  }
}

void main();
