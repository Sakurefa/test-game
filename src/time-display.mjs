export function estimateCampaignDayFraction({ dayFraction, speed, baseDayDurationMs, elapsedMs }) {
  if (!Number.isFinite(dayFraction) || dayFraction < 0 || dayFraction >= 1) {
    throw new RangeError("Campaign display fraction must be between 0 and 1");
  }
  if (!Number.isFinite(speed) || speed < 0 || speed > 4) {
    throw new RangeError("Campaign display speed must be between 0x and 4x");
  }
  if (!Number.isFinite(baseDayDurationMs) || baseDayDurationMs <= 0) {
    throw new RangeError("Base game-day duration must be positive");
  }
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError("Elapsed display time must be non-negative");
  }
  const predicted = dayFraction + (speed === 0 ? 0 : elapsedMs * speed / baseDayDurationMs);
  // Never display the next day before the main process confirms its daily settlement.
  return Math.max(0, Math.min(0.999, predicted));
}
