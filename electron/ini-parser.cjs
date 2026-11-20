const MAX_INI_BYTES = 2 * 1024 * 1024;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function parseIni(source) {
  if (typeof source !== "string") throw new TypeError("INI source must be a string");
  if (Buffer.byteLength(source, "utf8") > MAX_INI_BYTES) throw new Error("INI file is too large");
  const result = {};
  let section = result;
  let lineNumber = 0;
  for (const originalLine of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    lineNumber += 1;
    const line = originalLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      const name = line.slice(1, -1).trim();
      if (!name || FORBIDDEN_KEYS.has(name)) throw new Error("Invalid INI section at line " + lineNumber);
      if (Object.prototype.hasOwnProperty.call(result, name)) throw new Error('Duplicate INI section "' + name + '" at line ' + lineNumber);
      section = Object.create(null);
      result[name] = section;
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) throw new Error("Expected key=value at line " + lineNumber);
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (!key || FORBIDDEN_KEYS.has(key)) throw new Error("Invalid INI key at line " + lineNumber);
    if (Object.prototype.hasOwnProperty.call(section, key)) throw new Error('Duplicate INI key "' + key + '" at line ' + lineNumber);
    section[key] = parseIniValue(rawValue, lineNumber);
  }
  return result;
}
function parseIniValue(raw, lineNumber) {
  if (raw === "") return "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    const number = Number(raw);
    if (Number.isFinite(number)) return number;
  }
  if (raw.startsWith('"')) {
    try {
      const value = JSON.parse(raw);
      if (typeof value !== "string") throw new Error("Quoted INI values must be strings");
      return value;
    } catch (error) {
      throw new Error("Invalid quoted string at line " + lineNumber + ": " + error.message);
    }
  }
  if (raw.startsWith("[") || raw.startsWith("{")) throw new Error("Inline JSON values are not supported in INI files at line " + lineNumber);
  return raw;
}
module.exports = { MAX_INI_BYTES, parseIni };
