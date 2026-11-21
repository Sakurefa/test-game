import { getCampaignWeekFraction } from "./time-display.mjs";
import { getRecentCalculationRecords, summarizeCalculationRecord } from "./calculation-audit.mjs";
import { getRecentDomainEvents, summarizeDomainEvent } from "./domain-event-view.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function auditJson(value) {
  return escapeHtml(JSON.stringify(value ?? null, null, 2));
}

function findAuditInstrument(snapshot, record) {
  const streams = new Set((record.randomDraws || []).map((draw) => draw.streamId).filter(Boolean));
  for (const market of snapshot.markets || []) {
    for (const instrument of market.instruments || []) {
      const streamId = `economy.market.${market.id}.${instrument.id}`;
      if (streams.has(streamId)) return { ...instrument, marketName: entityName(snapshot, market) };
    }
  }
  return null;
}

function commodityLabel(snapshot, commodityId) {
  const commodity = snapshot.commodities.find((item) => item.id === commodityId);
  const unit = commodity?.unitKey ? tr(snapshot, commodity.unitKey) : "";
  return `${entityName(snapshot, commodity, commodityId)}${unit ? " · " + unit : ""}`;
}

function renderAuditFacts(snapshot, facts, instrument) {
  if (!facts?.length) return "";
  return `<div class="audit-fact-grid">${facts.map((fact) => {
    if (!Number.isFinite(fact.value)) return "";
    const value = fact.percentScale ? fact.value * fact.percentScale : fact.value;
    const suffix = fact.commodityUnit ? ` ${escapeHtml(instrument?.unit || "")}` : escapeHtml(fact.suffix || "");
    return `<span><small>${escapeHtml(tr(snapshot, fact.labelKey))}</small><b>${number(value)}${suffix}</b></span>`;
  }).join("")}</div>`;
}

function renderCommodityAmounts(snapshot, labelKey, amounts) {
  const entries = Object.entries(amounts || {});
  if (!entries.length) return "";
  const values = entries.map(([id, quantity]) => `<span>${escapeHtml(commodityLabel(snapshot, id))}<b>${number(quantity)}</b></span>`).join("");
  return `<div class="audit-resource-group"><small>${escapeHtml(tr(snapshot, labelKey))}</small><div>${values}</div></div>`;
}

function renderAuditRecord(snapshot, record) {
  const summary = summarizeCalculationRecord(record);
  const draws = Array.isArray(record.randomDraws) ? record.randomDraws : [];
  const instrument = findAuditInstrument(snapshot, record);
  const subject = instrument ? `${instrument.marketName} · ${instrument.ticker || instrument.name}` : "";
  const inputRows = (summary.inputs || []).map((item) => `
    <span>${escapeHtml(commodityLabel(snapshot, item.commodityId))}
      <b>每批 ${number(item.perBatch)} · 可用 ${number(item.available)}</b>
    </span>`).join("");
  const limiting = summary.limitingInput
    ? `<p class="audit-limiter">${escapeHtml(tr(snapshot, "audit.field.limiting_input"))}：${escapeHtml(commodityLabel(snapshot, summary.limitingInput))}</p>`
    : "";
  const statusClass = summary.statusKey?.split(".").at(-1) || "unknown";
  const status = summary.statusKey
    ? `<b class="audit-status ${escapeHtml(statusClass)}">${escapeHtml(tr(snapshot, summary.statusKey))}</b>`
    : "";
  const statusPreview = summary.statusKey
    ? `<small class="audit-record-status-note">${escapeHtml(tr(snapshot, summary.statusKey))}</small>`
    : "";
  return `
    <details class="audit-record">
      <summary>
        <span><b>第 ${record.day ?? "—"} 天 · ${escapeHtml(tr(snapshot, summary.titleKey))}</b><small>${escapeHtml(record.formulaId)} · v${record.version}${subject ? " · " + escapeHtml(subject) : ""}</small>${statusPreview}</span>
        <em>${escapeHtml(tr(snapshot, "audit.random_draws"))}：${draws.length}</em>
      </summary>
      <div class="audit-record-body">
        <div class="audit-readable-summary">
          <p class="audit-explanation">${escapeHtml(tr(snapshot, summary.explanationKey))}</p>
          ${status}
          ${renderAuditFacts(snapshot, summary.facts, instrument)}
          ${inputRows ? `<div class="audit-resource-group"><small>${escapeHtml(tr(snapshot, "audit.field.recipe_inputs"))}</small><div>${inputRows}</div></div>` : ""}
          ${limiting}
          ${renderCommodityAmounts(snapshot, "audit.field.consumed", summary.consumed)}
          ${renderCommodityAmounts(snapshot, "audit.field.produced", summary.produced)}
        </div>
        <details class="audit-raw-details">
          <summary>${escapeHtml(tr(snapshot, "audit.raw_calculation"))}</summary>
          <div class="audit-record-body">
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_inputs"))}</h5><pre>${auditJson(record.inputs)}</pre></section>
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_steps"))}</h5><pre>${auditJson(record.steps)}</pre></section>
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_modifiers"))}</h5><pre>${auditJson(record.modifiers)}</pre></section>
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_random"))}</h5><pre>${auditJson(draws)}</pre></section>
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_result"))}</h5><pre>${auditJson(record.result)}</pre></section>
          </div>
        </details>
      </div>
    </details>`;
}

