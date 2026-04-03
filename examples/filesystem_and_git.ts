import { Leap0Client } from "../src/index.js";

async function main(): Promise<void> {
  const client = new Leap0Client();
  const repoPath = "/workspace/hello-world";

  try {
    const sandbox = await client.sandboxes.create();

    try {
      const clone = await sandbox.git.clone({
        url: "https://github.com/octocat/Hello-World.git",
        path: repoPath,
      });
      console.log("clone exit:", clone.exitCode);

      const status = await sandbox.git.status(repoPath);
      console.log("git status:\n", status.output);

      await sandbox.filesystem.writeFile(
        `${repoPath}/sdk-demo.txt`,
        "Hello from the Leap0 JS SDK\n",
      );
      const exists = await sandbox.filesystem.exists(`${repoPath}/sdk-demo.txt`);
      console.log("file exists:", exists);

      const fileInfo = await sandbox.filesystem.stat(`${repoPath}/README`);
      console.log("readme size:", fileInfo.size);

      const tree = await sandbox.filesystem.tree(repoPath, { maxDepth: 2 });
      console.log(
        "tree items:",
        tree.items.map((entry: { name: string }) => entry.name),
      );
    } finally {
      await sandbox.delete();
    }
  } finally {
    await client.close();
  }
}

void main();
