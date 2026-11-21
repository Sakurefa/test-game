import test from "node:test";
import assert from "node:assert/strict";
import { renderCalculationAuditPanel, renderDomainEventPanel } from "../src/world.js";

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
  "entity.ore.unit": "吨"
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
  assert.match(markup, /"scarcity"/);
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
