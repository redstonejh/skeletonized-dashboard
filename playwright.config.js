module.exports = {
  testDir: "./electron-tests",
  timeout: 60000,
  reporter: "list",
  use: {
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure"
  }
};
