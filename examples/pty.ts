import { Leap0Client, PtyConnection } from "../src/index.js";

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("PTY websocket error")), {
      once: true,
    });
  });
}

async function main(): Promise<void> {
  const client = new Leap0Client();
  const sandbox = await client.sandboxes.create();

  try {
    const session = await sandbox.pty.create({
      sessionId: "demo-terminal",
      cols: 120,
      rows: 30,
      cwd: "/home/user",
    });

    const socket = new WebSocket(sandbox.pty.websocketUrl(session.id));
    await waitForOpen(socket);
    const connection = new PtyConnection(socket);

    try {
      connection.send("pwd\n");
      console.log(new TextDecoder().decode(await connection.recv()));
    } finally {
      connection.close();
    }
  } finally {
    await sandbox.delete();
    await client.close();
  }
}

void main();
