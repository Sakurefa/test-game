"use strict";

function effectTrigger(id, due, effect) {
  return {
    id: "trigger-test." + id,
    due,
    event: {
      type: "effect.apply",
      payload: { effect }
    }
  };
}

function onBeforeDay(input, api) {
  const colonyId = "new-dawn-colony";

  if (input.day === 1) {
    const colony = input.world.colonies[colonyId];
    const market = input.world.markets["new-dawn-market"];
    const choice = api.random() < 0.5 ? "route-a" : "route-b";
    const sourceGroupId = Object.keys(colony.populationGroups)[0];

    return {
      effects: [{
        type: "mod.state.set",
        payload: { key: "trigger-test-delete-me", value: "temporary" }
      }],
      events: [{
        type: "trigger-test-selection",
        payload: { choice, selectedBy: "deterministic-test-random" }
      }],
      triggers: [
        effectTrigger("01-state-set", { kind: "elapsed", days: 1 }, {
          type: "mod.state.set",
          payload: { key: "trigger-test-selection", value: choice }
        }),
        effectTrigger("02-state-increment", { kind: "elapsed", days: 1 }, {
          type: "mod.state.increment",
          payload: { key: "trigger-test-runs", delta: 1 }
        }),
        effectTrigger("03-state-delete", { kind: "elapsed", days: 1 }, {
          type: "mod.state.delete",
          payload: { key: "trigger-test-delete-me" }
        }),
        effectTrigger("04-population-delta", { kind: "elapsed", days: 1 }, {
          type: "colony.population.delta",
          payload: { colonyId, delta: 1 }
        }),
        effectTrigger("05-population-split", { kind: "elapsed", days: 1 }, {
          type: "colony.population.group.split",
          payload: {
            colonyId,
            sourceGroupId,
            newGroupId: "trigger-test-group",
            population: 1
          }
        }),
        effectTrigger("08-stability", { kind: "elapsed", days: 1 }, {
          type: "colony.stability.delta",
          payload: { colonyId, delta: 1 }
        }),
        effectTrigger("09-stockpile", { kind: "elapsed", days: 1 }, {
          type: "colony.stockpile.delta",
          payload: { colonyId, commodityId: "ore", delta: 1 }
        }),
        effectTrigger("10-market-price", { kind: "elapsed", days: 1 }, {
          type: "market.price.multiplier",
          payload: { marketId: "new-dawn-market", instrumentId: "ore", multiplier: 1.01 }
        }),
        effectTrigger("11-fleet-readiness", { kind: "elapsed", days: 1 }, {
          type: "fleet.readiness.delta",
          payload: { fleetId: "helios-border-fleet", delta: 1 }
        }),
        effectTrigger("12-fleet-morale", { kind: "elapsed", days: 1 }, {
          type: "fleet.morale.delta",
          payload: { fleetId: "helios-border-fleet", delta: 1 }
        }),
        effectTrigger("13-war-weariness", { kind: "elapsed", days: 1 }, {
          type: "war.weariness.delta",
          payload: { warId: "cinder-conflict", factionId: "helios-compact", delta: 1 }
        }),
        {
          id: "trigger-test.14-formula-effect",
          due: { kind: "elapsed", days: 1 },
          event: {
            type: "formula.effect",
            payload: {
              formulaId: "economy.commodity-price",
              inputs: {
                basePrice: 18,
                targetStock: 100,
                stock: colony.stockpiles.ore,
                priceElasticity: 0.8,
                volatility: 0.025,
                previousPrice: market.prices.ore,
                minimumPriceMultiplier: 0.1,
                maximumPriceMultiplier: 10,
                scarcityMinimum: -1,
                scarcityMaximum: 1.5,
                fundamentalMinimumMultiplier: 0.25,
                fundamentalMaximumMultiplier: 3.5,
                priceAdjustmentRate: 0.18
              },
              effects: [{
                type: "mod.state.set",
                payload: { key: "trigger-test-formula-price" },
                resultFields: { value: "price" }
              }]
            }
          }
        },
        {
          id: "trigger-test.15-event-emit",
          due: { kind: "elapsed", days: 1 },
          event: {
            type: "event.emit",
            payload: {
              type: "trigger-test-signal",
              payload: { choice }
            }
          }
        },
        effectTrigger("16-market-event-react", {
          kind: "domain-event",
          type: "mod.core.market.prices-settled",
          scope: "market",
          subjectId: "new-dawn-market"
        }, {
          type: "mod.state.increment",
          payload: { key: "trigger-test-market-event-runs", delta: 1 }
        }),
        effectTrigger("17-mod-event-react", {
          kind: "domain-event",
          type: "mod.trigger-test.trigger-test-signal",
          scope: "mod",
          subjectId: "trigger-test"
        }, {
          type: "mod.state.increment",
          payload: { key: "trigger-test-emitted-event-runs", delta: 1 }
        }),
        effectTrigger("18-date", { kind: "date", date: "2478-04-03" }, {
          type: "mod.state.increment",
          payload: { key: "trigger-test-date-runs", delta: 1 }
        }),
        effectTrigger("19-elapsed", { kind: "elapsed", days: 1 }, {
          type: "mod.state.increment",
          payload: { key: "trigger-test-elapsed-runs", delta: 1 }
        })
      ]
    };
  }

  if (input.day === 2) {
    const colony = input.world.colonies[colonyId];
    const choice = input.modState["trigger-test-selection"];
    const distribution = choice === "route-a" ? { route_a: 1 } : { route_b: 1 };

    return {
      triggers: [
        effectTrigger("06-population-merge", { kind: "elapsed", days: 1 }, {
          type: "colony.population.group.merge",
          payload: {
            colonyId,
            sourceGroupId: "trigger-test-group",
            targetGroupId: "unclassified"
          }
        }),
        effectTrigger("07-population-dimension", { kind: "elapsed", days: 1 }, {
          type: "colony.population.group.dimension.set",
          payload: {
            colonyId,
            groupId: "unclassified",
            dimensionId: "trigger-test",
            distribution
          }
        })
      ]
    };
  }

  return {};
}
