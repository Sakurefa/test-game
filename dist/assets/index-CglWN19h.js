(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();function V({dayFraction:e,speed:t,baseDayDurationMs:n,elapsedMs:i}){if(!Number.isFinite(e)||e<0||e>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");if(!Number.isFinite(t)||t<0||t>4)throw new RangeError("Campaign display speed must be between 0x and 4x");if(!Number.isFinite(n)||n<=0)throw new RangeError("Base game-day duration must be positive");if(!Number.isFinite(i)||i<0)throw new RangeError("Elapsed display time must be non-negative");const a=e+(t===0?0:i*t/n);return Math.max(0,Math.min(.999,a))}function x(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError("Campaign day must be a non-negative integer");if(!Number.isFinite(t)||t<0||t>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");return Math.max(0,Math.min(.999,(e%7+t)/7))}function D({day:e,dayFraction:t,speed:n,baseDayDurationMs:i,elapsedMs:a}){const o=V({dayFraction:t,speed:n,baseDayDurationMs:i,elapsedMs:a});return x(e,o)}function l(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function S(e,t){return e.localization?.[t]||`[${t||"missing-localization-key"}]`}function c(e,t,n=""){return t?.nameKey?S(e,t.nameKey):n}function I(e,t){return t?.descriptionKey?S(e,t.descriptionKey):""}function b(e){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(e||0)}function R(e){return`
    <section class="world-section" data-world-region="recent-events">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${e.recentEvents.map(t=>`
        <article><time>第 ${t.day} 天 · ${l(t.date)}</time><p>${l(t.text)}</p></article>
      `).join("")}</div>
    </section>`}function K(e){const t=e.colonies.reduce((a,o)=>a+o.state.population,0),n=e.wars.filter(a=>a.state.status==="active").length,i=e.factions.find(a=>a.id===e.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${l(e.universe.id)}</span><h2>${l(c(e,e.universe))}</h2><p>${l(I(e,e.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${l(c(e,i,"未知势力"))}</b><small>种子：${e.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${e.systems.length}</b></article>
      <article><small>殖民地</small><b>${e.colonies.length}</b></article>
      <article><small>总人口</small><b>${b(t)}</b></article>
      <article><small>活跃战争</small><b>${n}</b></article>
      <article><small>可用资金</small><b>${b(e.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${e.systems.map(a=>{const o=e.factions.find(r=>r.id===a.factionId);return`
          <article class="system-card">
            <span class="system-coordinate">${a.position.x}, ${a.position.y}</span>
            <h4>${l(c(e,a))}</h4>
            <p>${l(I(e,a))}</p>
            <small>所属势力：${l(c(e,o,"中立"))}</small>
            <div class="system-links">${a.links.map(r=>l(c(e,e.systems.find(m=>m.id===r),r))).join(" · ")}</div>
            <div class="system-locations">${a.locations.map(r=>l(c(e,r,r.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${e.tradeRoutes.map(a=>{const o=e.systems.find(m=>m.id===a.fromSystemId),r=e.systems.find(m=>m.id===a.toSystemId);return`<span><b>${l(c(e,a,a.id))}</b><small>${l(c(e,o,a.fromSystemId))} → ${l(c(e,r,a.toSystemId))} · ${a.travelDays} 天 · 风险 ${Math.round(a.risk*100)}% · 容量 ${b(a.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    ${R(e)}`}function q(e){return`
    <section class="world-section" data-world-region="colony-production">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${e.colonies.map(t=>{const n=Object.entries(t.state.stockpiles).map(([a,o])=>{const r=e.commodities.find(m=>m.id===a);return`<span><small>${l(c(e,r,a))}</small><b>${b(o)} ${l(r?.unitKey?S(e,r.unitKey):"")}</b></span>`}).join(""),i=t.state.industries.map(a=>{const o=e.recipes.find(r=>r.id===a.recipeId);return`<li>${l(c(e,o,a.recipeId))} <small>等级 ${a.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${l(t.location.systemId)}</span><h4>${l(c(e,t))}</h4><p>${l(c(e,t.faction))} · ${l(c(e,t.location))}</p></div><b class="stability">${t.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${b(t.state.population)}</b></div>
              <div class="stock-grid">${n}</div>
              <div class="industry-list"><b>生产设施</b><ul>${i}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function A(e){return`
    <section class="world-section" data-world-region="market-quotes">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${e.markets.map(t=>{const n=e.colonies.find(i=>i.id===t.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${l(t.id)}</span><h4>${l(c(e,t))}</h4><p>${l(c(e,n,t.colonyId))}</p></div>
            <div class="quote-table">
              ${t.instruments.map(i=>`
                <div class="quote-row">
                  <div><b>${l(i.ticker||i.name)}</b><small>${l(i.name)} · ${i.kind==="equity"?"证券":l(i.unit)}</small></div>
                  <div class="quote-value"><b>${b(i.price)}</b><small class="${i.change>0?"positive":i.change<0?"negative":""}">${i.change>0?"+":""}${b(i.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`}).join("")}
      </div>
    </section>`}function F(e){return`
    <section class="world-section" data-world-region="war-chronology">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${e.factions.map(t=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(t.color)?t.color:"#8ca8c8"}"></i><div><b>${l(c(e,t))}</b><small>${l(S(e,t.governmentKey))} · ${l(I(e,t))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${e.fleets.map(t=>{const n=e.systems.flatMap(i=>i.locations).find(i=>i.id===t.locationId);return`
          <article class="fleet-row"><div><b>${l(c(e,t))}</b><small>${l(c(e,t.faction))} · ${l(c(e,n,t.locationId))}</small><p>${t.ships.map(i=>{const a=e.shipClasses.find(o=>o.id===i.shipClassId);return`${l(c(e,a,i.shipClassId))} × ${i.quantity}`}).join("　")}</p></div><span>${t.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${e.wars.map(t=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${l(c(e,t))}</h4><p>${l(I(e,t))}</p><div><b>${t.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${t.state.daysActive} 天</span><span>${t.participants.map(n=>l(c(e,e.factions.find(i=>i.id===n),n))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function z(e,t){switch(t){case"recent-events":return R(e);case"colony-production":return q(e);case"market-quotes":return A(e);case"war-chronology":return F(e);default:return""}}function B(e,t="overview",n=""){const i=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],a=t==="colonies"?q(e):t==="markets"?A(e):t==="military"?F(e):K(e),r=(x(e.world.clock.day,e.world.clock.dayFraction||0)*100).toFixed(1),m=e.world.clock.day%7+1;return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date">
          <small>GALACTIC DATE</small>
          <b data-world-date>${l(e.world.clock.date)}</b>
          <div class="world-day-summary"><span data-world-day>第 ${e.world.clock.day} 天 · 第 ${Math.floor(e.world.clock.day/7)+1} 周 · 本周第 ${m} 天</span><strong data-world-percent>${r}%</strong></div>
          <div class="campaign-week-track" data-world-progress-track role="progressbar" aria-label="当前游戏周进度，划分为七个日刻度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r}">
            <span class="campaign-week-fill" data-world-progress style="width:${r}%"></span>
            <span class="campaign-week-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </div>
        </div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${i.map(([h,_])=>`<button data-world-tab="${h}" class="${t===h?"active":""}">${_}</button>`).join("")}</div>
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
      ${n?`<div class="world-notice">${l(n)}</div>`:""}
      <div class="world-content">${a}</div>
      <footer class="world-footer"><span data-save-status>存档：${l(e.saveId||"未命名")} · ${e.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${e.world.schemaVersion} · 内容指纹 ${e.world.contentHash.slice(0,10)}</span></footer>
    </main>`}const G=Object.freeze([{id:"recent-events",tab:"overview",cadence:"daily"},{id:"colony-production",tab:"colonies",cadence:"weekly"},{id:"market-quotes",tab:"markets",cadence:"daily"},{id:"war-chronology",tab:"military",cadence:"daily"}]);function U({activeTab:e,previousDay:t,currentDay:n}){if(!Number.isInteger(t)||t<0||!Number.isInteger(n)||n<=t)return[];const i=Math.floor(n/7)>Math.floor(t/7);return G.filter(a=>a.tab===e&&(a.cadence==="daily"||i)).map(a=>a.id)}const p=document.querySelector("#app"),s={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:""};function u(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function y(){return!!window.gameHost}function M(e){p.innerHTML=`
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
    </main>`}function C(){s.page="home",M(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${y()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function v(e,t,n){M(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${u(e)}</span><h2>${u(e)}</h2><p>${u(t)}</p></div>
    <div class="subpage-body">${n}</div>
  `)}let w=null,d=null,f=null,N=!1,g=0;function Y(){d={date:p.querySelector("[data-world-date]"),day:p.querySelector("[data-world-day]"),percent:p.querySelector("[data-world-percent]"),progress:p.querySelector("[data-world-progress]"),progressTrack:p.querySelector("[data-world-progress-track]"),status:p.querySelector("[data-time-label]"),speedButtons:[...p.querySelectorAll("[data-world-action='set-speed']")],footer:p.querySelector("[data-save-status]")}}function O(){if(!w||!d)return;const{clock:e,timeControl:t}=w,n=Math.floor(e.day/7)+1,i=e.day%7+1;if(d.date&&d.date.textContent!==e.date&&(d.date.textContent=e.date),d.day){const a=`第 ${e.day} 天 · 第 ${n} 周 · 本周第 ${i} 天`;d.day.textContent!==a&&(d.day.textContent=a)}if(d.status){const a=t.paused?"时间已暂停":`世界时间 · ${t.speed}x`;d.status.textContent!==a&&(d.status.textContent=a)}for(const a of d.speedButtons){const o=Number(a.dataset.speed)===t.speed;a.classList.contains("selected")!==o&&(a.classList.toggle("selected",o),a.setAttribute("aria-pressed",String(o)))}if(d.footer){const a=`存档：${w.saveId||"未命名"} · ${w.dirty?"有未保存更改":"已保存"}`;d.footer.textContent!==a&&(d.footer.textContent=a)}}function E(){if(!w||!d)return;const{clock:e,timeControl:t}=w,n=t.speed>0?Math.max(0,performance.now()-w.syncedAt):0,a=(D({day:e.day,dayFraction:e.dayFraction||0,speed:t.speed,baseDayDurationMs:t.baseDayDurationMs,elapsedMs:n})*100).toFixed(1);if(d.percent&&d.percent.textContent!==`${a}%`&&(d.percent.textContent=`${a}%`),d.progress){const o=`${a}%`;d.progress.style.width!==o&&(d.progress.style.width=o)}if(d.progressTrack){const o=String(Number(a));d.progressTrack.getAttribute("aria-valuenow")!==o&&d.progressTrack.setAttribute("aria-valuenow",o)}}function j(){f!==null&&(cancelAnimationFrame(f),f=null)}function H(){f=null,!(s.page!=="world"||!s.world||!w)&&(E(),w.timeControl.speed>0&&(f=requestAnimationFrame(H)))}function L(){w?.timeControl.speed>0&&f===null&&(f=requestAnimationFrame(H))}function T(e){!s.world||!e?.clock||!e?.timeControl||(w={clock:{...e.clock},timeControl:{...e.timeControl},saveId:e.saveId??s.world.saveId,dirty:e.dirty??s.world.dirty,syncedAt:performance.now()},s.world.world.clock={...e.clock},s.world.timeControl={...e.timeControl},e.saveId!==void 0&&(s.world.saveId=e.saveId),e.dirty!==void 0&&(s.world.dirty=e.dirty),O(),E(),w.timeControl.speed>0?L():j())}function k(e){T({clock:e.world.clock,timeControl:e.timeControl,saveId:e.saveId,dirty:e.dirty})}function $(){if(!s.world)return C();s.page="world",p.innerHTML=B(s.world,s.worldTab,s.worldNotice),Y(),O(),E(),L()}function X(e,t){const n=U({activeTab:s.worldTab,previousDay:t,currentDay:e.world.clock.day});if(n.length===0)return;const i=p.querySelector(".world-content"),a=i?.scrollTop??0;for(const o of n){const r=p.querySelector(`[data-world-region="${o}"]`);if(!r)continue;const m=z(e,o);m&&(r.outerHTML=m)}i&&(i.scrollTop=a)}async function J(){if(!y()||s.page!=="world"||!s.world||s.busy||N)return;N=!0;const e=g,t=s.world,n=t.world.clock.day;try{const i=await window.gameHost.world.getClockStatus();if(e!==g||s.page!=="world"||s.world!==t||s.busy)return;if(i.clock.day!==n){const a=await window.gameHost.world.getStatus();if(e!==g||s.page!=="world"||s.world!==t||s.busy)return;s.world=a,k(a),X(a,n)}else T(i)}catch(i){console.error("World clock synchronization failed",i)}finally{N=!1}}setInterval(()=>{J()},250);async function Q(){if(g+=1,!y())return v("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{s.world=await window.gameHost.world.startNew(),k(s.world),s.worldTab="overview",s.worldNotice="新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。",$()}catch(e){v("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${u(e.message)}</p>`)}}async function Z(e){g+=1;try{s.world=await window.gameHost.world.loadSave(e),k(s.world),s.worldTab="overview",s.worldNotice="存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。",$()}catch(t){v("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${u(t.message)}</p>`)}}async function W(){if(s.page="saves",!y())return v("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.slots=await window.gameHost.save.listSlots();const e=s.slots.map(t=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${u(t.id)}</span><h3>${u(t.metadata?.name||"无法读取的存档")}</h3><p>${t.status==="ok"?t.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":t.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+u(t.error)}</p><small>${u(t.metadata?.updated_at||t.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${t.status}">${t.status==="ok"?"正常":t.status==="incompatible"?"不兼容":"损坏"}</span>${t.status==="ok"&&t.hasWorld?`<button class="small-button" data-action="load-save" data-id="${u(t.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${u(t.id)}">删除</button></div>
      </article>`).join("");v("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",e||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(e){v("读取存档","读取存档列表时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function ee(){if(s.page="settings",!y())return v("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.settings=await window.gameHost.settings.read();const e=s.settings.general,t=s.settings.graphics,n=s.settings.audio,i=s.settings.simulation;v("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(a=>`<option value="${a}" ${t.ui_scale===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(a=>`<option value="${a}" ${i.base_day_seconds===a?"selected":""}>${a} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(a=>`<option value="${a}" ${n.master_volume===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){v("设置","无法读取配置文件。",`<p class="error-state">${u(e.message)}</p>`)}}async function P(){if(s.page="mods",!y())return v("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.mods=await window.gameHost.mods.list();const e=s.mods.map(t=>{const n=t.id==="core"||t.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${u(t.id)} · API ${u(t.apiVersion??"—")}</span><h3>${u(t.name)}</h3><p>${u(t.description||t.error||"无描述")}</p><small>作者：${u(t.author)}　版本：${u(t.version)}</small>${t.error?`<p class="error-state">${u(t.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${n?"ok":"off"}">${n?"已启用":"已禁用"}</span>${t.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${u(t.id)}" data-enabled="${n}">${n?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");v("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){v("模组管理","扫描模组时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function te(e){if(s.page=e,e==="home")return C();if(e==="saves")return W();if(e==="settings")return ee();if(e==="mods")return P();if(e==="new")return Q()}p.addEventListener("click",async e=>{const t=e.target.closest("[data-world-tab]");if(t&&s.world)return s.worldTab=t.dataset.worldTab,s.worldNotice="",$();const n=e.target.closest("[data-world-action]");if(n&&s.world&&!s.busy){g+=1,s.busy=!0;try{const o=n.dataset.worldAction;if(o==="set-speed"){const r=Number(n.dataset.speed);s.world=await window.gameHost.world.setSpeed(r),k(s.world),s.worldNotice=r===0?"世界时间已暂停。":`世界时间已切换为 ${r}x。`}else if(o==="advance")s.world=await window.gameHost.world.advanceDay(),k(s.world),s.worldNotice="兼容性调试操作：世界时间已推进一天。";else if(o==="save"){const r=await window.gameHost.world.save();s.world.dirty=!1;const m=await window.gameHost.world.getClockStatus();T(m),s.worldNotice=`世界已保存：${r.saveId}`}else if(o==="leave")return s.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),g+=1,j(),w=null,d=null,s.world=null,s.worldNotice="",C());$()}catch(o){s.worldNotice=`操作失败：${o.message}`,$()}finally{s.busy=!1}return}const i=e.target.closest("[data-action]");if(!i||s.busy)return;const a=i.dataset.action;try{if(a==="home")return C();if(a==="new"||a==="saves"||a==="settings"||a==="mods")return te(a);if(a==="quit"&&(y()?await window.gameHost.app.quit():v("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),a==="save-settings"){const o=document.querySelector("#settings-result"),r={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)},simulation:{base_day_seconds:Number(document.querySelector("#base-day-seconds").value)}};await window.gameHost.settings.write(r),o.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(a==="delete-save"){const o=i.dataset.id;if(!window.confirm(`确定永久删除存档 ${o} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(o),await W()}if(a==="load-save")return Z(i.dataset.id);if(a==="toggle-mod"){const o=i.dataset.id,r=i.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[o]:!r}}}),await P();const m=document.createElement("p");m.className="notice",m.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(m)}}catch(o){const r=document.querySelector("#settings-result")||document.querySelector(".subpage-body");r&&(r.textContent="操作失败："+o.message)}});C();
