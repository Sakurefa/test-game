const { performance } = require("node:perf_hooks");

const VALID_SPEEDS = new Set([0, 1, 2, 3, 4]);

function validateBaseDayDuration(value) {
  if (!Number.isFinite(value) || value < 1000 || value > 3600000) {
    throw new RangeError("Base game-day duration must be between 1 and 3600 seconds");
  }
  return value;
}

class CampaignTimeController {
  constructor({ baseDayDurationMs = 60000, onAdvance = () => {}, now = () => performance.now() } = {}) {
    this.now = now;
    this.onAdvance = onAdvance;
    this.speed = 0;
    this.setInitialDuration(baseDayDurationMs);
    this.lastTimestamp = this.readNow();
  }

  setInitialDuration(value) {
    this.baseDayDurationMs = validateBaseDayDuration(value);
  }

  readNow() {
    const value = this.now();
    if (!Number.isFinite(value)) throw new TypeError("Campaign clock source must return a finite timestamp");
    return value;
  }

  tick(timestamp = this.readNow()) {
    if (!Number.isFinite(timestamp) || timestamp < this.lastTimestamp) {
      throw new RangeError("Campaign clock timestamps must be finite and monotonic");
    }
    const elapsedMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    if (this.speed === 0 || elapsedMs === 0) return 0;
    const elapsedGameDays = elapsedMs * this.speed / this.baseDayDurationMs;
    try {
      this.onAdvance(elapsedGameDays);
    } catch (cause) {
      const error = new Error(`Campaign time advance failed: ${cause?.message || String(cause)}`, { cause });
      error.code = "CAMPAIGN_TIME_ADVANCE_FAILURE";
      throw error;
    }
    return elapsedGameDays;
  }

  setSpeed(speed) {
    if (!VALID_SPEEDS.has(speed)) throw new RangeError("Campaign speed must be pause (0) or 1x–4x");
    const timestamp = this.readNow();
    this.tick(timestamp);
    this.speed = speed;
    this.lastTimestamp = timestamp;
    return this.getState();
  }

  setBaseDayDurationMs(value) {
    const nextDuration = validateBaseDayDuration(value);
    const timestamp = this.readNow();
    this.tick(timestamp);
    this.baseDayDurationMs = nextDuration;
    this.lastTimestamp = timestamp;
    return this.getState();
  }

  pause() {
    return this.setSpeed(0);
  }

  reset() {
    this.speed = 0;
    this.lastTimestamp = this.readNow();
    return this.getState();
  }

  getState() {
    return {
      speed: this.speed,
      paused: this.speed === 0,
      baseDayDurationMs: this.baseDayDurationMs,
      baseDaySeconds: this.baseDayDurationMs / 1000
    };
  }
}

module.exports = { VALID_SPEEDS, CampaignTimeController };
