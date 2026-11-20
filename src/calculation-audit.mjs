export function getRecentCalculationRecords(world, limit = 30) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Calculation record limit must be a positive integer");
  }
  const records = world?.audit?.calculations;
  if (!Array.isArray(records)) return [];
  return records.slice(-limit).reverse();
}
