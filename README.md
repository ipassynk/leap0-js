# Leap0 JS SDK

TypeScript SDK for [Leap0](https://leap0.dev), enterprise-grade cloud sandboxes for AI agents.

Launch isolated sandboxes in milliseconds. Give each agent its own compute, filesystem, and network boundary while keeping a simple typed Node.js API.

## Installation

This SDK is Node.js-only and requires Node.js 20.6.0 or newer.

```bash
npm install leap0
```

## Requirements

- Node.js 20.6.0+
- A Leap0 API key

### Getting an API key

1. Sign up at [app.leap0.dev](https://app.leap0.dev).
2. Copy your API key from the dashboard.
3. Set it as an environment variable:

```bash
export LEAP0_API_KEY="your-api-key"
```

Or pass it directly when creating a client:

```ts
import { Leap0Client } from "leap0";

const client = new Leap0Client({ apiKey: "your-api-key" });
```

## Quick Start

```ts
import { Leap0Client } from "leap0";

const client = new Leap0Client();
const sandbox = await client.sandboxes.create();

try {
  const result = await sandbox.process.execute({ command: "echo hello from leap0" });
  console.log(result.result.trim());
} finally {
  await sandbox.delete();
  await client.close();
}
```

## Features

### Code Interpreter

Stateful code execution with streaming output.

```ts
import { CodeLanguage, DEFAULT_CODE_INTERPRETER_TEMPLATE_NAME } from "leap0";

const sandbox = await client.sandboxes.create({
  templateName: DEFAULT_CODE_INTERPRETER_TEMPLATE_NAME,
});
const result = await sandbox.codeInterpreter.execute({
  code: "x = 42",
  language: CodeLanguage.PYTHON,
});
```

### Filesystem

Read, write, search, and inspect files inside a sandbox.

```ts
await sandbox.filesystem.writeFile("/workspace/hello.txt", "Hello!");
const content = await sandbox.filesystem.readFile("/workspace/hello.txt");
const tree = await sandbox.filesystem.tree("/workspace", 2);
```

### Git

Clone repositories and run Git operations inside the sandbox.

```ts
await sandbox.git.clone("https://github.com/octocat/Hello-World.git", "/workspace/repo");
const status = await sandbox.git.status("/workspace/repo");
```

### Process Execution

Run one-off shell commands inside a running sandbox.

```ts
const result = await sandbox.process.execute({ command: "ls -la /workspace" });
console.log(result.result);
```

### Interactive Terminal (PTY)

Open persistent terminal sessions over WebSocket.

```ts
const session = await sandbox.pty.create({ cols: 120, rows: 30, cwd: "/home/user" });
```

### Language Server Protocol (LSP)

Use language servers for completions and editor-style workflows.

```ts
await sandbox.lsp.start({ languageId: "python", pathToProject: "/workspace" });
```

### SSH Access

Generate temporary SSH credentials for direct sandbox access.

```ts
const access = await sandbox.ssh.createAccess();
console.log(access.hostname, access.port, access.username);
```

### Desktop Automation

Control a graphical desktop inside the sandbox.

```ts
const screenshot = await sandbox.desktop.screenshot();
```

### Snapshots

Save and restore sandbox state.

```ts
const snapshot = await client.snapshots.create(sandbox, { name: "my-checkpoint" });
const restored = await client.snapshots.resume({ snapshotName: snapshot.name ?? "my-checkpoint" });
```

## Supported Imports

Import clients, enums, and types from the package root:

```ts
import { Leap0Client, SandboxState, type CreateSandboxParams } from "leap0";
```

## Examples

See `examples/` for end-to-end usage patterns:

- **[`quickstart.ts`](examples/quickstart.ts)** - Basic code execution
- **[`code_interpreter_stream.ts`](examples/code_interpreter_stream.ts)** - Streaming code execution output
- **[`filesystem_and_git.ts`](examples/filesystem_and_git.ts)** - File and Git operations
- **[`pty.ts`](examples/pty.ts)** - Interactive terminal session
- **[`desktop.ts`](examples/desktop.ts)** - Desktop GUI automation
- **[`snapshots.ts`](examples/snapshots.ts)** - Save and restore sandbox state
- **[`ssh.ts`](examples/ssh.ts)** - Generate and validate SSH access

## Runtime Support

- Node.js 20.6.0+
- ESM package (`"type": "module"`)
- Uses Node-specific APIs including `process.env`, OpenTelemetry Node providers, and `User-Agent` request headers

## Documentation

Full documentation is available at [leap0.dev/docs](https://leap0.dev/docs).

## License

Apache License 2.0. See `LICENSE` for details.
