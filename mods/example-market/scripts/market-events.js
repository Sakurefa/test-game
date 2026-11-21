function onCampaignAfterDay(input) {
  if (input.day % 30 !== 0) return {};

  const markets = Object.values(input.world.markets || {});
  const quoteCount = markets.reduce(
    (total, market) => total + Object.keys(market.prices || {}).length,
    0
  );

  return {
    events: [{
      type: "monthly-market-observation",
      payload: {
        day: input.day,
        marketCount: markets.length,
        quoteCount
      }
    }]
  };
}
