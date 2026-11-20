const fs = require("node:fs");
const path = require("node:path");

const MAX_LOG_BYTES = 100 * 1024 * 1024;
const MAX_RUNTIME_ARCHIVES = 4;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;
const LEVELS = new Set(["DEBUG", "INFO", "WARN", "ERROR"]);
const instances = new Map();

function safeValue(value, seen = new WeakSet()) {
  if (value instanceof Error) return {
    name: value.name, message: value.message, stack: value.stack || value.message,
    ...(value.cause !== undefined ? { cause: safeValue(value.cause, seen) } : {})
  };
  if (typeof value === "bigint") return value.toString() + "n";
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => safeValue(item, seen));
  const result = {};
  for (const [key, item] of Object.entries(value)) result[key] = safeValue(item, seen);
  return result;
}

function safeText(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try { return JSON.stringify(safeValue(value)); } catch { return String(value); }
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
    const record = {
      timestamp: new Date().toISOString(),
      level,
      scope: String(scope || "general").slice(0, 120),
      message: safeValue(message)
    };
    let line = JSON.stringify(record) + "\n";
    if (Buffer.byteLength(line, "utf8") > Math.min(maxBytes, MAX_RECORD_BYTES)) {
      record.message = "[record exceeds the configured 16 MiB diagnostic line limit]";
      line = JSON.stringify(record) + "\n";
    }
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
