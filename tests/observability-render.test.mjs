import test from "node:test";
import assert from "node:assert/strict";
import { renderCalculationAuditPanel, renderDomainEventPanel, renderWorldRegion } from "../src/world.js";

const localization = {
  "audit.formula.commodity_price": "商品报价调整",
  "audit.explanation.commodity_scarce": "库存低于目标，稀缺因素推高目标价。",
  "audit.status.stock_scarce": "库存低于目标",
  "audit.field.current_stock": "当前库存",
  "audit.field.target_stock": "目标库存",
  "audit.field.previous_price": "上次报价",
  "audit.field.current_price": "本次报价",
  "audit.field.daily_change": "本次变动",
  "audit.random_draws": "随机抽取次数",
  "audit.raw_calculation": "查看原始计算记录",
  "audit.raw_inputs": "原始输入参数",
  "audit.raw_steps": "公式中间步骤",
  "audit.raw_modifiers": "公式修正项",
  "audit.raw_random": "实际随机抽取",
  "audit.raw_result": "公式最终结果",
  "audit.calculation_panel": "计算审计",
  "audit.close": "关闭",
  "audit.calculation_footer": "只读计算记录",
  "audit.event.colony_production": "殖民地周生产结算",
  "audit.explanation.colony_production_event": "殖民地本周生产结算已经完成。",
  "audit.cadence.colony_weekly": "每座殖民地每周一次（第 7、14、21 天）",
  "audit.field.industry_count": "设施总数",
  "audit.field.active_industry_count": "实际开工设施",
  "audit.field.production_output": "本周实际产出",
  "audit.raw_event": "查看原始事件数据",
  "audit.raw_metadata": "事件元数据",
  "audit.raw_payload": "事件载荷",
  "audit.event_panel": "世界事件",
  "audit.event_history_retention": "世界保留上限 300 条",
  "audit.event_footer": "只读事件记录",
  "audit.no_subject": "无主体",
  "entity.new-dawn-colony.name": "新曙光殖民地",
  "entity.market.name": "新曙光市场",
  "entity.ore.name": "矿石",
  "entity.ore.unit": "吨",
  "entity.water.name": "水",
  "entity.water.unit": "吨",
  "entity.food.name": "食品",
  "entity.food.unit": "吨",
  "audit.formula.population_needs": "人口日常需求",
  "audit.explanation.population_needs_shortage": "库存不足以满足全部日常需求。",
  "audit.status.needs_shortage": "供应不足",
  "audit.field.population": "人口",
  "audit.field.need_count": "需求品种",
  "audit.field.shortage_count": "短缺品种",
  "audit.event.colony_needs": "殖民地日常需求结算",
  "audit.explanation.colony_needs_shortage_event": "日常需求结算存在供应短缺。",
  "audit.cadence.colony_needs_daily": "预期频率：每座殖民地每天一次"
};

function snapshot() {
  return {
    localization,
    world: {
      audit: { calculations: [] },
      domainEvents: []
    },
    markets: [{
      id: "new-dawn-market",
      nameKey: "entity.market.name",
      instruments: [{ id: "ore", kind: "commodity", name: "矿石", unit: "吨" }]
    }],
    colonies: [{ id: "new-dawn-colony", nameKey: "entity.new-dawn-colony.name" }],
    wars: [],
    commodities: [{ id: "ore", nameKey: "entity.ore.name", unitKey: "entity.ore.unit" }]
  };
}

test("calculation panel leads with a localized explanation and tucks raw JSON into advanced details", () => {
  const view = snapshot();
  view.world.audit.calculations = [{
    day: 7,
    formulaId: "economy.commodity-price",
    version: 2,
    inputs: { stock: 35, targetStock: 100, previousPrice: 12 },
    steps: [{ id: "scarcity", value: 0.65 }],
    modifiers: [],
    randomDraws: [{ streamId: "economy.market.new-dawn-market.ore", method: "next", value: 0.5 }],
    result: { price: 13.2, change: 10 }
  }];
  const markup = renderCalculationAuditPanel(view);
  assert.ok(markup.indexOf("库存低于目标，稀缺因素推高目标价。") < markup.indexOf("查看原始计算记录"));
  assert.match(markup, /新曙光市场 · 矿石/);
  assert.match(markup, /13\.2 CR/);
  assert.match(markup, /class="audit-raw-details"/);
  assert.match(markup, /&quot;scarcity&quot;/);
});

test("domain event panel explains weekly recurrence before exposing raw payload", () => {
  const view = snapshot();
  view.world.domainEvents = [{
    id: "domain-3",
    sequence: 3,
    day: 7,
    date: "2478-04-08",
    type: "colony.production-settled",
    scope: "colony",
    subjectId: "new-dawn-colony",
    idempotencyKey: "campaign-day:7:colony.production-settled:new-dawn-colony",
    payload: { industryCount: 2, activeIndustryCount: 1, production: { ore: 26 } }
  }];
  const markup = renderDomainEventPanel(view);
  assert.match(markup, /殖民地周生产结算/);
  assert.match(markup, /每座殖民地每周一次（第 7、14、21 天）/);
  assert.match(markup, /新曙光殖民地/);
  assert.match(markup, /矿石/);
  assert.ok(markup.indexOf("每座殖民地每周一次") < markup.indexOf("查看原始事件数据"));
  assert.match(markup, /campaign-day:7:colony\.production-settled:new-dawn-colony/);
});

