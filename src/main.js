import "./styles.css";
import "./time-controls.css";
import { renderWorld, renderWorldRegion, renderCalculationAuditPanel, renderDomainEventPanel } from "./world.js";
import { estimateCampaignWeekFraction } from "./time-display.mjs";
import { getWorldDateRefreshRegions } from "./world-refresh.mjs";

const app = document.querySelector("#app");
const state = {
  page: "home", settings: null, slots: [], mods: [], error: "",
  busy: false, world: null, worldTab: "overview", worldNotice: "", auditOpen: false, domainEventsOpen: false
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function hostAvailable() {
  return Boolean(window.gameHost);
}

function shell(content) {
  app.innerHTML = `
    <main class="title-screen">
      <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
      <header class="title-bar">
        <div class="wordmark"><span class="mark">F</span><span>FRONTIER</span></div>
        <span class="build-label">STAR SYSTEMS SIMULATION <i></i></span>
      </header>
      <div class="main-layout">
        <section class="hero">
          <div class="overline"><span></span> A LIVING FRONTIER <span></span></div>
          <h1>FRONTIER</h1>
          <p class="subtitle">星域经营与战争模拟</p>
          <div class="rule"></div>
          <p class="tagline">殖民地、生产、贸易与舰队，共同构成一个世界。</p>
        </section>
        <section class="menu-panel">${content}</section>
      </div>
      <footer class="title-footer">
        <span>INDEPENDENT DESKTOP EXPERIENCE</span>
        <span>ENGINE PROTOTYPE 0.2</span>
      </footer>
    </main>`;
}

function homePage() {
  state.page = "home";
  shell(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${!hostAvailable() ? '<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>' : ""}
  `);
}

function showFatalError(report) {
  worldViewEpoch += 1;
  state.world = null;
  state.busy = false;
  state.auditOpen = false;
  state.domainEventsOpen = false;
  state.worldNotice = "";
  homePage();
  const details = report.logContext || report.stack || report.message || "No error details available";
  app.insertAdjacentHTML("beforeend", `
    <div class="fatal-error-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="fatal-error-title">
      <section class="fatal-error-panel">
        <div class="fatal-error-heading">
          <span class="eyebrow">WORLD EXECUTION STOPPED / ${escapeHtml(report.failureId || "UNKNOWN")}</span>
          <h2 id="fatal-error-title">世界运行发生错误</h2>
          <p>游戏已停止当前世界并返回主菜单。请复制下方诊断记录并提交给开发者。</p>
        </div>
        <div class="fatal-error-message"><b>${escapeHtml(report.source || "unknown")}</b><span>${escapeHtml(report.message || "Unknown error")}</span></div>
        <label for="fatal-error-report">错误行及前后日志（可直接复制）</label>
        <textarea id="fatal-error-report" readonly spellcheck="false">${escapeHtml(details)}</textarea>
        <div class="fatal-error-actions">
          <button class="action-button" data-action="copy-fatal-error">复制全部诊断记录</button>
          <button class="small-button" data-action="close-fatal-error">关闭并留在主菜单</button>
        </div>
      </section>
    </div>`);
  document.querySelector("#fatal-error-report")?.focus();
}

function subPage(title, subtitle, body) {
  shell(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${escapeHtml(title)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
    <div class="subpage-body">${body}</div>
  `);
}

let worldClockView = null;
let worldClockElements = null;
let worldClockAnimationFrame = null;
let worldClockPollInFlight = false;
let worldViewEpoch = 0;

function cacheCampaignClockElements() {
  worldClockElements = {
    date: app.querySelector("[data-world-date]"),
    day: app.querySelector("[data-world-day]"),
    percent: app.querySelector("[data-world-percent]"),
    progress: app.querySelector("[data-world-progress]"),
    progressTrack: app.querySelector("[data-world-progress-track]"),
    status: app.querySelector("[data-time-label]"),
    speedButtons: [...app.querySelectorAll("[data-world-action='set-speed']")],
    footer: app.querySelector("[data-save-status]")
  };
}

function updateCampaignClockMetadata() {
  if (!worldClockView || !worldClockElements) return;
  const { clock, timeControl } = worldClockView;
  const week = Math.floor(clock.day / 7) + 1;
  const dayInWeek = clock.day % 7 + 1;

  if (worldClockElements.date && worldClockElements.date.textContent !== clock.date) {
    worldClockElements.date.textContent = clock.date;
  }
  if (worldClockElements.day) {
    const label = `第 ${clock.day} 天 · 第 ${week} 周 · 本周第 ${dayInWeek} 天`;
    if (worldClockElements.day.textContent !== label) worldClockElements.day.textContent = label;
  }
  if (worldClockElements.status) {
    const label = timeControl.paused ? "时间已暂停" : `世界时间 · ${timeControl.speed}x`;
    if (worldClockElements.status.textContent !== label) worldClockElements.status.textContent = label;
  }
  for (const button of worldClockElements.speedButtons) {
    const selected = Number(button.dataset.speed) === timeControl.speed;
    if (button.classList.contains("selected") !== selected) {
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }
  if (worldClockElements.footer) {
    const label = `存档：${worldClockView.saveId || "未命名"} · ${worldClockView.dirty ? "有未保存更改" : "已保存"}`;
    if (worldClockElements.footer.textContent !== label) worldClockElements.footer.textContent = label;
  }
}

function updateCampaignClockProgress() {
  if (!worldClockView || !worldClockElements) return;
  const { clock, timeControl } = worldClockView;
  const elapsedMs = timeControl.speed > 0
    ? Math.max(0, performance.now() - worldClockView.syncedAt)
    : 0;
  const fraction = estimateCampaignWeekFraction({
    day: clock.day,
    dayFraction: clock.dayFraction || 0,
    speed: timeControl.speed,
    baseDayDurationMs: timeControl.baseDayDurationMs,
    elapsedMs
  });
  const percentage = (fraction * 100).toFixed(1);

  if (worldClockElements.percent && worldClockElements.percent.textContent !== `${percentage}%`) {
    worldClockElements.percent.textContent = `${percentage}%`;
  }
  if (worldClockElements.progress) {
    const width = `${percentage}%`;
    if (worldClockElements.progress.style.width !== width) worldClockElements.progress.style.width = width;
  }
  if (worldClockElements.progressTrack) {
    const value = String(Number(percentage));
    if (worldClockElements.progressTrack.getAttribute("aria-valuenow") !== value) {
      worldClockElements.progressTrack.setAttribute("aria-valuenow", value);
    }
  }
}

function stopCampaignClockAnimation() {
  if (worldClockAnimationFrame !== null) {
    cancelAnimationFrame(worldClockAnimationFrame);
    worldClockAnimationFrame = null;
  }
}

function animateCampaignClock() {
  worldClockAnimationFrame = null;
  if (state.page !== "world" || !state.world || !worldClockView) return;
  updateCampaignClockProgress();
  if (worldClockView.timeControl.speed > 0) {
    worldClockAnimationFrame = requestAnimationFrame(animateCampaignClock);
  }
}

function startCampaignClockAnimation() {
  if (worldClockView?.timeControl.speed > 0 && worldClockAnimationFrame === null) {
    worldClockAnimationFrame = requestAnimationFrame(animateCampaignClock);
  }
}

function syncCampaignClock(status) {
  if (!state.world || !status?.clock || !status?.timeControl) return;
  worldClockView = {
    clock: { ...status.clock },
    timeControl: { ...status.timeControl },
    saveId: status.saveId ?? state.world.saveId,
    dirty: status.dirty ?? state.world.dirty,
    syncedAt: performance.now()
  };
  state.world.world.clock = { ...status.clock };
  state.world.timeControl = { ...status.timeControl };
  if (status.saveId !== undefined) state.world.saveId = status.saveId;
  if (status.dirty !== undefined) state.world.dirty = status.dirty;
  updateCampaignClockMetadata();
  updateCampaignClockProgress();
  if (worldClockView.timeControl.speed > 0) startCampaignClockAnimation();
  else stopCampaignClockAnimation();
}

function syncCampaignClockFromSnapshot(snapshot) {
  syncCampaignClock({
    clock: snapshot.world.clock,
    timeControl: snapshot.timeControl,
    saveId: snapshot.saveId,
    dirty: snapshot.dirty
  });
}

function renderActiveWorld() {
  if (!state.world) return homePage();
  state.page = "world";
  app.innerHTML = renderWorld(state.world, state.worldTab, state.worldNotice, state.auditOpen, state.domainEventsOpen);
  cacheCampaignClockElements();
  updateCampaignClockMetadata();
  updateCampaignClockProgress();
  startCampaignClockAnimation();
}

function updateActiveWorldRegions(snapshot, previousDay) {
  const regions = getWorldDateRefreshRegions({
    activeTab: state.worldTab,
    previousDay,
    currentDay: snapshot.world.clock.day
  });

  if (regions.length > 0) {
    // Keep the scroll owner alive. Replacing #app or .world-content would reset the reading position.
    const scrollRegion = app.querySelector(".world-content");
    const previousScrollTop = scrollRegion?.scrollTop ?? 0;
    for (const regionId of regions) {
      const currentRegion = app.querySelector(`[data-world-region="${regionId}"]`);
      if (!currentRegion) continue;
      const nextMarkup = renderWorldRegion(snapshot, regionId);
      if (nextMarkup) currentRegion.outerHTML = nextMarkup;
    }
    if (scrollRegion) scrollRegion.scrollTop = previousScrollTop;
  }
  if (state.auditOpen) updateCalculationAuditPanel();
  if (state.domainEventsOpen) updateDomainEventsPanel();
}

function updateCalculationAuditPanel() {
  const current = app.querySelector("[data-audit-panel]");
  const toggle = app.querySelector("[data-world-action='toggle-audit']");
  if (toggle) {
    toggle.classList.toggle("selected", state.auditOpen);
    toggle.setAttribute("aria-expanded", String(state.auditOpen));
  }
  if (!state.auditOpen) {
    current?.remove();
    return;
  }
  if (!state.world) return;
  const markup = renderCalculationAuditPanel(state.world);
  if (current) {
    const body = current.querySelector(".audit-panel-body");
    const scrollTop = body?.scrollTop ?? 0;
    current.outerHTML = markup;
    const nextBody = app.querySelector("[data-audit-panel] .audit-panel-body");
    if (nextBody) nextBody.scrollTop = scrollTop;
  } else {
    app.querySelector(".world-screen")?.insertAdjacentHTML("beforeend", markup);
  }
}


function updateDomainEventsPanel() {
  const current = app.querySelector("[data-domain-event-panel]");
  const toggle = app.querySelector("[data-world-action='toggle-domain-events']");
  if (toggle) {
    toggle.classList.toggle("selected", state.domainEventsOpen);
    toggle.setAttribute("aria-expanded", String(state.domainEventsOpen));
  }
  if (!state.domainEventsOpen) {
    current?.remove();
    return;
  }
  if (!state.world) return;
  const markup = renderDomainEventPanel(state.world);
  if (current) {
    const body = current.querySelector(".audit-panel-body");
    const scrollTop = body?.scrollTop ?? 0;
    current.outerHTML = markup;
    const nextBody = app.querySelector("[data-domain-event-panel] .audit-panel-body");
    if (nextBody) nextBody.scrollTop = scrollTop;
  } else {
    app.querySelector(".world-screen")?.insertAdjacentHTML("beforeend", markup);
  }
}

async function pollCampaignClock() {
  if (!hostAvailable() || state.page !== "world" || !state.world || state.busy || worldClockPollInFlight) return;
  worldClockPollInFlight = true;
  const requestEpoch = worldViewEpoch;
  const requestedWorld = state.world;
  const previousDay = requestedWorld.world.clock.day;
  try {
    // Keep this IPC payload small: only the authoritative clock and control state.
    const clockStatus = await window.gameHost.world.getClockStatus();
    if (requestEpoch !== worldViewEpoch || state.page !== "world" || state.world !== requestedWorld || state.busy) return;

    if (clockStatus.clock.day !== previousDay) {
      // The snapshot refreshes authoritative data; the renderer patches only the due view region.
      const snapshot = await window.gameHost.world.getStatus();
      if (requestEpoch !== worldViewEpoch || state.page !== "world" || state.world !== requestedWorld || state.busy) return;
      state.world = snapshot;
      syncCampaignClockFromSnapshot(snapshot);
      updateActiveWorldRegions(snapshot, previousDay);
    } else {
      syncCampaignClock(clockStatus);
    }
  } catch (error) {
    console.error("World clock synchronization failed", error);
  } finally {
    worldClockPollInFlight = false;
  }
}

setInterval(() => {
  void pollCampaignClock();
}, 250);

async function enterNewWorld() {
  worldViewEpoch += 1;
  if (!hostAvailable()) {
    return subPage("开始新航程", "需要桌面运行环境。", '<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');
  }
  try {
    state.world = await window.gameHost.world.startNew();
    state.auditOpen = false;
    state.domainEventsOpen = false;
    syncCampaignClockFromSnapshot(state.world);
    state.worldTab = "overview";
    state.worldNotice = "新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。";
    renderActiveWorld();
  } catch (error) {
    subPage("无法启动世界", "核心内容未通过验证，或者存档目录不可写。", `<p class="error-state">${escapeHtml(error.message)}</p>`);
  }
}

async function loadWorld(saveId) {
  worldViewEpoch += 1;
  try {
    state.world = await window.gameHost.world.loadSave(saveId);
    state.auditOpen = false;
    state.domainEventsOpen = false;
    syncCampaignClockFromSnapshot(state.world);
    state.worldTab = "overview";
    state.worldNotice = "存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。";
    renderActiveWorld();
  } catch (error) {
    subPage("无法载入存档", "该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。", `<p class="error-state">${escapeHtml(error.message)}</p>`);
  }
}

async function showSaves() {
  state.page = "saves";
  if (!hostAvailable()) return subPage("读取存档", "存档列表需要桌面运行环境。", '<p class="empty-state">请通过游戏启动器打开。</p>');
  try {
    state.slots = await window.gameHost.save.listSlots();
    const cards = state.slots.map(slot => `
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${escapeHtml(slot.id)}</span><h3>${escapeHtml(slot.metadata?.name || "无法读取的存档")}</h3><p>${slot.status === "ok" ? (slot.hasWorld ? "世界存档正常 · 载入时会校验 Mod 内容版本" : "旧版本空数据槽 · 尚无可载入的世界") : slot.status === "incompatible" ? "存档版本不兼容" : "存档数据或元数据有问题：" + escapeHtml(slot.error)}</p><small>${escapeHtml(slot.metadata?.updated_at || slot.metadata?.created_at || "无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${slot.status}">${slot.status === "ok" ? "正常" : slot.status === "incompatible" ? "不兼容" : "损坏"}</span>${slot.status === "ok" && slot.hasWorld ? `<button class="small-button" data-action="load-save" data-id="${escapeHtml(slot.id)}">载入</button>` : ""}<button class="small-button danger" data-action="delete-save" data-id="${escapeHtml(slot.id)}">删除</button></div>
      </article>`).join("");
    subPage("读取存档", "世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。", cards || '<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>');
  } catch (error) {
    subPage("读取存档", "读取存档列表时发生错误。", `<p class="error-state">${escapeHtml(error.message)}</p>`);
  }
}

async function showSettings() {
  state.page = "settings";
  if (!hostAvailable()) return subPage("设置", "桌面设置接口不可用。", '<p class="empty-state">请通过游戏启动器打开。</p>');
  try {
    state.settings = await window.gameHost.settings.read();
    const general = state.settings.general;
    const graphics = state.settings.graphics;
    const audio = state.settings.audio;
    const simulation = state.settings.simulation;
    subPage("设置", "修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。", `
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${general.window_mode === "windowed" ? "selected" : ""}>窗口化</option><option value="borderless" ${general.window_mode === "borderless" ? "selected" : ""}>无边框全屏</option><option value="exclusive" ${general.window_mode === "exclusive" ? "selected" : ""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(v => `<option value="${v}" ${graphics.ui_scale === v ? "selected" : ""}>${v}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(v => `<option value="${v}" ${simulation.base_day_seconds === v ? "selected" : ""}>${v} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(v => `<option value="${v}" ${audio.master_volume === v ? "selected" : ""}>${v}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `);
  } catch (error) {
    subPage("设置", "无法读取配置文件。", `<p class="error-state">${escapeHtml(error.message)}</p>`);
  }
}

async function showMods() {
  state.page = "mods";
  if (!hostAvailable()) return subPage("模组管理", "桌面 Mod 接口不可用。", '<p class="empty-state">请通过游戏启动器打开。</p>');
  try {
    state.mods = await window.gameHost.mods.list();
    const cards = state.mods.map(mod => {
      const enabled = mod.id === "core" || mod.enabled !== false;
      return `
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${escapeHtml(mod.id)} · API ${escapeHtml(mod.apiVersion ?? "—")}</span><h3>${escapeHtml(mod.name)}</h3><p>${escapeHtml(mod.description || mod.error || "无描述")}</p><small>作者：${escapeHtml(mod.author)}　版本：${escapeHtml(mod.version)}</small>${mod.error ? `<p class="error-state">${escapeHtml(mod.error)}</p>` : ""}</div>
          <div class="card-actions"><span class="status-pill ${enabled ? "ok" : "off"}">${enabled ? "已启用" : "已禁用"}</span>${mod.id === "core" ? '<span class="locked-label">核心锁定</span>' : `<button class="small-button" data-action="toggle-mod" data-id="${escapeHtml(mod.id)}" data-enabled="${enabled}">${enabled ? "禁用" : "启用"}</button>`}</div>
        </article>`;
    }).join("");
    subPage("模组管理", "Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。", cards || '<p class="empty-state">mods/ 中尚未发现模组。</p>');
  } catch (error) {
    subPage("模组管理", "扫描模组时发生错误。", `<p class="error-state">${escapeHtml(error.message)}</p>`);
  }
}

async function navigate(page) {
  state.page = page;
  if (page === "home") return homePage();
  if (page === "saves") return showSaves();
  if (page === "settings") return showSettings();
  if (page === "mods") return showMods();
  if (page === "new") return enterNewWorld();
}

app.addEventListener("click", async (event) => {
  const worldTab = event.target.closest("[data-world-tab]");
  if (worldTab && state.world) {
    state.worldTab = worldTab.dataset.worldTab;
    state.worldNotice = "";
    return renderActiveWorld();
  }

  const worldAction = event.target.closest("[data-world-action]");
  if (worldAction && state.world && worldAction.dataset.worldAction === "toggle-audit" && !state.busy) {
    state.auditOpen = !state.auditOpen;
    if (state.auditOpen) state.domainEventsOpen = false;
    updateCalculationAuditPanel();
    updateDomainEventsPanel();
    return;
  }
  if (worldAction && state.world && worldAction.dataset.worldAction === "toggle-domain-events" && !state.busy) {
    state.domainEventsOpen = !state.domainEventsOpen;
    if (state.domainEventsOpen) state.auditOpen = false;
    updateDomainEventsPanel();
    updateCalculationAuditPanel();
    return;
  }
  if (worldAction && state.world && !state.busy) {
    worldViewEpoch += 1;
    state.busy = true;
    try {
      const action = worldAction.dataset.worldAction;
      if (action === "set-speed") {
        const speed = Number(worldAction.dataset.speed);
        state.world = await window.gameHost.world.setSpeed(speed);
        syncCampaignClockFromSnapshot(state.world);
        state.worldNotice = speed === 0 ? "世界时间已暂停。" : `世界时间已切换为 ${speed}x。`;
      } else if (action === "advance") {
        state.world = await window.gameHost.world.advanceDay();
        syncCampaignClockFromSnapshot(state.world);
        state.worldNotice = "兼容性调试操作：世界时间已推进一天。";
      } else if (action === "save") {
        const result = await window.gameHost.world.save();
        state.world.dirty = false;
        const clockStatus = await window.gameHost.world.getClockStatus();
        syncCampaignClock(clockStatus);
        state.worldNotice = `世界已保存：${result.saveId}`;
      } else if (action === "leave") {
        if (state.world.dirty && !window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")) return;
        await window.gameHost.world.leave();
        worldViewEpoch += 1;
        stopCampaignClockAnimation();
        worldClockView = null;
        worldClockElements = null;
        state.world = null;
        state.auditOpen = false;
        state.domainEventsOpen = false;
        state.worldNotice = "";
        return homePage();
      }
      renderActiveWorld();
    } catch (error) {
      state.worldNotice = `操作失败：${error.message}`;
      renderActiveWorld();
    } finally {
      state.busy = false;
    }
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button || state.busy) return;
  const action = button.dataset.action;
  try {
    if (action === "copy-fatal-error") {
      const report = document.querySelector("#fatal-error-report");
      if (report) {
        report.focus();
        report.select();
        await navigator.clipboard.writeText(report.value);
        button.textContent = "已复制";
      }
      return;
    }
    if (action === "close-fatal-error") {
      document.querySelector(".fatal-error-backdrop")?.remove();
      return;
    }
    if (action === "home") return homePage();
    if (action === "new" || action === "saves" || action === "settings" || action === "mods") return navigate(action);
    if (action === "quit") {
      if (hostAvailable()) await window.gameHost.app.quit();
      else subPage("退出", "浏览器预览模式无法关闭桌面应用。", '<p class="empty-state">请关闭浏览器窗口。</p>');
    }
    if (action === "save-settings") {
      const result = document.querySelector("#settings-result");
      const patch = {
        general: { window_mode: document.querySelector("#window-mode").value },
        graphics: { ui_scale: Number(document.querySelector("#ui-scale").value) },
        audio: { master_volume: Number(document.querySelector("#master-volume").value) },
        simulation: { base_day_seconds: Number(document.querySelector("#base-day-seconds").value) }
      };
      await window.gameHost.settings.write(patch);
      result.textContent = "已保存。窗口模式已应用，部分设置可能需要重启。";
    }
    if (action === "delete-save") {
      const id = button.dataset.id;
      if (!window.confirm(`确定永久删除存档 ${id} 吗？此操作不可撤销。`)) return;
      await window.gameHost.save.removeSlot(id);
      await showSaves();
    }
    if (action === "load-save") return loadWorld(button.dataset.id);
    if (action === "toggle-mod") {
      const id = button.dataset.id;
      const enabled = button.dataset.enabled === "true";
      await window.gameHost.settings.write({ mods: { enabled: { [id]: !enabled } } });
      await showMods();
      const note = document.createElement("p");
      note.className = "notice";
      note.textContent = "状态已保存，重启游戏后生效。";
      document.querySelector(".subpage-body")?.prepend(note);
    }
  } catch (error) {
    const target = document.querySelector("#settings-result") || document.querySelector(".subpage-body");
    if (target) target.textContent = "操作失败：" + error.message;
  }
});

homePage();
if (hostAvailable()) window.gameHost.app.onWorldFatalError(showFatalError);
