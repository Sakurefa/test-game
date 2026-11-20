// Minimal Electron entry point. The game host itself lives in the repository.
const path = require("node:path");
const repositoryRoot = path.dirname(process.execPath);
require(path.join(repositoryRoot, "electron", "main.cjs"));
