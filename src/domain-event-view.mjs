export function getRecentDomainEvents(world, limit = 30) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Domain event limit must be a positive integer");
  const events = Array.isArray(world?.domainEvents) ? world.domainEvents : [];
  return events.slice(-limit).reverse();
}
