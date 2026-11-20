const fs = require("node:fs");
const path = require("node:path");

const MAX_LOG_BYTES = 25 * 1024 * 1024;
const MAX_RUNTIME_ARCHIVES = 3;
const LEVELS = new Set(["DEBUG", "INFO", "WARN", "ERROR"]);
const instances = new Map();

function safeText(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function createLogger(root, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_LOG_BYTES;
  const logDirectory = path.join(root, "Logs");
  const startupFile = path.join(logDirectory, "startup.log");
  const runtimeFile = path.join(logDirectory, "runtime.log");
  let ready = false;

  function ensureDirectory() {
    if (!ready) {
      fs.mkdirSync(logDirectory, { recursive: true });
      ready = true;
    }
  }

  function rotateRuntime(incomingBytes) {
    ensureDirectory();
    let currentSize = 0;
    try { currentSize = fs.statSync(runtimeFile).size; } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (currentSize + incomingBytes <= maxBytes) return;

    const oldest = path.join(logDirectory, `runtime.${MAX_RUNTIME_ARCHIVES}.log`);
    try { fs.rmSync(oldest, { force: true }); } catch {}
    for (let index = MAX_RUNTIME_ARCHIVES - 1; index >= 1; index -= 1) {
      const from = path.join(logDirectory, `runtime.${index}.log`);
      const to = path.join(logDirectory, `runtime.${index + 1}.log`);
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    if (fs.existsSync(runtimeFile)) fs.renameSync(runtimeFile, path.join(logDirectory, "runtime.1.log"));
  }

  function write(level, scope, message, startup = false) {
    if (!LEVELS.has(level)) level = "INFO";
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] [${String(scope || "general").slice(0, 80)}] ${safeText(message)}\n`;
    const bytes = Buffer.byteLength(line, "utf8");
    try {
      ensureDirectory();
      if (startup) {
        let size = 0;
        try { size = fs.statSync(startupFile).size; } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (size + bytes <= maxBytes) fs.appendFileSync(startupFile, line, "utf8");
        return;
      }
      rotateRuntime(bytes);
      fs.appendFileSync(runtimeFile, line, "utf8");
    } catch (error) {
      // Logging must never recursively crash the application.
      try { process.stderr.write(`[logger failure] ${error.message}\n`); } catch {}
    }
  }

  return {
    debug: (scope, message) => write("DEBUG", scope, message),
    info: (scope, message) => write("INFO", scope, message),
    warn: (scope, message) => write("WARN", scope, message),
    error: (scope, message) => write("ERROR", scope, message),
    startup: (level, scope, message) => write(level, scope, message, true),
    directory: logDirectory
  };
}

function getLogger(root) {
  const key = path.resolve(root);
  if (!instances.has(key)) instances.set(key, createLogger(key));
  return instances.get(key);
}

module.exports = { MAX_LOG_BYTES, MAX_RUNTIME_ARCHIVES, createLogger, getLogger };