export function renderCalculationAuditPanel(snapshot) {
  const records = getRecentCalculationRecords(snapshot.world, 30);
  const content = records.length
    ? records.map((record) => renderAuditRecord(snapshot, record)).join("")
    : `<div class="audit-empty">${escapeHtml(tr(snapshot, "audit.empty_calculations"))}</div>`;
  return `
    <aside class="calculation-audit-panel" data-audit-panel aria-label="${escapeHtml(tr(snapshot, "audit.calculation_panel"))}">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">CALCULATION TRACE / READ ONLY</span><h3>${escapeHtml(tr(snapshot, "audit.calculation_panel"))}</h3><small>${records.length} / 30</small></div>
        <button data-world-action="toggle-audit" aria-label="${escapeHtml(tr(snapshot, "audit.close"))}">${escapeHtml(tr(snapshot, "audit.close"))}</button>
      </header>
      <div class="audit-panel-body">${content}</div>
      <footer class="audit-panel-footer">${escapeHtml(tr(snapshot, "audit.calculation_footer"))}</footer>
    </aside>`;
}

function domainEventSubject(snapshot, event) {
  const collection = event.scope === "colony" ? snapshot.colonies
    : event.scope === "market" ? snapshot.markets
      : event.scope === "war" ? snapshot.wars : [];
  const entity = collection.find((item) => item.id === event.subjectId);
  return entity ? entityName(snapshot, entity) : event.subjectId || tr(snapshot, "audit.no_subject");
}

function renderEventChanges(snapshot, changes) {
  const entries = Object.entries(changes || {});
  if (!entries.length) return "";
  const values = entries.map(([id, change]) => {
    const market = snapshot.markets.find((item) => item.instruments.some((instrument) => instrument.id === id));
    const instrument = market?.instruments.find((item) => item.id === id);
    const name = instrument?.ticker || instrument?.name || id;
    return `<span>${escapeHtml(name)}<b>${change > 0 ? "+" : ""}${number(change)}%</b></span>`;
  }).join("");
  return `<div class="audit-resource-group"><small>${escapeHtml(tr(snapshot, "audit.field.quote_changes"))}</small><div>${values}</div></div>`;
}

