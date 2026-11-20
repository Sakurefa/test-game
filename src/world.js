function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function number(value) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value || 0);
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function overview(snapshot) {
  const population = snapshot.colonies.reduce((sum, colony) => sum + colony.state.population, 0);
  const activeWars = snapshot.wars.filter((war) => war.state.status === "active").length;
  return `
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${escapeHtml(snapshot.universe.id)}</span><h2>${escapeHtml(snapshot.universe.name)}</h2><p>${escapeHtml(snapshot.universe.description)}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${escapeHtml(snapshot.factions.find((f) => f.id === snapshot.world.player.factionId)?.name || "未知势力")}</b><small>种子：${snapshot.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${snapshot.systems.length}</b></article>
      <article><small>殖民地</small><b>${snapshot.colonies.length}</b></article>
      <article><small>总人口</small><b>${number(population)}</b></article>
      <article><small>活跃战争</small><b>${activeWars}</b></article>
      <article><small>可用资金</small><b>${number(snapshot.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${snapshot.systems.map((system) => `
          <article class="system-card">
            <span class="system-coordinate">${system.position.x}, ${system.position.y}</span>
            <h4>${escapeHtml(system.name)}</h4>
            <p>${escapeHtml(system.description)}</p>
            <small>所属势力：${escapeHtml(snapshot.factions.find((f) => f.id === system.factionId)?.name || "中立")}</small>
            <div class="system-links">${system.links.map((id) => escapeHtml(snapshot.systems.find((item) => item.id === id)?.name || id)).join(" · ")}</div>
            <div class="system-locations">${system.locations.map((loc) => escapeHtml(loc.name)).join(" / ")}</div>
          </article>`).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${snapshot.tradeRoutes.map((route) => {
          const from = snapshot.systems.find((system) => system.id === route.fromSystemId)?.name || route.fromSystemId;
          const to = snapshot.systems.find((system) => system.id === route.toSystemId)?.name || route.toSystemId;
          return `<span><b>${escapeHtml(route.name)}</b><small>${escapeHtml(from)} → ${escapeHtml(to)} · ${route.travelDays} 天 · 风险 ${Math.round(route.risk * 100)}% · 容量 ${number(route.capacity)}</small></span>`;
        }).join("")}</div>
      </div>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${snapshot.recentEvents.map((event) => `
        <article><time>第 ${event.day} 天 · ${escapeHtml(event.date)}</time><p>${escapeHtml(event.text)}</p></article>
      `).join("")}</div>
    </section>`;
}

function colonies(snapshot) {
  return `
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${snapshot.colonies.map((colony) => {
          const stock = Object.entries(colony.state.stockpiles).map(([id, amount]) => {
            const commodity = snapshot.commodities.find((item) => item.id === id);
            return `<span><small>${escapeHtml(commodity?.name || id)}</small><b>${number(amount)} ${escapeHtml(commodity?.unit || "")}</b></span>`;
          }).join("");
          const industry = colony.state.industries.map((item) => {
            const recipe = snapshot.recipes.find((entry) => entry.id === item.recipeId);
            return `<li>${escapeHtml(recipe?.name || item.recipeId)} <small>等级 ${item.level}</small></li>`;
          }).join("");
          return `
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${escapeHtml(colony.location.systemId)}</span><h4>${escapeHtml(colony.name)}</h4><p>${escapeHtml(colony.faction.name)} · ${escapeHtml(colony.location.name)}</p></div><b class="stability">${colony.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${number(colony.state.population)}</b></div>
              <div class="stock-grid">${stock}</div>
              <div class="industry-list"><b>生产设施</b><ul>${industry}</ul></div>
            </article>`;
        }).join("")}
      </div>
    </section>`;
}

function markets(snapshot) {
  return `
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${snapshot.markets.map((market) => `
          <article class="market-card">
            <div><span class="world-eyebrow">${escapeHtml(market.id)}</span><h4>${escapeHtml(market.name)}</h4><p>${escapeHtml(snapshot.colonies.find((colony) => colony.id === market.colonyId)?.name || market.colonyId)}</p></div>
            <div class="quote-table">
              ${market.instruments.map((instrument) => `
                <div class="quote-row">
                  <div><b>${escapeHtml(instrument.ticker || instrument.name)}</b><small>${escapeHtml(instrument.name)} · ${instrument.kind === "equity" ? "证券" : escapeHtml(instrument.unit)}</small></div>
                  <div class="quote-value"><b>${number(instrument.price)}</b><small class="${instrument.change > 0 ? "positive" : instrument.change < 0 ? "negative" : ""}">${instrument.change > 0 ? "+" : ""}${number(instrument.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`).join("")}
      </div>
    </section>`;
}

function military(snapshot) {
  return `
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${snapshot.factions.map((faction) => `
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(faction.color) ? faction.color : "#8ca8c8"}"></i><div><b>${escapeHtml(faction.name)}</b><small>${escapeHtml(faction.government)} · ${escapeHtml(faction.description)}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${snapshot.fleets.map((fleet) => `
          <article class="fleet-row"><div><b>${escapeHtml(fleet.name)}</b><small>${escapeHtml(fleet.faction.name)} · ${escapeHtml(snapshot.systems.flatMap((system) => system.locations).find((location) => location.id === fleet.locationId)?.name || fleet.locationId)}</small><p>${fleet.ships.map((ship) => `${escapeHtml(snapshot.shipClasses.find((item) => item.id === ship.shipClassId)?.name || ship.shipClassId)} × ${ship.quantity}`).join("　")}</p></div><span>${fleet.state.readiness}%<small>战备</small></span></article>
        `).join("")}</div>
      </div>
      <div class="war-list">${snapshot.wars.map((war) => `
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${escapeHtml(war.name)}</h4><p>${escapeHtml(war.description)}</p><div><b>${war.state.status === "active" ? "进行中" : "已结束"}</b><span>持续 ${war.state.daysActive} 天</span><span>${war.participants.map((id) => escapeHtml(snapshot.factions.find((f) => f.id === id)?.name || id)).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`;
}

export function renderWorld(snapshot, activeTab = "overview", notice = "") {
  const tabs = [
    ["overview", "星域总览"], ["colonies", "殖民地与生产"],
    ["markets", "市场与金融"], ["military", "势力与战争"]
  ];
  const content = activeTab === "colonies" ? colonies(snapshot)
    : activeTab === "markets" ? markets(snapshot)
      : activeTab === "military" ? military(snapshot) : overview(snapshot);
  return `
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date"><small>GALACTIC DATE</small><b>${escapeHtml(snapshot.world.clock.date)}</b><span>第 ${snapshot.world.clock.day} 天</span></div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${tabs.map(([id, label]) => `<button data-world-tab="${id}" class="${activeTab === id ? "active" : ""}">${label}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="advance" class="world-primary">推进一天</button>
          <button data-world-action="save">保存世界</button>
          <button data-world-action="leave">返回主菜单</button>
        </div>
      </div>
      ${notice ? `<div class="world-notice">${escapeHtml(notice)}</div>` : ""}
      <div class="world-content">${content}</div>
      <footer class="world-footer"><span>存档：${escapeHtml(snapshot.saveId || "未命名")}</span><span>世界版本 ${snapshot.world.schemaVersion} · 内容指纹 ${snapshot.world.contentHash.slice(0, 10)}</span></footer>
    </main>`;
}
