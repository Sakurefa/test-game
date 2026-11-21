export function getRecentDomainEvents(world, limit = 30) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Domain event limit must be a positive integer");
  const events = Array.isArray(world?.domainEvents) ? world.domainEvents : [];
  return events.slice(-limit).reverse();
}

function safePayload(event) {
  return event?.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? event.payload : {};
}

export function summarizeDomainEvent(event) {
  const payload = safePayload(event);
  switch (event?.type) {
    case "market.prices-settled":
      return {
        kind: "market-settled",
        titleKey: "audit.event.market_settled",
        explanationKey: "audit.explanation.market_settled",
        cadenceKey: "audit.cadence.market_daily",
        facts: [{ labelKey: "audit.field.updated_instruments", value: payload.instrumentCount ?? 0 }],
        changes: payload.changes && typeof payload.changes === "object" ? { ...payload.changes } : {}
      };
    case "war.chronology-advanced":
      return {
        kind: "war-advanced",
        titleKey: "audit.event.war_advanced",
        explanationKey: "audit.explanation.war_advanced",
        cadenceKey: "audit.cadence.war_daily",
        facts: [{ labelKey: "audit.field.war_days_active", value: payload.daysActive ?? 0 }]
      };
    case "colony.production-settled":
      return {
        kind: "colony-production",
        titleKey: "audit.event.colony_production",
        explanationKey: "audit.explanation.colony_production_event",
        cadenceKey: "audit.cadence.colony_weekly",
        facts: [
          { labelKey: "audit.field.industry_count", value: payload.industryCount ?? 0 },
          { labelKey: "audit.field.active_industry_count", value: payload.activeIndustryCount ?? 0 }
        ],
        production: payload.production && typeof payload.production === "object" ? { ...payload.production } : {}
      };
    default:
      return {
        kind: "event-driven",
        titleKey: "audit.event.other",
        explanationKey: "audit.explanation.event_driven",
        cadenceKey: "audit.cadence.event_driven",
        facts: []
      };
  }
}
