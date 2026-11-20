const WORLD_VIEW_REFRESH_POLICIES = Object.freeze([
  { id: "recent-events", tab: "overview", cadence: "daily" },
  { id: "colony-production", tab: "colonies", cadence: "weekly" },
  { id: "market-quotes", tab: "markets", cadence: "daily" },
  { id: "war-chronology", tab: "military", cadence: "daily" }
]);

export function getWorldDateRefreshRegions({ activeTab, previousDay, currentDay }) {
  if (!Number.isInteger(previousDay) || previousDay < 0
    || !Number.isInteger(currentDay) || currentDay <= previousDay) return [];

  const crossedWeekBoundary = Math.floor(currentDay / 7) > Math.floor(previousDay / 7);
  return WORLD_VIEW_REFRESH_POLICIES
    .filter((policy) => policy.tab === activeTab
      && (policy.cadence === "daily" || crossedWeekBoundary))
    .map((policy) => policy.id);
}
