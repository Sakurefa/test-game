// Earliest repository-side entry point. The executable itself stays a small Electron runtime.
const path = require("node:path");
const repositoryRoot = path.dirname(process.execPath);
const logger = require(path.join(repositoryRoot, "electron", "logger.cjs")).getLogger(repositoryRoot);

logger.startup("INFO", "bootstrap", "Bootstrap entered");
logger.startup("INFO", "bootstrap", `Platform=${process.platform}; Electron=${process.versions.electron}; Node=${process.versions.node}`);

process.on("uncaughtException", (error) => {
  logger.error("process.uncaughtException", error);
});
process.on("unhandledRejection", (reason) => {
  logger.error("process.unhandledRejection", reason);
});

try {
  require(path.join(repositoryRoot, "electron", "main.cjs"));
} catch (error) {
  logger.startup("ERROR", "bootstrap", error);
  throw error;
}
