(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function l(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(a){if(a.ep)return;a.ep=!0;const o=l(a);fetch(a.href,o)}})();function n(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function S(e,t){return e.localization?.[t]||`[${t||"missing-localization-key"}]`}function c(e,t,l=""){return t?.nameKey?S(e,t.nameKey):l}function I(e,t){return t?.descriptionKey?S(e,t.descriptionKey):""}function b(e){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(e||0)}function j(e){const t=e.colonies.reduce((a,o)=>a+o.state.population,0),l=e.wars.filter(a=>a.state.status==="active").length,i=e.factions.find(a=>a.id===e.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${n(e.universe.id)}</span><h2>${n(c(e,e.universe))}</h2><p>${n(I(e,e.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${n(c(e,i,"未知势力"))}</b><small>种子：${e.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${e.systems.length}</b></article>
      <article><small>殖民地</small><b>${e.colonies.length}</b></article>
      <article><small>总人口</small><b>${b(t)}</b></article>
      <article><small>活跃战争</small><b>${l}</b></article>
      <article><small>可用资金</small><b>${b(e.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${e.systems.map(a=>{const o=e.factions.find(r=>r.id===a.factionId);return`
          <article class="system-card">
            <span class="system-coordinate">${a.position.x}, ${a.position.y}</span>
            <h4>${n(c(e,a))}</h4>
            <p>${n(I(e,a))}</p>
            <small>所属势力：${n(c(e,o,"中立"))}</small>
            <div class="system-links">${a.links.map(r=>n(c(e,e.systems.find(m=>m.id===r),r))).join(" · ")}</div>
            <div class="system-locations">${a.locations.map(r=>n(c(e,r,r.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${e.tradeRoutes.map(a=>{const o=e.systems.find(m=>m.id===a.fromSystemId),r=e.systems.find(m=>m.id===a.toSystemId);return`<span><b>${n(c(e,a,a.id))}</b><small>${n(c(e,o,a.fromSystemId))} → ${n(c(e,r,a.toSystemId))} · ${a.travelDays} 天 · 风险 ${Math.round(a.risk*100)}% · 容量 ${b(a.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${e.recentEvents.map(a=>`
        <article><time>第 ${a.day} 天 · ${n(a.date)}</time><p>${n(a.text)}</p></article>
      `).join("")}</div>
    </section>`}function O(e){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${e.colonies.map(t=>{const l=Object.entries(t.state.stockpiles).map(([a,o])=>{const r=e.commodities.find(m=>m.id===a);return`<span><small>${n(c(e,r,a))}</small><b>${b(o)} ${n(r?.unitKey?S(e,r.unitKey):"")}</b></span>`}).join(""),i=t.state.industries.map(a=>{const o=e.recipes.find(r=>r.id===a.recipeId);return`<li>${n(c(e,o,a.recipeId))} <small>等级 ${a.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${n(t.location.systemId)}</span><h4>${n(c(e,t))}</h4><p>${n(c(e,t.faction))} · ${n(c(e,t.location))}</p></div><b class="stability">${t.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${b(t.state.population)}</b></div>
              <div class="stock-grid">${l}</div>
              <div class="industry-list"><b>生产设施</b><ul>${i}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function H(e){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${e.markets.map(t=>{const l=e.colonies.find(i=>i.id===t.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${n(t.id)}</span><h4>${n(c(e,t))}</h4><p>${n(c(e,l,t.colonyId))}</p></div>
            <div class="quote-table">
              ${t.instruments.map(i=>`
                <div class="quote-row">
                  <div><b>${n(i.ticker||i.name)}</b><small>${n(i.name)} · ${i.kind==="equity"?"证券":n(i.unit)}</small></div>
                  <div class="quote-value"><b>${b(i.price)}</b><small class="${i.change>0?"positive":i.change<0?"negative":""}">${i.change>0?"+":""}${b(i.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`}).join("")}
      </div>
    </section>`}function L(e){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${e.factions.map(t=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(t.color)?t.color:"#8ca8c8"}"></i><div><b>${n(c(e,t))}</b><small>${n(S(e,t.governmentKey))} · ${n(I(e,t))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${e.fleets.map(t=>{const l=e.systems.flatMap(i=>i.locations).find(i=>i.id===t.locationId);return`
          <article class="fleet-row"><div><b>${n(c(e,t))}</b><small>${n(c(e,t.faction))} · ${n(c(e,l,t.locationId))}</small><p>${t.ships.map(i=>{const a=e.shipClasses.find(o=>o.id===i.shipClassId);return`${n(c(e,a,i.shipClassId))} × ${i.quantity}`}).join("　")}</p></div><span>${t.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${e.wars.map(t=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${n(c(e,t))}</h4><p>${n(I(e,t))}</p><div><b>${t.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${t.state.daysActive} 天</span><span>${t.participants.map(l=>n(c(e,e.factions.find(i=>i.id===l),l))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function P(e,t="overview",l=""){const i=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],a=t==="colonies"?O(e):t==="markets"?H(e):t==="military"?L(e):j(e);return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date">
          <small>GALACTIC DATE</small>
          <b data-world-date>${n(e.world.clock.date)}</b>
          <div class="world-day-summary"><span data-world-day>第 ${e.world.clock.day} 天 · 第 ${Math.floor(e.world.clock.day/7)+1} 周</span><strong data-world-percent>${((e.world.clock.dayFraction||0)*100).toFixed(1)}%</strong></div>
          <div class="campaign-day-track" data-world-progress-track role="progressbar" aria-label="当前游戏日进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${((e.world.clock.dayFraction||0)*100).toFixed(1)}"><span data-world-progress style="width:${((e.world.clock.dayFraction||0)*100).toFixed(1)}%"></span></div>
        </div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${i.map(([o,r])=>`<button data-world-tab="${o}" class="${t===o?"active":""}">${r}</button>`).join("")}</div>
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
      ${l?`<div class="world-notice">${n(l)}</div>`:""}
      <div class="world-content">${a}</div>
      <footer class="world-footer"><span data-save-status>存档：${n(e.saveId||"未命名")} · ${e.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${e.world.schemaVersion} · 内容指纹 ${e.world.contentHash.slice(0,10)}</span></footer>
    </main>`}function _({dayFraction:e,speed:t,baseDayDurationMs:l,elapsedMs:i}){if(!Number.isFinite(e)||e<0||e>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");if(!Number.isFinite(t)||t<0||t>4)throw new RangeError("Campaign display speed must be between 0x and 4x");if(!Number.isFinite(l)||l<=0)throw new RangeError("Base game-day duration must be positive");if(!Number.isFinite(i)||i<0)throw new RangeError("Elapsed display time must be non-negative");const a=e+(t===0?0:i*t/l);return Math.max(0,Math.min(.999,a))}const v=document.querySelector("#app"),s={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:""};function u(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function y(){return!!window.gameHost}function T(e){v.innerHTML=`
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
    </main>`}function C(){s.page="home",T(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${y()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function w(e,t,l){T(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${u(e)}</span><h2>${u(e)}</h2><p>${u(t)}</p></div>
    <div class="subpage-body">${l}</div>
  `)}let p=null,d=null,f=null,N=!1,$=0;function D(){d={date:v.querySelector("[data-world-date]"),day:v.querySelector("[data-world-day]"),percent:v.querySelector("[data-world-percent]"),progress:v.querySelector("[data-world-progress]"),progressTrack:v.querySelector("[data-world-progress-track]"),status:v.querySelector("[data-time-label]"),speedButtons:[...v.querySelectorAll("[data-world-action='set-speed']")],footer:v.querySelector("[data-save-status]")}}function h(){if(!p||!d)return;const{clock:e,timeControl:t}=p,l=Math.floor(e.day/7)+1;if(d.date&&d.date.textContent!==e.date&&(d.date.textContent=e.date),d.day){const i=`第 ${e.day} 天 · 第 ${l} 周`;d.day.textContent!==i&&(d.day.textContent=i)}if(d.status){const i=t.paused?"时间已暂停":`世界时间 · ${t.speed}x`;d.status.textContent!==i&&(d.status.textContent=i)}for(const i of d.speedButtons){const a=Number(i.dataset.speed)===t.speed;i.classList.contains("selected")!==a&&(i.classList.toggle("selected",a),i.setAttribute("aria-pressed",String(a)))}if(d.footer){const i=`存档：${p.saveId||"未命名"} · ${p.dirty?"有未保存更改":"已保存"}`;d.footer.textContent!==i&&(d.footer.textContent=i)}}function E(){if(!p||!d)return;const{clock:e,timeControl:t}=p,l=t.speed>0?Math.max(0,performance.now()-p.syncedAt):0,a=(_({dayFraction:e.dayFraction||0,speed:t.speed,baseDayDurationMs:t.baseDayDurationMs,elapsedMs:l})*100).toFixed(1);if(d.percent&&d.percent.textContent!==`${a}%`&&(d.percent.textContent=`${a}%`),d.progress){const o=`${a}%`;d.progress.style.width!==o&&(d.progress.style.width=o)}if(d.progressTrack){const o=String(Number(a));d.progressTrack.getAttribute("aria-valuenow")!==o&&d.progressTrack.setAttribute("aria-valuenow",o)}}function A(){f!==null&&(cancelAnimationFrame(f),f=null)}function q(){f=null,!(s.page!=="world"||!s.world||!p)&&(E(),p.timeControl.speed>0&&(f=requestAnimationFrame(q)))}function F(){p?.timeControl.speed>0&&f===null&&(f=requestAnimationFrame(q))}function x(e){!s.world||!e?.clock||!e?.timeControl||(p={clock:{...e.clock},timeControl:{...e.timeControl},saveId:e.saveId??s.world.saveId,dirty:e.dirty??s.world.dirty,syncedAt:performance.now()},s.world.world.clock={...e.clock},s.world.timeControl={...e.timeControl},e.saveId!==void 0&&(s.world.saveId=e.saveId),e.dirty!==void 0&&(s.world.dirty=e.dirty),h(),E(),p.timeControl.speed>0?F():A())}function k(e){x({clock:e.world.clock,timeControl:e.timeControl,saveId:e.saveId,dirty:e.dirty})}function g(){if(!s.world)return C();s.page="world",v.innerHTML=P(s.world,s.worldTab,s.worldNotice),D(),h(),E(),F()}async function W(){if(!y()||s.page!=="world"||!s.world||s.busy||N)return;N=!0;const e=$,t=s.world,l=t.world.clock.day;try{const i=await window.gameHost.world.getClockStatus();if(e!==$||s.page!=="world"||s.world!==t||s.busy)return;if(i.clock.day!==l){const a=await window.gameHost.world.getStatus();if(e!==$||s.page!=="world"||s.world!==t||s.busy)return;s.world=a,k(a),g()}else x(i)}catch(i){console.error("World clock synchronization failed",i)}finally{N=!1}}setInterval(()=>{W()},250);async function K(){if($+=1,!y())return w("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{s.world=await window.gameHost.world.startNew(),k(s.world),s.worldTab="overview",s.worldNotice="新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。",g()}catch(e){w("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${u(e.message)}</p>`)}}async function V(e){$+=1;try{s.world=await window.gameHost.world.loadSave(e),k(s.world),s.worldTab="overview",s.worldNotice="存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。",g()}catch(t){w("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${u(t.message)}</p>`)}}async function R(){if(s.page="saves",!y())return w("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.slots=await window.gameHost.save.listSlots();const e=s.slots.map(t=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${u(t.id)}</span><h3>${u(t.metadata?.name||"无法读取的存档")}</h3><p>${t.status==="ok"?t.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":t.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+u(t.error)}</p><small>${u(t.metadata?.updated_at||t.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${t.status}">${t.status==="ok"?"正常":t.status==="incompatible"?"不兼容":"损坏"}</span>${t.status==="ok"&&t.hasWorld?`<button class="small-button" data-action="load-save" data-id="${u(t.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${u(t.id)}">删除</button></div>
      </article>`).join("");w("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",e||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(e){w("读取存档","读取存档列表时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function z(){if(s.page="settings",!y())return w("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.settings=await window.gameHost.settings.read();const e=s.settings.general,t=s.settings.graphics,l=s.settings.audio,i=s.settings.simulation;w("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(a=>`<option value="${a}" ${t.ui_scale===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(a=>`<option value="${a}" ${i.base_day_seconds===a?"selected":""}>${a} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(a=>`<option value="${a}" ${l.master_volume===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){w("设置","无法读取配置文件。",`<p class="error-state">${u(e.message)}</p>`)}}async function M(){if(s.page="mods",!y())return w("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.mods=await window.gameHost.mods.list();const e=s.mods.map(t=>{const l=t.id==="core"||t.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${u(t.id)} · API ${u(t.apiVersion??"—")}</span><h3>${u(t.name)}</h3><p>${u(t.description||t.error||"无描述")}</p><small>作者：${u(t.author)}　版本：${u(t.version)}</small>${t.error?`<p class="error-state">${u(t.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${l?"ok":"off"}">${l?"已启用":"已禁用"}</span>${t.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${u(t.id)}" data-enabled="${l}">${l?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");w("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){w("模组管理","扫描模组时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function G(e){if(s.page=e,e==="home")return C();if(e==="saves")return R();if(e==="settings")return z();if(e==="mods")return M();if(e==="new")return K()}v.addEventListener("click",async e=>{const t=e.target.closest("[data-world-tab]");if(t&&s.world)return s.worldTab=t.dataset.worldTab,s.worldNotice="",g();const l=e.target.closest("[data-world-action]");if(l&&s.world&&!s.busy){$+=1,s.busy=!0;try{const o=l.dataset.worldAction;if(o==="set-speed"){const r=Number(l.dataset.speed);s.world=await window.gameHost.world.setSpeed(r),k(s.world),s.worldNotice=r===0?"世界时间已暂停。":`世界时间已切换为 ${r}x。`}else if(o==="advance")s.world=await window.gameHost.world.advanceDay(),k(s.world),s.worldNotice="兼容性调试操作：世界时间已推进一天。";else if(o==="save"){const r=await window.gameHost.world.save();s.world.dirty=!1;const m=await window.gameHost.world.getClockStatus();x(m),s.worldNotice=`世界已保存：${r.saveId}`}else if(o==="leave")return s.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),$+=1,A(),p=null,d=null,s.world=null,s.worldNotice="",C());g()}catch(o){s.worldNotice=`操作失败：${o.message}`,g()}finally{s.busy=!1}return}const i=e.target.closest("[data-action]");if(!i||s.busy)return;const a=i.dataset.action;try{if(a==="home")return C();if(a==="new"||a==="saves"||a==="settings"||a==="mods")return G(a);if(a==="quit"&&(y()?await window.gameHost.app.quit():w("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),a==="save-settings"){const o=document.querySelector("#settings-result"),r={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)},simulation:{base_day_seconds:Number(document.querySelector("#base-day-seconds").value)}};await window.gameHost.settings.write(r),o.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(a==="delete-save"){const o=i.dataset.id;if(!window.confirm(`确定永久删除存档 ${o} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(o),await R()}if(a==="load-save")return V(i.dataset.id);if(a==="toggle-mod"){const o=i.dataset.id,r=i.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[o]:!r}}}),await M();const m=document.createElement("p");m.className="notice",m.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(m)}}catch(o){const r=document.querySelector("#settings-result")||document.querySelector(".subpage-body");r&&(r.textContent="操作失败："+o.message)}});C();
