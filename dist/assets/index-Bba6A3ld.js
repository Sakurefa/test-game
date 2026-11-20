(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))l(t);new MutationObserver(t=>{for(const i of t)if(i.type==="childList")for(const n of i.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&l(n)}).observe(document,{childList:!0,subtree:!0});function d(t){const i={};return t.integrity&&(i.integrity=t.integrity),t.referrerPolicy&&(i.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?i.credentials="include":t.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function l(t){if(t.ep)return;t.ep=!0;const i=d(t);fetch(t.href,i)}})();function o(e){return String(e??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a])}function f(e,a){return e.localization?.[a]||`[${a||"missing-localization-key"}]`}function r(e,a,d=""){return a?.nameKey?f(e,a.nameKey):d}function y(e,a){return a?.descriptionKey?f(e,a.descriptionKey):""}function w(e){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(e||0)}function T(e){const a=e.colonies.reduce((t,i)=>t+i.state.population,0),d=e.wars.filter(t=>t.state.status==="active").length,l=e.factions.find(t=>t.id===e.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${o(e.universe.id)}</span><h2>${o(r(e,e.universe))}</h2><p>${o(y(e,e.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${o(r(e,l,"未知势力"))}</b><small>种子：${e.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${e.systems.length}</b></article>
      <article><small>殖民地</small><b>${e.colonies.length}</b></article>
      <article><small>总人口</small><b>${w(a)}</b></article>
      <article><small>活跃战争</small><b>${d}</b></article>
      <article><small>可用资金</small><b>${w(e.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${e.systems.map(t=>{const i=e.factions.find(n=>n.id===t.factionId);return`
          <article class="system-card">
            <span class="system-coordinate">${t.position.x}, ${t.position.y}</span>
            <h4>${o(r(e,t))}</h4>
            <p>${o(y(e,t))}</p>
            <small>所属势力：${o(r(e,i,"中立"))}</small>
            <div class="system-links">${t.links.map(n=>o(r(e,e.systems.find(u=>u.id===n),n))).join(" · ")}</div>
            <div class="system-locations">${t.locations.map(n=>o(r(e,n,n.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${e.tradeRoutes.map(t=>{const i=e.systems.find(u=>u.id===t.fromSystemId),n=e.systems.find(u=>u.id===t.toSystemId);return`<span><b>${o(r(e,t,t.id))}</b><small>${o(r(e,i,t.fromSystemId))} → ${o(r(e,n,t.toSystemId))} · ${t.travelDays} 天 · 风险 ${Math.round(t.risk*100)}% · 容量 ${w(t.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${e.recentEvents.map(t=>`
        <article><time>第 ${t.day} 天 · ${o(t.date)}</time><p>${o(t.text)}</p></article>
      `).join("")}</div>
    </section>`}function k(e){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${e.colonies.map(a=>{const d=Object.entries(a.state.stockpiles).map(([t,i])=>{const n=e.commodities.find(u=>u.id===t);return`<span><small>${o(r(e,n,t))}</small><b>${w(i)} ${o(n?.unitKey?f(e,n.unitKey):"")}</b></span>`}).join(""),l=a.state.industries.map(t=>{const i=e.recipes.find(n=>n.id===t.recipeId);return`<li>${o(r(e,i,t.recipeId))} <small>等级 ${t.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${o(a.location.systemId)}</span><h4>${o(r(e,a))}</h4><p>${o(r(e,a.faction))} · ${o(r(e,a.location))}</p></div><b class="stability">${a.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${w(a.state.population)}</b></div>
              <div class="stock-grid">${d}</div>
              <div class="industry-list"><b>生产设施</b><ul>${l}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function x(e){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${e.markets.map(a=>{const d=e.colonies.find(l=>l.id===a.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${o(a.id)}</span><h4>${o(r(e,a))}</h4><p>${o(r(e,d,a.colonyId))}</p></div>
            <div class="quote-table">
              ${a.instruments.map(l=>`
                <div class="quote-row">
                  <div><b>${o(l.ticker||l.name)}</b><small>${o(l.name)} · ${l.kind==="equity"?"证券":o(l.unit)}</small></div>
                  <div class="quote-value"><b>${w(l.price)}</b><small class="${l.change>0?"positive":l.change<0?"negative":""}">${l.change>0?"+":""}${w(l.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`}).join("")}
      </div>
    </section>`}function q(e){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${e.factions.map(a=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(a.color)?a.color:"#8ca8c8"}"></i><div><b>${o(r(e,a))}</b><small>${o(f(e,a.governmentKey))} · ${o(y(e,a))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${e.fleets.map(a=>{const d=e.systems.flatMap(l=>l.locations).find(l=>l.id===a.locationId);return`
          <article class="fleet-row"><div><b>${o(r(e,a))}</b><small>${o(r(e,a.faction))} · ${o(r(e,d,a.locationId))}</small><p>${a.ships.map(l=>{const t=e.shipClasses.find(i=>i.id===l.shipClassId);return`${o(r(e,t,l.shipClassId))} × ${l.quantity}`}).join("　")}</p></div><span>${a.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${e.wars.map(a=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${o(r(e,a))}</h4><p>${o(y(e,a))}</p><div><b>${a.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${a.state.daysActive} 天</span><span>${a.participants.map(d=>o(r(e,e.factions.find(l=>l.id===d),d))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function A(e,a="overview",d=""){const l=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],t=a==="colonies"?k(e):a==="markets"?x(e):a==="military"?q(e):T(e);return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date"><small>GALACTIC DATE</small><b data-world-date>${o(e.world.clock.date)}</b><span data-world-day>第 ${e.world.clock.day} 天 · 第 ${Math.floor(e.world.clock.day/7)+1} 周 · ${Math.floor((e.world.clock.dayFraction||0)*100)}% 日进度</span></div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${l.map(([i,n])=>`<button data-world-tab="${i}" class="${a===i?"active":""}">${n}</button>`).join("")}</div>
        <div class="world-actions">
          <span class="time-control-label" data-time-label>${e.timeControl?.paused?"时间已暂停":`世界时间 · ${e.timeControl?.speed||1}x`}</span>
          <div class="time-speed-buttons">
            <button data-world-action="set-speed" data-speed="0" title="暂停世界时间" class="${e.timeControl?.speed===0?"selected":""}" aria-pressed="${e.timeControl?.speed===0}">Ⅱ</button>
            <button data-world-action="set-speed" data-speed="1" title="以 1 倍速度运行" class="${e.timeControl?.speed===1?"selected":""}" aria-pressed="${e.timeControl?.speed===1}">1x</button>
            <button data-world-action="set-speed" data-speed="2" title="以 2 倍速度运行" class="${e.timeControl?.speed===2?"selected":""}" aria-pressed="${e.timeControl?.speed===2}">2x</button>
            <button data-world-action="set-speed" data-speed="3" title="以 3 倍速度运行" class="${e.timeControl?.speed===3?"selected":""}" aria-pressed="${e.timeControl?.speed===3}">3x</button>
            <button data-world-action="set-speed" data-speed="4" title="以 4 倍速度运行" class="${e.timeControl?.speed===4?"selected":""}" aria-pressed="${e.timeControl?.speed===4}">4x</button>
          </div>
          <button data-world-action="save">保存世界</button>
          <button data-world-action="leave">返回主菜单</button>
        </div>
      </div>
      ${d?`<div class="world-notice">${o(d)}</div>`:""}
      <div class="world-content">${t}</div>
      <footer class="world-footer"><span data-save-status>存档：${o(e.saveId||"未命名")} · ${e.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${e.world.schemaVersion} · 内容指纹 ${e.world.contentHash.slice(0,10)}</span></footer>
    </main>`}const p=document.querySelector("#app"),s={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:""};function c(e){return String(e??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a])}function v(){return!!window.gameHost}function S(e){p.innerHTML=`
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
        <section class="menu-panel">${e}</section>
      </div>
      <footer class="title-footer">
        <span>INDEPENDENT DESKTOP EXPERIENCE</span>
        <span>ENGINE PROTOTYPE 0.2</span>
      </footer>
    </main>`}function $(){s.page="home",S(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${v()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function m(e,a,d){S(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${c(e)}</span><h2>${c(e)}</h2><p>${c(a)}</p></div>
    <div class="subpage-body">${d}</div>
  `)}function b(){if(!s.world)return $();s.page="world",p.innerHTML=A(s.world,s.worldTab,s.worldNotice)}function M(e){const a=e.world.clock.day,d=Math.floor(a/7)+1,l=Math.floor((e.world.clock.dayFraction||0)*100),t=p.querySelector("[data-world-day]");t&&(t.textContent=`第 ${a} 天 · 第 ${d} 周 · ${l}% 日进度`);const i=p.querySelector("[data-world-date]");i&&(i.textContent=e.world.clock.date);const n=p.querySelector("[data-time-label]");n&&(n.textContent=e.timeControl?.paused?"时间已暂停":`世界时间 · ${e.timeControl?.speed||1}x`);for(const g of p.querySelectorAll("[data-world-action='set-speed']")){const N=Number(g.dataset.speed)===e.timeControl?.speed;g.classList.toggle("selected",N),g.setAttribute("aria-pressed",String(N))}const u=p.querySelector("[data-save-status]");u&&(u.textContent=`存档：${e.saveId||"未命名"} · ${e.dirty?"有未保存更改":"已保存"}`)}let I=!1;setInterval(async()=>{if(!(!v()||s.page!=="world"||!s.world||s.busy||I)){I=!0;try{const e=await window.gameHost.world.getStatus();if(s.page==="world"&&s.world){const a=s.world.clock.day;s.world=e,e.world.clock.day!==a?b():M(e)}}catch(e){console.error("World status polling failed",e)}finally{I=!1}}},500);async function j(){if(!v())return m("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{s.world=await window.gameHost.world.startNew(),s.worldTab="overview",s.worldNotice="新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。",b()}catch(e){m("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${c(e.message)}</p>`)}}async function O(e){try{s.world=await window.gameHost.world.loadSave(e),s.worldTab="overview",s.worldNotice="存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。",b()}catch(a){m("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${c(a.message)}</p>`)}}async function C(){if(s.page="saves",!v())return m("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.slots=await window.gameHost.save.listSlots();const e=s.slots.map(a=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${c(a.id)}</span><h3>${c(a.metadata?.name||"无法读取的存档")}</h3><p>${a.status==="ok"?a.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":a.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+c(a.error)}</p><small>${c(a.metadata?.updated_at||a.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${a.status}">${a.status==="ok"?"正常":a.status==="incompatible"?"不兼容":"损坏"}</span>${a.status==="ok"&&a.hasWorld?`<button class="small-button" data-action="load-save" data-id="${c(a.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${c(a.id)}">删除</button></div>
      </article>`).join("");m("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",e||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(e){m("读取存档","读取存档列表时发生错误。",`<p class="error-state">${c(e.message)}</p>`)}}async function R(){if(s.page="settings",!v())return m("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.settings=await window.gameHost.settings.read();const e=s.settings.general,a=s.settings.graphics,d=s.settings.audio,l=s.settings.simulation;m("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(t=>`<option value="${t}" ${a.ui_scale===t?"selected":""}>${t}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(t=>`<option value="${t}" ${l.base_day_seconds===t?"selected":""}>${t} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(t=>`<option value="${t}" ${d.master_volume===t?"selected":""}>${t}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){m("设置","无法读取配置文件。",`<p class="error-state">${c(e.message)}</p>`)}}async function E(){if(s.page="mods",!v())return m("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.mods=await window.gameHost.mods.list();const e=s.mods.map(a=>{const d=a.id==="core"||a.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${c(a.id)} · API ${c(a.apiVersion??"—")}</span><h3>${c(a.name)}</h3><p>${c(a.description||a.error||"无描述")}</p><small>作者：${c(a.author)}　版本：${c(a.version)}</small>${a.error?`<p class="error-state">${c(a.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${d?"ok":"off"}">${d?"已启用":"已禁用"}</span>${a.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${c(a.id)}" data-enabled="${d}">${d?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");m("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){m("模组管理","扫描模组时发生错误。",`<p class="error-state">${c(e.message)}</p>`)}}async function H(e){if(s.page=e,e==="home")return $();if(e==="saves")return C();if(e==="settings")return R();if(e==="mods")return E();if(e==="new")return j()}p.addEventListener("click",async e=>{const a=e.target.closest("[data-world-tab]");if(a&&s.world)return s.worldTab=a.dataset.worldTab,s.worldNotice="",b();const d=e.target.closest("[data-world-action]");if(d&&s.world&&!s.busy){s.busy=!0;try{const i=d.dataset.worldAction;if(i==="set-speed"){const n=Number(d.dataset.speed);s.world=await window.gameHost.world.setSpeed(n),s.worldNotice=n===0?"世界时间已暂停。":`世界时间已切换为 ${n}x。`}else if(i==="advance")s.world=await window.gameHost.world.advanceDay(),s.worldNotice="兼容性调试操作：世界时间已推进一天。";else if(i==="save"){const n=await window.gameHost.world.save();s.world.dirty=!1,s.worldNotice=`世界已保存：${n.saveId}`}else if(i==="leave")return s.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),s.world=null,s.worldNotice="",$());b()}catch(i){s.worldNotice=`操作失败：${i.message}`,b()}finally{s.busy=!1}return}const l=e.target.closest("[data-action]");if(!l||s.busy)return;const t=l.dataset.action;try{if(t==="home")return $();if(t==="new"||t==="saves"||t==="settings"||t==="mods")return H(t);if(t==="quit"&&(v()?await window.gameHost.app.quit():m("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),t==="save-settings"){const i=document.querySelector("#settings-result"),n={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)},simulation:{base_day_seconds:Number(document.querySelector("#base-day-seconds").value)}};await window.gameHost.settings.write(n),i.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(t==="delete-save"){const i=l.dataset.id;if(!window.confirm(`确定永久删除存档 ${i} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(i),await C()}if(t==="load-save")return O(l.dataset.id);if(t==="toggle-mod"){const i=l.dataset.id,n=l.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[i]:!n}}}),await E();const u=document.createElement("p");u.className="notice",u.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(u)}}catch(i){const n=document.querySelector("#settings-result")||document.querySelector(".subpage-body");n&&(n.textContent="操作失败："+i.message)}});$();
