function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("Game date must use YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Invalid game date: ${value}`);
  }
  return date;
}

function addDays(dateString, days = 1) {
  if (!Number.isInteger(days) || days < 0 || days > 36500) {
    throw new RangeError("Game clock advance must be an integer between 0 and 36500 days");
  }
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createClock(startDate) {
  parseDate(startDate);
  return { date: startDate, day: 0, dayFraction: 0 };
}

function advanceClock(clock, days = 1) {
  if (!clock || !Number.isInteger(clock.day) || clock.day < 0) {
    throw new TypeError("Invalid game clock state");
  }
  const fraction = clock.dayFraction ?? 0;
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
    throw new TypeError("Invalid game clock day fraction");
  }
  return { date: addDays(clock.date, days), day: clock.day + days, dayFraction: fraction };
}

function advanceClockTime(clock, elapsedGameDays) {
  if (!Number.isFinite(elapsedGameDays) || elapsedGameDays < 0 || elapsedGameDays > 36500) {
    throw new RangeError("Elapsed game time must be between 0 and 36500 days");
  }
  const fraction = clock?.dayFraction ?? 0;
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
    throw new TypeError("Invalid game clock day fraction");
  }
  const total = fraction + elapsedGameDays;
  const wholeDays = Math.floor(total + 1e-10);
  const remainder = Math.max(0, Math.min(1 - Number.EPSILON, total - wholeDays));
  const next = advanceClock(clock, wholeDays);
  next.dayFraction = remainder < 1e-12 ? 0 : Number(remainder.toFixed(12));
  return next;
}

module.exports = { parseDate, addDays, createClock, advanceClock, advanceClockTime };
