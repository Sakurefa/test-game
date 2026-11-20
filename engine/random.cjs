const DEFAULT_SEED = 0x6d2b79f5;

function hashSeed(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value >>> 0;
  const text = String(value ?? "frontier");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

class SeededRandom {
  constructor(seed = DEFAULT_SEED, state = undefined) {
    this.seed = hashSeed(seed);
    this.state = state === undefined ? this.seed : hashSeed(state);
    if (this.state === 0) this.state = DEFAULT_SEED;
  }

  nextUint32() {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  next() {
    return this.nextUint32() / 0x100000000;
  }

  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError("Random integer bounds must be ordered integers");
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError("Random range bounds must be finite and ordered");
    }
    return min + this.next() * (max - min);
  }

  chance(probability) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError("Probability must be between 0 and 1");
    }
    return this.next() < probability;
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new RangeError("Cannot pick from an empty collection");
    }
    return values[this.int(0, values.length - 1)];
  }

  snapshot() {
    return { seed: this.seed, state: this.state >>> 0 };
  }
}

const STREAM_ID_PATTERN = /^[a-z][a-z0-9._:-]{1,127}$/;

class NamedRandomStreams {
  constructor(seed = DEFAULT_SEED, savedStreams = {}) {
    this.seed = hashSeed(seed);
    if (!savedStreams || typeof savedStreams !== "object" || Array.isArray(savedStreams)) {
      throw new TypeError("Saved named random streams must be an object");
    }
    this.streams = new Map();
    for (const [id, saved] of Object.entries(savedStreams)) {
      if (!STREAM_ID_PATTERN.test(id)) throw new Error("Invalid random stream ID: " + id);
      if (!saved || typeof saved !== "object" || !Number.isInteger(saved.seed)
        || !Number.isInteger(saved.state)) {
        throw new Error("Invalid saved random stream state: " + id);
      }
      const expectedSeed = this.deriveSeed(id);
      if ((saved.seed >>> 0) !== expectedSeed) {
        throw new Error("Random stream seed does not match its stable ID: " + id);
      }
      this.streams.set(id, new SeededRandom(expectedSeed, saved.state));
    }
  }

  deriveSeed(id) {
    return hashSeed(String(this.seed) + ":" + id);
  }

  get(id) {
    if (typeof id !== "string" || !STREAM_ID_PATTERN.test(id)) {
      throw new TypeError("Random stream requires a stable lowercase ID");
    }
    if (!this.streams.has(id)) this.streams.set(id, new SeededRandom(this.deriveSeed(id)));
    return this.streams.get(id);
  }

  snapshot() {
    const streams = {};
    for (const id of [...this.streams.keys()].sort()) {
      streams[id] = this.streams.get(id).snapshot();
    }
    return { seed: this.seed, streams };
  }
}

module.exports = { DEFAULT_SEED, hashSeed, SeededRandom, NamedRandomStreams };
