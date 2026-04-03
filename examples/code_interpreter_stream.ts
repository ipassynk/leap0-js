import {
  CodeLanguage,
  DEFAULT_CODE_INTERPRETER_TEMPLATE_NAME,
  Leap0Client,
  StreamEvent,
} from "../src/index.js";

async function main(): Promise<void> {
  const client = new Leap0Client();

  try {
    const sandbox = await client.sandboxes.create({
      templateName: DEFAULT_CODE_INTERPRETER_TEMPLATE_NAME,
    });

    try {
      for await (const event of sandbox.codeInterpreter.executeStream(
        {
          code: "import time\nfor i in range(3):\n    print(f'step {i}')\n    time.sleep(1)",
          language: CodeLanguage.PYTHON,
        },
        { timeout: 10 },
      )) {
        const typedEvent: StreamEvent = event;
        console.log(typedEvent);
      }
    } finally {
      await sandbox.delete();
    }
  } finally {
    await client.close();
  }
}

void main();
