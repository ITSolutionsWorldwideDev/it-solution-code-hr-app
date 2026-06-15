const { spawn } = require("child_process");

const child = spawn("npm", ["run", "start", "--", "-p", "3000"], {
  stdio: "inherit",
  shell: true,
  cwd: __dirname
});

child.on("close", (code) => process.exit(code));
