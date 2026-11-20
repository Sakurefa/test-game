(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&o(l)}).observe(document,{childList:!0,subtree:!0});function i(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(a){if(a.ep)return;a.ep=!0;const n=i(a);fetch(a.href,n)}})();function B({dayFraction:e,speed:t,baseDayDurationMs:i,elapsedMs:o}){if(!Number.isFinite(e)||e<0||e>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");if(!Number.isFinite(t)||t<0||t>4)throw new RangeError("Campaign display speed must be between 0x and 4x");if(!Number.isFinite(i)||i<=0)throw new RangeError("Base game-day duration must be positive");if(!Number.isFinite(o)||o<0)throw new RangeError("Elapsed display time must be non-negative");const a=e+(t===0?0:o*t/i);return Math.max(0,Math.min(.999,a))}function x(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError("Campaign day must be a non-negative integer");if(!Number.isFinite(t)||t<0||t>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");return Math.max(0,Math.min(.999,(e%7+t)/7))}function U({day:e,dayFraction:t,speed:i,baseDayDurationMs:o,elapsedMs:a}){const n=B({dayFraction:t,speed:i,baseDayDurationMs:o,elapsedMs:a});return x(e,n)}function G(e,t=30){if(!Number.isInteger(t)||t<1)throw new RangeError("Calculation record limit must be a positive integer");const i=e?.audit?.calculations;return Array.isArray(i)?i.slice(-t).reverse():[]}function r(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}const Y=Object.freeze({"economy.commodity-price":"商品市场定价","economy.security-price":"证券价格计算"});function $(e){return r(JSON.stringify(e??null,null,2))}function J(e){const t=Y[e.formulaId]||e.formulaId,i=Array.isArray(e.randomDraws)?e.randomDraws:[];return`
    <details class="audit-record">
      <summary>
        <span><b>第 ${e.day??"—"} 天 · ${r(t)}</b><small>${r(e.formulaId)} · v${e.version}</small></span>
        <em>${i.length} 次随机抽取</em>
      </summary>
      <div class="audit-record-body">
        <section><h5>输入参数</h5><pre>${$(e.inputs)}</pre></section>
        <section><h5>中间步骤</h5><pre>${$(e.steps)}</pre></section>
        <section><h5>修正项</h5><pre>${$(e.modifiers)}</pre></section>
        <section><h5>实际随机抽取</h5><pre>${$(i)}</pre></section>
        <section><h5>最终结果</h5><pre>${$(e.result)}</pre></section>
      </div>
    </details>`}function R(e){const t=G(e.world,30),i=t.length?t.map(J).join(""):'<div class="audit-empty">尚无计算记录。市场完成下一次每日结算后，相关公式记录会出现在这里。</div>';return`
    <aside class="calculation-audit-panel" data-audit-panel aria-label="计算审计只读面板">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">CALCULATION TRACE / READ ONLY</span><h3>计算审计</h3><small>最近 ${t.length} 条记录 · 最多显示 30 条</small></div>
        <button data-world-action="toggle-audit" aria-label="关闭计算审计">关闭</button>
      </header>
      <div class="audit-panel-body">${i}</div>
      <footer class="audit-panel-footer">只读历史记录 · 不参与公式、时间调度或随机数生成</footer>
    </aside>`}function h(e,t){return e.localization?.[t]||`[${t||"missing-localization-key"}]`}function c(e,t,i=""){return t?.nameKey?h(e,t.nameKey):i}function S(e,t){return t?.descriptionKey?h(e,t.descriptionKey):""}function b(e){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(e||0)}function q(e){return`
    <section class="world-section" data-world-region="recent-events">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${e.recentEvents.map(t=>`
        <article><time>第 ${t.day} 天 · ${r(t.date)}</time><p>${r(t.text)}</p></article>
      `).join("")}</div>
    </section>`}function X(e){const t=e.colonies.reduce((a,n)=>a+n.state.population,0),i=e.wars.filter(a=>a.state.status==="active").length,o=e.factions.find(a=>a.id===e.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${r(e.universe.id)}</span><h2>${r(c(e,e.universe))}</h2><p>${r(S(e,e.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${r(c(e,o,"未知势力"))}</b><small>种子：${e.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${e.systems.length}</b></article>
      <article><small>殖民地</small><b>${e.colonies.length}</b></article>
      <article><small>总人口</small><b>${b(t)}</b></article>
      <article><small>活跃战争</small><b>${i}</b></article>
      <article><small>可用资金</small><b>${b(e.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${e.systems.map(a=>{const n=e.factions.find(l=>l.id===a.factionId);return`
          <article class="system-card">
            <span class="system-coordinate">${a.position.x}, ${a.position.y}</span>
            <h4>${r(c(e,a))}</h4>
            <p>${r(S(e,a))}</p>
            <small>所属势力：${r(c(e,n,"中立"))}</small>
            <div class="system-links">${a.links.map(l=>r(c(e,e.systems.find(m=>m.id===l),l))).join(" · ")}</div>
            <div class="system-locations">${a.locations.map(l=>r(c(e,l,l.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${e.tradeRoutes.map(a=>{const n=e.systems.find(m=>m.id===a.fromSystemId),l=e.systems.find(m=>m.id===a.toSystemId);return`<span><b>${r(c(e,a,a.id))}</b><small>${r(c(e,n,a.fromSystemId))} → ${r(c(e,l,a.toSystemId))} · ${a.travelDays} 天 · 风险 ${Math.round(a.risk*100)}% · 容量 ${b(a.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    ${q(e)}`}function O(e){return`
    <section class="world-section" data-world-region="colony-production">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${e.colonies.map(t=>{const i=Object.entries(t.state.stockpiles).map(([a,n])=>{const l=e.commodities.find(m=>m.id===a);return`<span><small>${r(c(e,l,a))}</small><b>${b(n)} ${r(l?.unitKey?h(e,l.unitKey):"")}</b></span>`}).join(""),o=t.state.industries.map(a=>{const n=e.recipes.find(l=>l.id===a.recipeId);return`<li>${r(c(e,n,a.recipeId))} <small>等级 ${a.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${r(t.location.systemId)}</span><h4>${r(c(e,t))}</h4><p>${r(c(e,t.faction))} · ${r(c(e,t.location))}</p></div><b class="stability">${t.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${b(t.state.population)}</b></div>
              <div class="stock-grid">${i}</div>
              <div class="industry-list"><b>生产设施</b><ul>${o}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function M(e){return`
    <section class="world-section" data-world-region="market-quotes">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${e.markets.map(t=>{const i=e.colonies.find(o=>o.id===t.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${r(t.id)}</span><h4>${r(c(e,t))}</h4><p>${r(c(e,i,t.colonyId))}</p></div>
            <div class="quote-table">
              ${t.instruments.map(o=>`
                <div class="quote-row">
                  <div><b>${r(o.ticker||o.name)}</b><small>${r(o.name)} · ${o.kind==="equity"?"证券":r(o.unit)}</small></div>
                  <div class="quote-value"><b>${b(o.price)}</b><small class="${o.change>0?"positive":o.change<0?"negative":""}">${o.change>0?"+":""}${b(o.change)}%</small></div>
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
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(t.color)?t.color:"#8ca8c8"}"></i><div><b>${r(c(e,t))}</b><small>${r(h(e,t.governmentKey))} · ${r(S(e,t))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${e.fleets.map(t=>{const i=e.systems.flatMap(o=>o.locations).find(o=>o.id===t.locationId);return`
          <article class="fleet-row"><div><b>${r(c(e,t))}</b><small>${r(c(e,t.faction))} · ${r(c(e,i,t.locationId))}</small><p>${t.ships.map(o=>{const a=e.shipClasses.find(n=>n.id===o.shipClassId);return`${r(c(e,a,o.shipClassId))} × ${o.quantity}`}).join("　")}</p></div><span>${t.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${e.wars.map(t=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${r(c(e,t))}</h4><p>${r(S(e,t))}</p><div><b>${t.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${t.state.daysActive} 天</span><span>${t.participants.map(i=>r(c(e,e.factions.find(o=>o.id===i),i))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function Q(e,t){switch(t){case"recent-events":return q(e);case"colony-production":return O(e);case"market-quotes":return M(e);case"war-chronology":return F(e);default:return""}}function Z(e,t="overview",i="",o=!1){const a=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],n=t==="colonies"?O(e):t==="markets"?M(e):t==="military"?F(e):X(e),m=(x(e.world.clock.day,e.world.clock.dayFraction||0)*100).toFixed(1),K=e.world.clock.day%7+1;return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date">
          <small>GALACTIC DATE</small>
          <b data-world-date>${r(e.world.clock.date)}</b>
          <div class="world-day-summary"><span data-world-day>第 ${e.world.clock.day} 天 · 第 ${Math.floor(e.world.clock.day/7)+1} 周 · 本周第 ${K} 天</span><strong data-world-percent>${m}%</strong></div>
          <div class="campaign-week-track" data-world-progress-track role="progressbar" aria-label="当前游戏周进度，划分为七个日刻度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m}">
            <span class="campaign-week-fill" data-world-progress style="width:${m}%"></span>
            <span class="campaign-week-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </div>
        </div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${a.map(([T,z])=>`<button data-world-tab="${T}" class="${t===T?"active":""}">${z}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="toggle-audit" class="${o?"selected":""}" aria-expanded="${o}">计算审计</button>
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
      ${i?`<div class="world-notice">${r(i)}</div>`:""}
      <div class="world-content">${n}</div>
      <footer class="world-footer"><span data-save-status>存档：${r(e.saveId||"未命名")} · ${e.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${e.world.schemaVersion} · 内容指纹 ${e.world.contentHash.slice(0,10)}</span></footer>
      ${o?R(e):""}
    </main>`}const ee=Object.freeze([{id:"recent-events",tab:"overview",cadence:"daily"},{id:"colony-production",tab:"colonies",cadence:"weekly"},{id:"market-quotes",tab:"markets",cadence:"daily"},{id:"war-chronology",tab:"military",cadence:"daily"}]);function te({activeTab:e,previousDay:t,currentDay:i}){if(!Number.isInteger(t)||t<0||!Number.isInteger(i)||i<=t)return[];const o=Math.floor(i/7)>Math.floor(t/7);return ee.filter(a=>a.tab===e&&(a.cadence==="daily"||o)).map(a=>a.id)}const p=document.querySelector("#app"),s={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:"",auditOpen:!1};function u(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function y(){return!!window.gameHost}function L(e){p.innerHTML=`
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
    </main>`}function k(){s.page="home",L(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${y()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function v(e,t,i){L(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${u(e)}</span><h2>${u(e)}</h2><p>${u(t)}</p></div>
    <div class="subpage-body">${i}</div>
  `)}let w=null,d=null,f=null,N=!1,g=0;function ae(){d={date:p.querySelector("[data-world-date]"),day:p.querySelector("[data-world-day]"),percent:p.querySelector("[data-world-percent]"),progress:p.querySelector("[data-world-progress]"),progressTrack:p.querySelector("[data-world-progress-track]"),status:p.querySelector("[data-time-label]"),speedButtons:[...p.querySelectorAll("[data-world-action='set-speed']")],footer:p.querySelector("[data-save-status]")}}function j(){if(!w||!d)return;const{clock:e,timeControl:t}=w,i=Math.floor(e.day/7)+1,o=e.day%7+1;if(d.date&&d.date.textContent!==e.date&&(d.date.textContent=e.date),d.day){const a=`第 ${e.day} 天 · 第 ${i} 周 · 本周第 ${o} 天`;d.day.textContent!==a&&(d.day.textContent=a)}if(d.status){const a=t.paused?"时间已暂停":`世界时间 · ${t.speed}x`;d.status.textContent!==a&&(d.status.textContent=a)}for(const a of d.speedButtons){const n=Number(a.dataset.speed)===t.speed;a.classList.contains("selected")!==n&&(a.classList.toggle("selected",n),a.setAttribute("aria-pressed",String(n)))}if(d.footer){const a=`存档：${w.saveId||"未命名"} · ${w.dirty?"有未保存更改":"已保存"}`;d.footer.textContent!==a&&(d.footer.textContent=a)}}function E(){if(!w||!d)return;const{clock:e,timeControl:t}=w,i=t.speed>0?Math.max(0,performance.now()-w.syncedAt):0,a=(U({day:e.day,dayFraction:e.dayFraction||0,speed:t.speed,baseDayDurationMs:t.baseDayDurationMs,elapsedMs:i})*100).toFixed(1);if(d.percent&&d.percent.textContent!==`${a}%`&&(d.percent.textContent=`${a}%`),d.progress){const n=`${a}%`;d.progress.style.width!==n&&(d.progress.style.width=n)}if(d.progressTrack){const n=String(Number(a));d.progressTrack.getAttribute("aria-valuenow")!==n&&d.progressTrack.setAttribute("aria-valuenow",n)}}function H(){f!==null&&(cancelAnimationFrame(f),f=null)}function W(){f=null,!(s.page!=="world"||!s.world||!w)&&(E(),w.timeControl.speed>0&&(f=requestAnimationFrame(W)))}function P(){w?.timeControl.speed>0&&f===null&&(f=requestAnimationFrame(W))}function A(e){!s.world||!e?.clock||!e?.timeControl||(w={clock:{...e.clock},timeControl:{...e.timeControl},saveId:e.saveId??s.world.saveId,dirty:e.dirty??s.world.dirty,syncedAt:performance.now()},s.world.world.clock={...e.clock},s.world.timeControl={...e.timeControl},e.saveId!==void 0&&(s.world.saveId=e.saveId),e.dirty!==void 0&&(s.world.dirty=e.dirty),j(),E(),w.timeControl.speed>0?P():H())}function I(e){A({clock:e.world.clock,timeControl:e.timeControl,saveId:e.saveId,dirty:e.dirty})}function C(){if(!s.world)return k();s.page="world",p.innerHTML=Z(s.world,s.worldTab,s.worldNotice,s.auditOpen),ae(),j(),E(),P()}function se(e,t){const i=te({activeTab:s.worldTab,previousDay:t,currentDay:e.world.clock.day});if(i.length>0){const o=p.querySelector(".world-content"),a=o?.scrollTop??0;for(const n of i){const l=p.querySelector(`[data-world-region="${n}"]`);if(!l)continue;const m=Q(e,n);m&&(l.outerHTML=m)}o&&(o.scrollTop=a)}s.auditOpen&&_()}function _(){const e=p.querySelector("[data-audit-panel]"),t=p.querySelector("[data-world-action='toggle-audit']");if(t&&(t.classList.toggle("selected",s.auditOpen),t.setAttribute("aria-expanded",String(s.auditOpen))),!s.auditOpen){e?.remove();return}if(!s.world)return;const i=R(s.world);if(e){const a=e.querySelector(".audit-panel-body")?.scrollTop??0;e.outerHTML=i;const n=p.querySelector("[data-audit-panel] .audit-panel-body");n&&(n.scrollTop=a)}else p.querySelector(".world-screen")?.insertAdjacentHTML("beforeend",i)}async function ie(){if(!y()||s.page!=="world"||!s.world||s.busy||N)return;N=!0;const e=g,t=s.world,i=t.world.clock.day;try{const o=await window.gameHost.world.getClockStatus();if(e!==g||s.page!=="world"||s.world!==t||s.busy)return;if(o.clock.day!==i){const a=await window.gameHost.world.getStatus();if(e!==g||s.page!=="world"||s.world!==t||s.busy)return;s.world=a,I(a),se(a,i)}else A(o)}catch(o){console.error("World clock synchronization failed",o)}finally{N=!1}}setInterval(()=>{ie()},250);async function oe(){if(g+=1,!y())return v("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{s.world=await window.gameHost.world.startNew(),s.auditOpen=!1,I(s.world),s.worldTab="overview",s.worldNotice="新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。",C()}catch(e){v("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${u(e.message)}</p>`)}}async function ne(e){g+=1;try{s.world=await window.gameHost.world.loadSave(e),s.auditOpen=!1,I(s.world),s.worldTab="overview",s.worldNotice="存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。",C()}catch(t){v("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${u(t.message)}</p>`)}}async function D(){if(s.page="saves",!y())return v("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.slots=await window.gameHost.save.listSlots();const e=s.slots.map(t=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${u(t.id)}</span><h3>${u(t.metadata?.name||"无法读取的存档")}</h3><p>${t.status==="ok"?t.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":t.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+u(t.error)}</p><small>${u(t.metadata?.updated_at||t.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${t.status}">${t.status==="ok"?"正常":t.status==="incompatible"?"不兼容":"损坏"}</span>${t.status==="ok"&&t.hasWorld?`<button class="small-button" data-action="load-save" data-id="${u(t.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${u(t.id)}">删除</button></div>
      </article>`).join("");v("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",e||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(e){v("读取存档","读取存档列表时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function re(){if(s.page="settings",!y())return v("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.settings=await window.gameHost.settings.read();const e=s.settings.general,t=s.settings.graphics,i=s.settings.audio,o=s.settings.simulation;v("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(a=>`<option value="${a}" ${t.ui_scale===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(a=>`<option value="${a}" ${o.base_day_seconds===a?"selected":""}>${a} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(a=>`<option value="${a}" ${i.master_volume===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){v("设置","无法读取配置文件。",`<p class="error-state">${u(e.message)}</p>`)}}async function V(){if(s.page="mods",!y())return v("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.mods=await window.gameHost.mods.list();const e=s.mods.map(t=>{const i=t.id==="core"||t.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${u(t.id)} · API ${u(t.apiVersion??"—")}</span><h3>${u(t.name)}</h3><p>${u(t.description||t.error||"无描述")}</p><small>作者：${u(t.author)}　版本：${u(t.version)}</small>${t.error?`<p class="error-state">${u(t.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${i?"ok":"off"}">${i?"已启用":"已禁用"}</span>${t.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${u(t.id)}" data-enabled="${i}">${i?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");v("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){v("模组管理","扫描模组时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function le(e){if(s.page=e,e==="home")return k();if(e==="saves")return D();if(e==="settings")return re();if(e==="mods")return V();if(e==="new")return oe()}p.addEventListener("click",async e=>{const t=e.target.closest("[data-world-tab]");if(t&&s.world)return s.worldTab=t.dataset.worldTab,s.worldNotice="",C();const i=e.target.closest("[data-world-action]");if(i&&s.world&&i.dataset.worldAction==="toggle-audit"&&!s.busy){s.auditOpen=!s.auditOpen,_();return}if(i&&s.world&&!s.busy){g+=1,s.busy=!0;try{const n=i.dataset.worldAction;if(n==="set-speed"){const l=Number(i.dataset.speed);s.world=await window.gameHost.world.setSpeed(l),I(s.world),s.worldNotice=l===0?"世界时间已暂停。":`世界时间已切换为 ${l}x。`}else if(n==="advance")s.world=await window.gameHost.world.advanceDay(),I(s.world),s.worldNotice="兼容性调试操作：世界时间已推进一天。";else if(n==="save"){const l=await window.gameHost.world.save();s.world.dirty=!1;const m=await window.gameHost.world.getClockStatus();A(m),s.worldNotice=`世界已保存：${l.saveId}`}else if(n==="leave")return s.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),g+=1,H(),w=null,d=null,s.world=null,s.auditOpen=!1,s.worldNotice="",k());C()}catch(n){s.worldNotice=`操作失败：${n.message}`,C()}finally{s.busy=!1}return}const o=e.target.closest("[data-action]");if(!o||s.busy)return;const a=o.dataset.action;try{if(a==="home")return k();if(a==="new"||a==="saves"||a==="settings"||a==="mods")return le(a);if(a==="quit"&&(y()?await window.gameHost.app.quit():v("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),a==="save-settings"){const n=document.querySelector("#settings-result"),l={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)},simulation:{base_day_seconds:Number(document.querySelector("#base-day-seconds").value)}};await window.gameHost.settings.write(l),n.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(a==="delete-save"){const n=o.dataset.id;if(!window.confirm(`确定永久删除存档 ${n} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(n),await D()}if(a==="load-save")return ne(o.dataset.id);if(a==="toggle-mod"){const n=o.dataset.id,l=o.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[n]:!l}}}),await V();const m=document.createElement("p");m.className="notice",m.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(m)}}catch(n){const l=document.querySelector("#settings-result")||document.querySelector(".subpage-body");l&&(l.textContent="操作失败："+n.message)}});k();
