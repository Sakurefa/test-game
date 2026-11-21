export function getRecentCalculationRecords(world, limit = 30) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Calculation record limit must be a positive integer");
  const records = world?.audit?.calculations;
  if (!Array.isArray(records)) return [];
  return records.slice(-limit).reverse();
}

function stepValue(record, stepId) {
  const step = record?.steps?.find((item) => item.id === stepId);
  return Number.isFinite(step?.value) ? step.value : null;
}

function safeRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function summarizeCalculationRecord(record) {
  const inputs = safeRecord(record?.inputs);
  const result = safeRecord(record?.result);

  switch (record?.formulaId) {
    case "economy.commodity-price": {
      const scarcity = stepValue(record, "scarcity");
      const statusKey = scarcity === null ? "audit.status.unknown"
        : scarcity > 0 ? "audit.status.stock_scarce"
          : scarcity < 0 ? "audit.status.stock_surplus" : "audit.status.stock_balanced";
      return {
        kind: "commodity-price",
        titleKey: "audit.formula.commodity_price",
        explanationKey: scarcity === null ? "audit.explanation.formula_unknown"
          : scarcity > 0 ? "audit.explanation.commodity_scarce"
            : scarcity < 0 ? "audit.explanation.commodity_surplus" : "audit.explanation.commodity_balanced",
        statusKey,
        facts: [
          { labelKey: "audit.field.current_stock", value: inputs.stock, commodityUnit: true },
          { labelKey: "audit.field.target_stock", value: inputs.targetStock, commodityUnit: true },
          { labelKey: "audit.field.previous_price", value: inputs.previousPrice, suffix: " CR" },
          { labelKey: "audit.field.current_price", value: result.price, suffix: " CR" },
          { labelKey: "audit.field.daily_change", value: result.change, suffix: "%" }
        ]
      };
    }
    case "economy.security-price": {
      const change = Number.isFinite(result.change) ? result.change : null;
      const statusKey = change === null ? "audit.status.unknown"
        : change > 0 ? "audit.status.price_up" : change < 0 ? "audit.status.price_down" : "audit.status.price_steady";
      return {
        kind: "security-price",
        titleKey: "audit.formula.security_price",
        explanationKey: "audit.explanation.security_price",
        statusKey,
        facts: [
          { labelKey: "audit.field.previous_price", value: inputs.previousPrice, suffix: " CR" },
          { labelKey: "audit.field.current_price", value: result.price, suffix: " CR" },
          { labelKey: "audit.field.daily_change", value: change, suffix: "%" },
          { labelKey: "audit.field.issuer_output_signal", value: inputs.outputValue }
        ]
      };
    }
    case "economy.population-needs": {
      const needs = Object.entries(result.requested || {}).map(([commodityId, requested]) => ({
        commodityId,
        requested,
        consumed: result.consumed?.[commodityId] ?? 0,
        unmet: result.unmet?.[commodityId] ?? 0,
        satisfaction: result.satisfaction?.[commodityId] ?? 1,
        available: inputs.requirements?.find((item) => item.commodityId === commodityId)?.available ?? 0
      }));
      const shortageCount = needs.filter((item) => item.unmet > 0).length;
      return {
        kind: "population-needs",
        titleKey: "audit.formula.population_needs",
        explanationKey: shortageCount > 0
          ? "audit.explanation.population_needs_shortage"
          : "audit.explanation.population_needs_met",
        statusKey: shortageCount > 0 ? "audit.status.needs_shortage" : "audit.status.needs_met",
        facts: [
          { labelKey: "audit.field.population", value: inputs.population },
          { labelKey: "audit.field.need_count", value: needs.length },
          { labelKey: "audit.field.shortage_count", value: shortageCount }
        ],
        needs
      };
    }
    case "economy.colony-production": {
      const actual = result.batchScale;
      const statusKey = Number.isFinite(actual) && actual <= 0 ? "audit.status.no_output"
        : result.limitingInput ? "audit.status.production_limited" : "audit.status.production_normal";
      return {
        kind: "colony-production",
        titleKey: "audit.formula.colony_production",
        explanationKey: "audit.explanation.colony_production",
        statusKey,
        facts: [
          { labelKey: "audit.field.stability_efficiency", value: result.efficiency, percentScale: 100, suffix: "%" },
          { labelKey: "audit.field.requested_batches", value: result.requestedBatches },
          { labelKey: "audit.field.actual_batches", value: actual }
        ],
        inputs: Array.isArray(inputs.recipeInputs) ? inputs.recipeInputs.map((item) => ({
          commodityId: item.commodityId, perBatch: item.quantity, available: item.available
        })) : [],
        limitingInput: typeof result.limitingInput === "string" ? result.limitingInput : null,
        consumed: safeRecord(result.consumed),
        produced: safeRecord(result.produced)
      };
    }
    default:
      return {
        kind: "unknown",
        titleKey: "audit.formula.unknown",
        explanationKey: "audit.explanation.formula_unknown",
        statusKey: "audit.status.unknown",
        facts: []
      };
  }
}