function renderDomainEventRecord(snapshot, event) {
  const summary = summarizeDomainEvent(event);
  const subject = domainEventSubject(snapshot, event);
  return `
    <details class="audit-record domain-event-record">
      <summary>
        <span><b>#${event.sequence} · 第 ${event.day} 天 · ${escapeHtml(tr(snapshot, summary.titleKey))}</b><small>${escapeHtml(event.date)} · ${escapeHtml(subject)}</small><small class="audit-cadence">${escapeHtml(tr(snapshot, summary.cadenceKey))}</small></span>
        <em>${Object.keys(event.payload || {}).length}</em>
      </summary>
      <div class="audit-record-body">
        <div class="audit-readable-summary">
          <p class="audit-explanation">${escapeHtml(tr(snapshot, summary.explanationKey))}</p>
          ${renderAuditFacts(snapshot, summary.facts)}
          ${renderEventChanges(snapshot, summary.changes)}
          ${renderCommodityAmounts(snapshot, "audit.field.production_output", summary.production)}
        </div>
        <details class="audit-raw-details">
          <summary>${escapeHtml(tr(snapshot, "audit.raw_event"))}</summary>
          <div class="audit-record-body">
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_metadata"))}</h5><pre>${auditJson({
              id: event.id, sequence: event.sequence, day: event.day, date: event.date,
              type: event.type, scope: event.scope, subjectId: event.subjectId,
              idempotencyKey: event.idempotencyKey
            })}</pre></section>
            <section><h5>${escapeHtml(tr(snapshot, "audit.raw_payload"))}</h5><pre>${auditJson(event.payload)}</pre></section>
          </div>
        </details>
      </div>
    </details>`;
}

export function renderDomainEventPanel(snapshot) {
  const records = getRecentDomainEvents(snapshot.world, 30);
  const content = records.length
    ? records.map((event) => renderDomainEventRecord(snapshot, event)).join("")
    : `<div class="audit-empty">${escapeHtml(tr(snapshot, "audit.empty_events"))}</div>`;
  return `
    <aside class="calculation-audit-panel domain-event-panel" data-domain-event-panel aria-label="${escapeHtml(tr(snapshot, "audit.event_panel"))}">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">DOMAIN EVENT STREAM / READ ONLY</span><h3>${escapeHtml(tr(snapshot, "audit.event_panel"))}</h3><small>${records.length} / 30 · ${escapeHtml(tr(snapshot, "audit.event_history_retention"))}</small></div>
        <button data-world-action="toggle-domain-events" aria-label="${escapeHtml(tr(snapshot, "audit.close"))}">${escapeHtml(tr(snapshot, "audit.close"))}</button>
      </header>
      <div class="audit-panel-body">${content}</div>
      <footer class="audit-panel-footer">${escapeHtml(tr(snapshot, "audit.event_footer"))}</footer>
    </aside>`;
}

function tr(snapshot, key) {
  return snapshot.localization?.[key] || `[${key || "missing-localization-key"}]`;
}

function entityName(snapshot, entity, fallback = "") {
  return entity?.nameKey ? tr(snapshot, entity.nameKey) : fallback;
}

function entityDescription(snapshot, entity) {
  return entity?.descriptionKey ? tr(snapshot, entity.descriptionKey) : "";
}

function number(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value || 0);
}

function renderRecentEventsSection(snapshot) {
  return `
    <section class="world-section" data-world-region="recent-events">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${snapshot.recentEvents.map((event) => `
        <article><time>第 ${event.day} 天 · ${escapeHtml(event.date)}</time><p>${escapeHtml(event.text)}</p></article>
      `).join("")}</div>
    </section>`;
}

function overview(snapshot) {
  const population = snapshot.colonies.reduce((sum, colony) => sum + colony.state.population, 0);
  const activeWars = snapshot.wars.filter((war) => war.state.status === "active").length;
  const playerFaction = snapshot.factions.find((faction) => faction.id === snapshot.world.player.factionId);
  return `
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${escapeHtml(snapshot.universe.id)}</span><h2>${escapeHtml(entityName(snapshot, snapshot.universe))}</h2><p>${escapeHtml(entityDescription(snapshot, snapshot.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${escapeHtml(entityName(snapshot, playerFaction, "未知势力"))}</b><small>种子：${snapshot.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${snapshot.systems.length}</b></article>
      <article><small>殖民地</small><b>${snapshot.colonies.length}</b></article>
      <article><small>总人口</small><b>${number(population)}</b></article>
      <article><small>活跃战争</small><b>${activeWars}</b></article>
      <article><small>可用资金</small><b>${number(snapshot.world.finance.accounts[snapshot.world.player.accountId].balanceMinor / 100)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${snapshot.systems.map((system) => {
          const faction = snapshot.factions.find((item) => item.id === system.factionId);
          return `
          <article class="system-card">
            <span class="system-coordinate">${system.position.x}, ${system.position.y}</span>
            <h4>${escapeHtml(entityName(snapshot, system))}</h4>
            <p>${escapeHtml(entityDescription(snapshot, system))}</p>
            <small>所属势力：${escapeHtml(entityName(snapshot, faction, "中立"))}</small>
            <div class="system-links">${system.links.map((id) => escapeHtml(entityName(snapshot, snapshot.systems.find((item) => item.id === id), id))).join(" · ")}</div>
            <div class="system-locations">${system.locations.map((loc) => escapeHtml(entityName(snapshot, loc, loc.id))).join(" / ")}</div>
          </article>`;
        }).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${snapshot.tradeRoutes.map((route) => {
          const from = snapshot.systems.find((system) => system.id === route.fromSystemId);
          const to = snapshot.systems.find((system) => system.id === route.toSystemId);
          return `<span><b>${escapeHtml(entityName(snapshot, route, route.id))}</b><small>${escapeHtml(entityName(snapshot, from, route.fromSystemId))} → ${escapeHtml(entityName(snapshot, to, route.toSystemId))} · ${route.travelDays} 天 · 风险 ${Math.round(route.risk * 100)}% · 容量 ${number(route.capacity)}</small></span>`;
        }).join("")}</div>
      </div>
    </section>
    ${renderRecentEventsSection(snapshot)}`;
}

