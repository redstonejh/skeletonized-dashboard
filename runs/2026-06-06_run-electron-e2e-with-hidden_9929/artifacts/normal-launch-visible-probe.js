const { _electron: electron } = require("@playwright/test");
const path = require("node:path");

(async () => {
  const env = { ...process.env };
  delete env.MAW_HEADLESS;
  const app = await electron.launch({ args: [path.join(__dirname, "..", "..", "..")], env });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    const result = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return { hasWindow: Boolean(win), visible: Boolean(win?.isVisible()) };
    });
    console.log(JSON.stringify({ check: "normal_launch_visible", passed: result.hasWindow && result.visible, result }));
    process.exitCode = result.hasWindow && result.visible ? 0 : 1;
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
