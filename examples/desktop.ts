import { writeFile } from "node:fs/promises";

import { DEFAULT_DESKTOP_TEMPLATE_NAME, Leap0Client } from "../src/index.js";

async function main(): Promise<void> {
  const client = new Leap0Client();

  try {
    const sandbox = await client.sandboxes.create({ templateName: DEFAULT_DESKTOP_TEMPLATE_NAME });
    try {
      await sandbox.desktop.waitUntilReady(60);
      console.log("Desktop:", sandbox.desktop.desktopUrl());

      const display = await sandbox.desktop.displayInfo();
      console.log("Display:", display);

      await sandbox.desktop.movePointer(
        Math.floor(display.width / 2),
        Math.floor(display.height / 2),
      );
      await sandbox.desktop.click({ button: 1 });

      const screenshot = await sandbox.desktop.screenshot();
      await writeFile("desktop-screenshot.png", screenshot);
      console.log("Saved screenshot to desktop-screenshot.png");
    } finally {
      await sandbox.delete();
    }
  } finally {
    await client.close();
  }
}

void main();
