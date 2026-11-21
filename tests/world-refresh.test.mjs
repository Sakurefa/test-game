import test from "node:test";
import assert from "node:assert/strict";
import { getWorldDateRefreshRegions } from "../src/world-refresh.mjs";

test("overview refreshes only its recent-events region on a daily boundary", () => {
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "overview", previousDay: 3, currentDay: 4 }), ["recent-events"]);
});

test("markets and military refresh their own daily regions", () => {
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "markets", previousDay: 3, currentDay: 4 }), ["market-quotes"]);
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "military", previousDay: 3, currentDay: 4 }), ["war-chronology"]);
});

test("colony stock and daily needs view refreshes at every daily boundary", () => {
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "colonies", previousDay: 5, currentDay: 6 }), ["colony-production"]);
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "colonies", previousDay: 6, currentDay: 7 }), ["colony-production"]);
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "colonies", previousDay: 13, currentDay: 14 }), ["colony-production"]);
});

test("catch-up across several days refreshes a due region once with the final snapshot", () => {
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "colonies", previousDay: 4, currentDay: 18 }), ["colony-production"]);
});

test("unknown tabs and non-advancing or invalid clocks request no region refresh", () => {
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "unknown", previousDay: 1, currentDay: 2 }), []);
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "overview", previousDay: 2, currentDay: 2 }), []);
  assert.deepEqual(getWorldDateRefreshRegions({ activeTab: "overview", previousDay: 3, currentDay: 2 }), []);
});