test("colony needs audit explains actual consumption and shortage without hiding raw values", () => {
  const view = snapshot();
  view.world.audit.calculations = [{
    day: 1,
    formulaId: "economy.population-needs",
    version: 2,
    inputs: { population: 1450000, requirements: [
      { commodityId: "food", dailyNeedPerThousand: .001, available: 10 },
      { commodityId: "water", dailyNeedPerThousand: .0015, available: 1 }
    ] },
    steps: [],
    modifiers: [],
    randomDraws: [],
    result: {
      requested: { food: 1.45, water: 2.175 },
      consumed: { food: 1.45, water: 1 },
      unmet: { food: 0, water: 1.175 },
      satisfaction: { food: 1, water: .4598 }
    }
  }];
  view.commodities.push({ id: "water", nameKey: "entity.water.name", unitKey: "entity.water.unit" });
  const markup = renderCalculationAuditPanel(view);
  assert.match(markup, /人口日常需求/);
  assert.match(markup, /供应不足/);
  assert.match(markup, /45\.98%/);
  assert.match(markup, /缺口 1\.18/);
});

test("domain event panel explains daily population demand settlement", () => {
  const view = snapshot();
  view.commodities.push({ id: "water", nameKey: "entity.water.name", unitKey: "entity.water.unit" });
  view.world.domainEvents = [{
    id: "domain-4", sequence: 4, day: 1, date: "2478-04-02",
    type: "colony.needs-settled", scope: "colony", subjectId: "new-dawn-colony",
    idempotencyKey: "campaign-day:1:colony.needs-settled:new-dawn-colony",
    payload: { needCount: 2, shortageCount: 1, needs: [
      { commodityId: "food", available: 10, requested: 1.45, consumed: 1.45, unmet: 0, satisfaction: 1 },
      { commodityId: "water", available: 1, requested: 2.175, consumed: 1, unmet: 1.175, satisfaction: .4598 }
    ]}
  }];
  const markup = renderDomainEventPanel(view);
  assert.match(markup, /殖民地日常需求结算/);
  assert.match(markup, /每座殖民地每天一次/);
  assert.match(markup, /缺口 1\.18/);
});

test("colony needs formula renders commodity satisfaction and unmet demand", () => {
  const view = snapshot();
  view.world.audit.calculations = [{
    day: 1, formulaId: "economy.population-needs", version: 2,
    inputs: { population: 1450000, requirements: [
      { commodityId: "water", dailyNeedPerThousand: .0015, available: 1 }
    ] },
    steps: [], modifiers: [], randomDraws: [],
    result: {
      requested: { water: 2.175 }, consumed: { water: 1 },
      unmet: { water: 1.175 }, satisfaction: { water: .4598 }
    }
  }];
  view.commodities.push({ id: "water", nameKey: "entity.water.name", unitKey: "entity.water.unit" });
  const markup = renderCalculationAuditPanel(view);
  assert.match(markup, /人口日常需求/);
  assert.match(markup, /供应不足/);
  assert.match(markup, /45\.98%/);
  assert.match(markup, /缺口 1\.18/);
});
test("colony needs event renders its daily cadence and unmet quantity", () => {
  const view = snapshot();
  view.commodities.push({ id: "water", nameKey: "entity.water.name", unitKey: "entity.water.unit" });
  view.world.domainEvents = [{
    id: "domain-4", sequence: 4, day: 1, date: "2478-04-02",
    type: "colony.needs-settled", scope: "colony", subjectId: "new-dawn-colony",
    idempotencyKey: "campaign-day:1:colony.needs-settled:new-dawn-colony",
    payload: {
      needCount: 2, shortageCount: 1,
      needs: [{ commodityId: "water", available: 1, requested: 2.175, consumed: 1, unmet: 1.175, satisfaction: .4598 }]
    }
  }];
  const markup = renderDomainEventPanel(view);
  assert.match(markup, /殖民地日常需求结算/);
  assert.match(markup, /每座殖民地每天一次/);
  assert.match(markup, /缺口 1\.18/);
});

test("colony needs panel displays sub-mill shortages with enough precision", () => {
  const view = snapshot();
  view.recipes = [];
  view.colonies = [{
    id: "new-dawn-colony",
    nameKey: "entity.new-dawn-colony.name",
    faction: null,
    location: { systemId: "helio" },
    state: {
      population: 1000,
      stability: 80,
      stockpiles: { water: 0, food: 0 },
      industries: [],
      lastProductionReport: null,
      lastNeedsReport: {
        day: 1,
        shortageCount: 1,
        needs: [{
          commodityId: "water",
          available: 0.0006,
          requested: 0.001,
          consumed: 0.0006,
          unmet: 0.0004,
          satisfaction: 0.6,
          status: "shortage"
        }]
      }
    }
  }];
  view.commodities.push({ id: "water", nameKey: "entity.water.name", unitKey: "entity.water.unit" });

  const markup = renderWorldRegion(view, "colony-production");
  assert.match(markup, /结算前库存 0\.0006 \/ 需求 0\.001/);
  assert.match(markup, /实际消耗 0\.0006/);
  assert.match(markup, /缺口 0\.0004/);
});