function colonies(snapshot) {
  return `
    <section class="world-section" data-world-region="colony-production">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${snapshot.colonies.map((colony) => {
          const stock = Object.entries(colony.state.stockpiles).map(([id, amount]) => {
            const commodity = snapshot.commodities.find((item) => item.id === id);
            return `<span><small>${escapeHtml(entityName(snapshot, commodity, id))}</small><b>${number(amount)} ${escapeHtml(commodity?.unitKey ? tr(snapshot, commodity.unitKey) : "")}</b></span>`;
          }).join("");
          const productionReport = colony.state.lastProductionReport;
          const reportByIndustry = new Map((productionReport?.industries || [])
            .map((entry) => [entry.industryIndex, entry]));
          const formatAmounts = (amounts) => Object.entries(amounts || {}).map(([id, amount]) => {
            const commodity = snapshot.commodities.find((item) => item.id === id);
            const unit = commodity?.unitKey ? tr(snapshot, commodity.unitKey) : "";
            return `${escapeHtml(entityName(snapshot, commodity, id))} ${number(amount)} ${escapeHtml(unit)}`;
          }).join("、") || "无";
          const industry = colony.state.industries.map((item, index) => {
            const recipe = snapshot.recipes.find((entry) => entry.id === item.recipeId);
            const report = reportByIndustry.get(index);
            if (!report) {
              return `<li class="industry-entry"><div class="industry-entry-heading"><span>${escapeHtml(entityName(snapshot, recipe, item.recipeId))} <small>等级 ${item.level}</small></span></div><div class="industry-pending">等待首次周生产结算</div></li>`;
            }
            const statusLabel = report.status === "normal" ? "生产正常"
              : report.status === "no-output" ? "无产出" : "原料受限";
            const statusClass = report.status === "normal" ? "normal" : "limited";
            const limitingCommodity = report.limitingInput
              ? snapshot.commodities.find((entry) => entry.id === report.limitingInput) : null;
            const limitingUnit = limitingCommodity?.unitKey ? tr(snapshot, limitingCommodity.unitKey) : "";
            const limitingText = report.limitingInput
              ? `限制原料：${escapeHtml(entityName(snapshot, limitingCommodity, report.limitingInput))} · 库存 ${number(report.limitingAvailable)} / 计划需求 ${number(report.limitingRequired)} ${escapeHtml(limitingUnit)}`
              : "原料充足";
            return `<li class="industry-entry">
              <div class="industry-entry-heading"><span>${escapeHtml(entityName(snapshot, recipe, item.recipeId))} <small>等级 ${item.level}</small></span><b class="industry-status ${statusClass}">${statusLabel}</b></div>
              <div class="industry-batches">生产批次：${number(report.actualBatches)} / ${number(report.requestedBatches)}</div>
              <div class="industry-output"><span>计划产出</span><b>${formatAmounts(report.requestedOutput)}</b></div>
              <div class="industry-output"><span>实际产出</span><b>${formatAmounts(report.produced)}</b></div>
              <div class="industry-limiter ${report.limitingInput ? "warning" : ""}">${limitingText}</div>
            </li>`;
          }).join("");
          const productionDate = productionReport
            ? `最近结算：第 ${productionReport.day} 天` : "等待首次周生产结算";
          return `
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${escapeHtml(colony.location.systemId)}</span><h4>${escapeHtml(entityName(snapshot, colony))}</h4><p>${escapeHtml(entityName(snapshot, colony.faction))} · ${escapeHtml(entityName(snapshot, colony.location))}</p></div><b class="stability">${colony.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${number(colony.state.population)}</b></div>
              <div class="stock-grid">${stock}</div>
              <div class="industry-list"><div class="industry-list-heading"><b>生产设施</b><small>${productionDate}</small></div><ul>${industry}</ul></div>
            </article>`;
        }).join("")}
      </div>
    </section>`;
}

function markets(snapshot) {
  return `
    <section class="world-section" data-world-region="market-quotes">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${snapshot.markets.map((market) => {
          const colony = snapshot.colonies.find((item) => item.id === market.colonyId);
          return `
          <article class="market-card">
            <div><span class="world-eyebrow">${escapeHtml(market.id)}</span><h4>${escapeHtml(entityName(snapshot, market))}</h4><p>${escapeHtml(entityName(snapshot, colony, market.colonyId))}</p></div>
            <div class="quote-table">
              ${market.instruments.map((instrument) => `
                <div class="quote-row">
                  <div><b>${escapeHtml(instrument.ticker || instrument.name)}</b><small>${escapeHtml(instrument.name)} · ${instrument.kind === "equity" ? "证券" : escapeHtml(instrument.unit)}</small></div>
                  <div class="quote-value"><b>${number(instrument.price)}</b><small class="${instrument.change > 0 ? "positive" : instrument.change < 0 ? "negative" : ""}">${instrument.change > 0 ? "+" : ""}${number(instrument.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`;
        }).join("")}
      </div>
    </section>`;
}

function military(snapshot) {
  return `
    <section class="world-section" data-world-region="war-chronology">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${snapshot.factions.map((faction) => `
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(faction.color) ? faction.color : "#8ca8c8"}"></i><div><b>${escapeHtml(entityName(snapshot, faction))}</b><small>${escapeHtml(tr(snapshot, faction.governmentKey))} · ${escapeHtml(entityDescription(snapshot, faction))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${snapshot.fleets.map((fleet) => {
          const location = snapshot.systems.flatMap((system) => system.locations).find((item) => item.id === fleet.locationId);
          return `
          <article class="fleet-row"><div><b>${escapeHtml(entityName(snapshot, fleet))}</b><small>${escapeHtml(entityName(snapshot, fleet.faction))} · ${escapeHtml(entityName(snapshot, location, fleet.locationId))}</small><p>${fleet.ships.map((ship) => {
            const shipClass = snapshot.shipClasses.find((item) => item.id === ship.shipClassId);
            return `${escapeHtml(entityName(snapshot, shipClass, ship.shipClassId))} × ${ship.quantity}`;
          }).join("　")}</p></div><span>${fleet.state.readiness}%<small>战备</small></span></article>`;
        }).join("")}</div>
      </div>
      <div class="war-list">${snapshot.wars.map((war) => `
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${escapeHtml(entityName(snapshot, war))}</h4><p>${escapeHtml(entityDescription(snapshot, war))}</p><div><b>${war.state.status === "active" ? "进行中" : "已结束"}</b><span>持续 ${war.state.daysActive} 天</span><span>${war.participants.map((id) => escapeHtml(entityName(snapshot, snapshot.factions.find((faction) => faction.id === id), id))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`;
}

export function renderWorldRegion(snapshot, regionId) {
  switch (regionId) {
    case "recent-events": return renderRecentEventsSection(snapshot);
    case "colony-production": return colonies(snapshot);
    case "market-quotes": return markets(snapshot);
    case "war-chronology": return military(snapshot);
    default: return "";
  }
}

export function renderWorld(snapshot, activeTab = "overview", notice = "", auditOpen = false, domainEventsOpen = false) {
  const tabs = [
    ["overview", "星域总览"], ["colonies", "殖民地与生产"],
    ["markets", "市场与金融"], ["military", "势力与战争"]
  ];
  const content = activeTab === "colonies" ? colonies(snapshot)
    : activeTab === "markets" ? markets(snapshot)
      : activeTab === "military" ? military(snapshot) : overview(snapshot);
  const weeklyFraction = getCampaignWeekFraction(snapshot.world.clock.day, snapshot.world.clock.dayFraction || 0);
  const weeklyPercentage = (weeklyFraction * 100).toFixed(1);
  const dayInWeek = snapshot.world.clock.day % 7 + 1;
  return `
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date">
          <small>GALACTIC DATE</small>
          <b data-world-date>${escapeHtml(snapshot.world.clock.date)}</b>
          <div class="world-day-summary"><span data-world-day>第 ${snapshot.world.clock.day} 天 · 第 ${Math.floor(snapshot.world.clock.day / 7) + 1} 周 · 本周第 ${dayInWeek} 天</span><strong data-world-percent>${weeklyPercentage}%</strong></div>
          <div class="campaign-week-track" data-world-progress-track role="progressbar" aria-label="当前游戏周进度，划分为七个日刻度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weeklyPercentage}">
            <span class="campaign-week-fill" data-world-progress style="width:${weeklyPercentage}%"></span>
            <span class="campaign-week-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </div>
        </div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${tabs.map(([id, label]) => `<button data-world-tab="${id}" class="${activeTab === id ? "active" : ""}">${label}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="toggle-audit" class="${auditOpen ? "selected" : ""}" aria-expanded="${auditOpen}">计算审计</button>
          <button data-world-action="toggle-domain-events" class="${domainEventsOpen ? "selected" : ""}" aria-expanded="${domainEventsOpen}">世界事件</button>
          <span class="time-control-label" data-time-label>${snapshot.timeControl?.paused ? "时间已暂停" : `世界时间 · ${snapshot.timeControl?.speed || 1}x`}</span>
          <div class="time-speed-buttons">
            <button data-world-action="set-speed" data-speed="0" title="暂停世界时间" class="${snapshot.timeControl?.speed === 0 ? "selected" : ""}" aria-pressed="${snapshot.timeControl?.speed === 0}">Ⅱ</button>
            <button data-world-action="set-speed" data-speed="1" title="以 1 倍速度运行" class="${snapshot.timeControl?.speed === 1 ? "selected" : ""}" aria-pressed="${snapshot.timeControl?.speed === 1}">1x</button>
            <button data-world-action="set-speed" data-speed="2" title="以 2 倍速度运行" class="${snapshot.timeControl?.speed === 2 ? "selected" : ""}" aria-pressed="${snapshot.timeControl?.speed === 2}">2x</button>
            <button data-world-action="set-speed" data-speed="3" title="以 3 倍速度运行" class="${snapshot.timeControl?.speed === 3 ? "selected" : ""}" aria-pressed="${snapshot.timeControl?.speed === 3}">3x</button>
            <button data-world-action="set-speed" data-speed="4" title="以 4 倍速度运行" class="${snapshot.timeControl?.speed === 4 ? "selected" : ""}" aria-pressed="${snapshot.timeControl?.speed === 4}">4x</button>
          </div>
          <button data-world-action="save">保存世界</button>
          <button data-world-action="leave">返回主菜单</button>
        </div>
      </div>
      ${notice ? `<div class="world-notice">${escapeHtml(notice)}</div>` : ""}
      <div class="world-content">${content}</div>
      <footer class="world-footer"><span data-save-status>存档：${escapeHtml(snapshot.saveId || "未命名")} · ${snapshot.dirty ? "有未保存更改" : "已保存"}</span><span>世界版本 ${snapshot.world.schemaVersion} · 内容指纹 ${snapshot.world.contentHash.slice(0, 10)}</span></footer>
      ${auditOpen ? renderCalculationAuditPanel(snapshot) : ""}
      ${domainEventsOpen ? renderDomainEventPanel(snapshot) : ""}
    </main>`;
}
