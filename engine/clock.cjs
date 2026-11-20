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
  return { date: startDate, day: 0 };
}

function advanceClock(clock, days = 1) {
  if (!clock || !Number.isInteger(clock.day) || clock.day < 0) {
    throw new TypeError("Invalid game clock state");
  }
  return { date: addDays(clock.date, days), day: clock.day + days };
}

module.exports = { parseDate, addDays, createClock, advanceClock };
