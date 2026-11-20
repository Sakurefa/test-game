(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&i(l)}).observe(document,{childList:!0,subtree:!0});function o(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=o(a);fetch(a.href,n)}})();function Y({dayFraction:e,speed:t,baseDayDurationMs:o,elapsedMs:i}){if(!Number.isFinite(e)||e<0||e>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");if(!Number.isFinite(t)||t<0||t>4)throw new RangeError("Campaign display speed must be between 0x and 4x");if(!Number.isFinite(o)||o<=0)throw new RangeError("Base game-day duration must be positive");if(!Number.isFinite(i)||i<0)throw new RangeError("Elapsed display time must be non-negative");const a=e+(t===0?0:i*t/o);return Math.max(0,Math.min(.999,a))}function x(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError("Campaign day must be a non-negative integer");if(!Number.isFinite(t)||t<0||t>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");return Math.max(0,Math.min(.999,(e%7+t)/7))}function J({day:e,dayFraction:t,speed:o,baseDayDurationMs:i,elapsedMs:a}){const n=Y({dayFraction:t,speed:o,baseDayDurationMs:i,elapsedMs:a});return x(e,n)}function X(e,t=30){if(!Number.isInteger(t)||t<1)throw new RangeError("Calculation record limit must be a positive integer");const o=e?.audit?.calculations;return Array.isArray(o)?o.slice(-t).reverse():[]}function Q(e,t=30){if(!Number.isInteger(t)||t<1)throw new RangeError("Domain event limit must be a positive integer");return(Array.isArray(e?.domainEvents)?e.domainEvents:[]).slice(-t).reverse()}function r(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}const Z=Object.freeze({"economy.commodity-price":"商品市场定价","economy.security-price":"证券价格计算","economy.colony-production":"殖民地生产结算"});function b(e){return r(JSON.stringify(e??null,null,2))}function ee(e){const t=Z[e.formulaId]||e.formulaId,o=Array.isArray(e.randomDraws)?e.randomDraws:[];return`
    <details class="audit-record">
      <summary>
        <span><b>第 ${e.day??"—"} 天 · ${r(t)}</b><small>${r(e.formulaId)} · v${e.version}</small></span>
        <em>${o.length} 次随机抽取</em>
      </summary>
      <div class="audit-record-body">
        <section><h5>输入参数</h5><pre>${b(e.inputs)}</pre></section>
        <section><h5>中间步骤</h5><pre>${b(e.steps)}</pre></section>
        <section><h5>修正项</h5><pre>${b(e.modifiers)}</pre></section>
        <section><h5>实际随机抽取</h5><pre>${b(o)}</pre></section>
        <section><h5>最终结果</h5><pre>${b(e.result)}</pre></section>
      </div>
    </details>`}function M(e){const t=X(e.world,30),o=t.length?t.map(ee).join(""):'<div class="audit-empty">尚无计算记录。市场完成下一次每日结算后，相关公式记录会出现在这里。</div>';return`
    <aside class="calculation-audit-panel" data-audit-panel aria-label="计算审计只读面板">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">CALCULATION TRACE / READ ONLY</span><h3>计算审计</h3><small>最近 ${t.length} 条记录 · 最多显示 30 条</small></div>
        <button data-world-action="toggle-audit" aria-label="关闭计算审计">关闭</button>
      </header>
      <div class="audit-panel-body">${o}</div>
      <footer class="audit-panel-footer">只读历史记录 · 不参与公式、时间调度或随机数生成</footer>
    </aside>`}function te(e){const t=e.scope||"world";return`
    <details class="audit-record domain-event-record">
      <summary>
        <span><b>#${e.sequence} · 第 ${e.day} 天 · ${r(e.type)}</b><small>${r(e.date)} · ${r(t)} · ${r(e.subjectId||"无主体")}</small></span>
        <em>${Object.keys(e.payload||{}).length} 个字段</em>
      </summary>
      <div class="audit-record-body">
        <section><h5>事件元数据</h5><pre>${b({id:e.id,sequence:e.sequence,day:e.day,date:e.date,type:e.type,scope:t,subjectId:e.subjectId})}</pre></section>
        <section><h5>事件载荷</h5><pre>${b(e.payload)}</pre></section>
      </div>
    </details>`}function j(e){const t=Q(e.world,30),o=t.length?t.map(te).join(""):'<div class="audit-empty">目前还没有领域事件。推进世界时间后，生产、市场和战争系统会在结算时写入记录。</div>';return`
    <aside class="calculation-audit-panel domain-event-panel" data-domain-event-panel aria-label="领域事件只读面板">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">DOMAIN EVENT STREAM / READ ONLY</span><h3>世界事件</h3><small>最近 ${t.length} 条 · 最多显示 30 条 · 世界保留上限 300 条</small></div>
        <button data-world-action="toggle-domain-events" aria-label="关闭世界事件">关闭</button>
      </header>
      <div class="audit-panel-body">${o}</div>
      <footer class="audit-panel-footer">只读事件历史 · 不执行命令、不修改模拟状态</footer>
    </aside>`}function I(e,t){return e.localization?.[t]||`[${t||"missing-localization-key"}]`}function c(e,t,o=""){return t?.nameKey?I(e,t.nameKey):o}function S(e,t){return t?.descriptionKey?I(e,t.descriptionKey):""}function f(e){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(e||0)}function L(e){return`
    <section class="world-section" data-world-region="recent-events">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${e.recentEvents.map(t=>`
        <article><time>第 ${t.day} 天 · ${r(t.date)}</time><p>${r(t.text)}</p></article>
      `).join("")}</div>
    </section>`}function ae(e){const t=e.colonies.reduce((a,n)=>a+n.state.population,0),o=e.wars.filter(a=>a.state.status==="active").length,i=e.factions.find(a=>a.id===e.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${r(e.universe.id)}</span><h2>${r(c(e,e.universe))}</h2><p>${r(S(e,e.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${r(c(e,i,"未知势力"))}</b><small>种子：${e.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${e.systems.length}</b></article>
      <article><small>殖民地</small><b>${e.colonies.length}</b></article>
      <article><small>总人口</small><b>${f(t)}</b></article>
      <article><small>活跃战争</small><b>${o}</b></article>
      <article><small>可用资金</small><b>${f(e.world.player.account.cash)} CR</b></article>
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
            <div class="system-links">${a.links.map(l=>r(c(e,e.systems.find(p=>p.id===l),l))).join(" · ")}</div>
            <div class="system-locations">${a.locations.map(l=>r(c(e,l,l.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${e.tradeRoutes.map(a=>{const n=e.systems.find(p=>p.id===a.fromSystemId),l=e.systems.find(p=>p.id===a.toSystemId);return`<span><b>${r(c(e,a,a.id))}</b><small>${r(c(e,n,a.fromSystemId))} → ${r(c(e,l,a.toSystemId))} · ${a.travelDays} 天 · 风险 ${Math.round(a.risk*100)}% · 容量 ${f(a.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    ${L(e)}`}function F(e){return`
    <section class="world-section" data-world-region="colony-production">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${e.colonies.map(t=>{const o=Object.entries(t.state.stockpiles).map(([a,n])=>{const l=e.commodities.find(p=>p.id===a);return`<span><small>${r(c(e,l,a))}</small><b>${f(n)} ${r(l?.unitKey?I(e,l.unitKey):"")}</b></span>`}).join(""),i=t.state.industries.map(a=>{const n=e.recipes.find(l=>l.id===a.recipeId);return`<li>${r(c(e,n,a.recipeId))} <small>等级 ${a.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${r(t.location.systemId)}</span><h4>${r(c(e,t))}</h4><p>${r(c(e,t.faction))} · ${r(c(e,t.location))}</p></div><b class="stability">${t.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${f(t.state.population)}</b></div>
              <div class="stock-grid">${o}</div>
              <div class="industry-list"><b>生产设施</b><ul>${i}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function H(e){return`
    <section class="world-section" data-world-region="market-quotes">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${e.markets.map(t=>{const o=e.colonies.find(i=>i.id===t.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${r(t.id)}</span><h4>${r(c(e,t))}</h4><p>${r(c(e,o,t.colonyId))}</p></div>
            <div class="quote-table">
              ${t.instruments.map(i=>`
                <div class="quote-row">
                  <div><b>${r(i.ticker||i.name)}</b><small>${r(i.name)} · ${i.kind==="equity"?"证券":r(i.unit)}</small></div>
                  <div class="quote-value"><b>${f(i.price)}</b><small class="${i.change>0?"positive":i.change<0?"negative":""}">${i.change>0?"+":""}${f(i.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`}).join("")}
      </div>
    </section>`}function P(e){return`
    <section class="world-section" data-world-region="war-chronology">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${e.factions.map(t=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(t.color)?t.color:"#8ca8c8"}"></i><div><b>${r(c(e,t))}</b><small>${r(I(e,t.governmentKey))} · ${r(S(e,t))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${e.fleets.map(t=>{const o=e.systems.flatMap(i=>i.locations).find(i=>i.id===t.locationId);return`
          <article class="fleet-row"><div><b>${r(c(e,t))}</b><small>${r(c(e,t.faction))} · ${r(c(e,o,t.locationId))}</small><p>${t.ships.map(i=>{const a=e.shipClasses.find(n=>n.id===i.shipClassId);return`${r(c(e,a,i.shipClassId))} × ${i.quantity}`}).join("　")}</p></div><span>${t.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${e.wars.map(t=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${r(c(e,t))}</h4><p>${r(S(e,t))}</p><div><b>${t.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${t.state.daysActive} 天</span><span>${t.participants.map(o=>r(c(e,e.factions.find(i=>i.id===o),o))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function se(e,t){switch(t){case"recent-events":return L(e);case"colony-production":return F(e);case"market-quotes":return H(e);case"war-chronology":return P(e);default:return""}}function oe(e,t="overview",o="",i=!1,a=!1){const n=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],l=t==="colonies"?F(e):t==="markets"?H(e):t==="military"?P(e):ae(e),h=(x(e.world.clock.day,e.world.clock.dayFraction||0)*100).toFixed(1),U=e.world.clock.day%7+1;return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date">
          <small>GALACTIC DATE</small>
          <b data-world-date>${r(e.world.clock.date)}</b>
          <div class="world-day-summary"><span data-world-day>第 ${e.world.clock.day} 天 · 第 ${Math.floor(e.world.clock.day/7)+1} 周 · 本周第 ${U} 天</span><strong data-world-percent>${h}%</strong></div>
          <div class="campaign-week-track" data-world-progress-track role="progressbar" aria-label="当前游戏周进度，划分为七个日刻度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${h}">
            <span class="campaign-week-fill" data-world-progress style="width:${h}%"></span>
            <span class="campaign-week-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </div>
        </div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${n.map(([R,G])=>`<button data-world-tab="${R}" class="${t===R?"active":""}">${G}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="toggle-audit" class="${i?"selected":""}" aria-expanded="${i}">计算审计</button>
          <button data-world-action="toggle-domain-events" class="${a?"selected":""}" aria-expanded="${a}">世界事件</button>
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
      ${o?`<div class="world-notice">${r(o)}</div>`:""}
      <div class="world-content">${l}</div>
      <footer class="world-footer"><span data-save-status>存档：${r(e.saveId||"未命名")} · ${e.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${e.world.schemaVersion} · 内容指纹 ${e.world.contentHash.slice(0,10)}</span></footer>
      ${i?M(e):""}
      ${a?j(e):""}
    </main>`}const ie=Object.freeze([{id:"recent-events",tab:"overview",cadence:"daily"},{id:"colony-production",tab:"colonies",cadence:"weekly"},{id:"market-quotes",tab:"markets",cadence:"daily"},{id:"war-chronology",tab:"military",cadence:"daily"}]);function ne({activeTab:e,previousDay:t,currentDay:o}){if(!Number.isInteger(t)||t<0||!Number.isInteger(o)||o<=t)return[];const i=Math.floor(o/7)>Math.floor(t/7);return ie.filter(a=>a.tab===e&&(a.cadence==="daily"||i)).map(a=>a.id)}const m=document.querySelector("#app"),s={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:"",auditOpen:!1,domainEventsOpen:!1};function u(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function $(){return!!window.gameHost}function W(e){m.innerHTML=`
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
    </main>`}function k(){s.page="home",W(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${$()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function v(e,t,o){W(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${u(e)}</span><h2>${u(e)}</h2><p>${u(t)}</p></div>
    <div class="subpage-body">${o}</div>
  `)}let w=null,d=null,y=null,N=!1,g=0;function re(){d={date:m.querySelector("[data-world-date]"),day:m.querySelector("[data-world-day]"),percent:m.querySelector("[data-world-percent]"),progress:m.querySelector("[data-world-progress]"),progressTrack:m.querySelector("[data-world-progress-track]"),status:m.querySelector("[data-time-label]"),speedButtons:[...m.querySelectorAll("[data-world-action='set-speed']")],footer:m.querySelector("[data-save-status]")}}function D(){if(!w||!d)return;const{clock:e,timeControl:t}=w,o=Math.floor(e.day/7)+1,i=e.day%7+1;if(d.date&&d.date.textContent!==e.date&&(d.date.textContent=e.date),d.day){const a=`第 ${e.day} 天 · 第 ${o} 周 · 本周第 ${i} 天`;d.day.textContent!==a&&(d.day.textContent=a)}if(d.status){const a=t.paused?"时间已暂停":`世界时间 · ${t.speed}x`;d.status.textContent!==a&&(d.status.textContent=a)}for(const a of d.speedButtons){const n=Number(a.dataset.speed)===t.speed;a.classList.contains("selected")!==n&&(a.classList.toggle("selected",n),a.setAttribute("aria-pressed",String(n)))}if(d.footer){const a=`存档：${w.saveId||"未命名"} · ${w.dirty?"有未保存更改":"已保存"}`;d.footer.textContent!==a&&(d.footer.textContent=a)}}function O(){if(!w||!d)return;const{clock:e,timeControl:t}=w,o=t.speed>0?Math.max(0,performance.now()-w.syncedAt):0,a=(J({day:e.day,dayFraction:e.dayFraction||0,speed:t.speed,baseDayDurationMs:t.baseDayDurationMs,elapsedMs:o})*100).toFixed(1);if(d.percent&&d.percent.textContent!==`${a}%`&&(d.percent.textContent=`${a}%`),d.progress){const n=`${a}%`;d.progress.style.width!==n&&(d.progress.style.width=n)}if(d.progressTrack){const n=String(Number(a));d.progressTrack.getAttribute("aria-valuenow")!==n&&d.progressTrack.setAttribute("aria-valuenow",n)}}function _(){y!==null&&(cancelAnimationFrame(y),y=null)}function V(){y=null,!(s.page!=="world"||!s.world||!w)&&(O(),w.timeControl.speed>0&&(y=requestAnimationFrame(V)))}function K(){w?.timeControl.speed>0&&y===null&&(y=requestAnimationFrame(V))}function q(e){!s.world||!e?.clock||!e?.timeControl||(w={clock:{...e.clock},timeControl:{...e.timeControl},saveId:e.saveId??s.world.saveId,dirty:e.dirty??s.world.dirty,syncedAt:performance.now()},s.world.world.clock={...e.clock},s.world.timeControl={...e.timeControl},e.saveId!==void 0&&(s.world.saveId=e.saveId),e.dirty!==void 0&&(s.world.dirty=e.dirty),D(),O(),w.timeControl.speed>0?K():_())}function E(e){q({clock:e.world.clock,timeControl:e.timeControl,saveId:e.saveId,dirty:e.dirty})}function C(){if(!s.world)return k();s.page="world",m.innerHTML=oe(s.world,s.worldTab,s.worldNotice,s.auditOpen,s.domainEventsOpen),re(),D(),O(),K()}function le(e,t){const o=ne({activeTab:s.worldTab,previousDay:t,currentDay:e.world.clock.day});if(o.length>0){const i=m.querySelector(".world-content"),a=i?.scrollTop??0;for(const n of o){const l=m.querySelector(`[data-world-region="${n}"]`);if(!l)continue;const p=se(e,n);p&&(l.outerHTML=p)}i&&(i.scrollTop=a)}s.auditOpen&&A(),s.domainEventsOpen&&T()}function A(){const e=m.querySelector("[data-audit-panel]"),t=m.querySelector("[data-world-action='toggle-audit']");if(t&&(t.classList.toggle("selected",s.auditOpen),t.setAttribute("aria-expanded",String(s.auditOpen))),!s.auditOpen){e?.remove();return}if(!s.world)return;const o=M(s.world);if(e){const a=e.querySelector(".audit-panel-body")?.scrollTop??0;e.outerHTML=o;const n=m.querySelector("[data-audit-panel] .audit-panel-body");n&&(n.scrollTop=a)}else m.querySelector(".world-screen")?.insertAdjacentHTML("beforeend",o)}function T(){const e=m.querySelector("[data-domain-event-panel]"),t=m.querySelector("[data-world-action='toggle-domain-events']");if(t&&(t.classList.toggle("selected",s.domainEventsOpen),t.setAttribute("aria-expanded",String(s.domainEventsOpen))),!s.domainEventsOpen){e?.remove();return}if(!s.world)return;const o=j(s.world);if(e){const a=e.querySelector(".audit-panel-body")?.scrollTop??0;e.outerHTML=o;const n=m.querySelector("[data-domain-event-panel] .audit-panel-body");n&&(n.scrollTop=a)}else m.querySelector(".world-screen")?.insertAdjacentHTML("beforeend",o)}async function de(){if(!$()||s.page!=="world"||!s.world||s.busy||N)return;N=!0;const e=g,t=s.world,o=t.world.clock.day;try{const i=await window.gameHost.world.getClockStatus();if(e!==g||s.page!=="world"||s.world!==t||s.busy)return;if(i.clock.day!==o){const a=await window.gameHost.world.getStatus();if(e!==g||s.page!=="world"||s.world!==t||s.busy)return;s.world=a,E(a),le(a,o)}else q(i)}catch(i){console.error("World clock synchronization failed",i)}finally{N=!1}}setInterval(()=>{de()},250);async function ce(){if(g+=1,!$())return v("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{s.world=await window.gameHost.world.startNew(),s.auditOpen=!1,s.domainEventsOpen=!1,E(s.world),s.worldTab="overview",s.worldNotice="新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。",C()}catch(e){v("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${u(e.message)}</p>`)}}async function ue(e){g+=1;try{s.world=await window.gameHost.world.loadSave(e),s.auditOpen=!1,s.domainEventsOpen=!1,E(s.world),s.worldTab="overview",s.worldNotice="存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。",C()}catch(t){v("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${u(t.message)}</p>`)}}async function B(){if(s.page="saves",!$())return v("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.slots=await window.gameHost.save.listSlots();const e=s.slots.map(t=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${u(t.id)}</span><h3>${u(t.metadata?.name||"无法读取的存档")}</h3><p>${t.status==="ok"?t.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":t.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+u(t.error)}</p><small>${u(t.metadata?.updated_at||t.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${t.status}">${t.status==="ok"?"正常":t.status==="incompatible"?"不兼容":"损坏"}</span>${t.status==="ok"&&t.hasWorld?`<button class="small-button" data-action="load-save" data-id="${u(t.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${u(t.id)}">删除</button></div>
      </article>`).join("");v("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",e||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(e){v("读取存档","读取存档列表时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function me(){if(s.page="settings",!$())return v("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.settings=await window.gameHost.settings.read();const e=s.settings.general,t=s.settings.graphics,o=s.settings.audio,i=s.settings.simulation;v("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(a=>`<option value="${a}" ${t.ui_scale===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(a=>`<option value="${a}" ${i.base_day_seconds===a?"selected":""}>${a} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(a=>`<option value="${a}" ${o.master_volume===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){v("设置","无法读取配置文件。",`<p class="error-state">${u(e.message)}</p>`)}}async function z(){if(s.page="mods",!$())return v("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.mods=await window.gameHost.mods.list();const e=s.mods.map(t=>{const o=t.id==="core"||t.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${u(t.id)} · API ${u(t.apiVersion??"—")}</span><h3>${u(t.name)}</h3><p>${u(t.description||t.error||"无描述")}</p><small>作者：${u(t.author)}　版本：${u(t.version)}</small>${t.error?`<p class="error-state">${u(t.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${o?"ok":"off"}">${o?"已启用":"已禁用"}</span>${t.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${u(t.id)}" data-enabled="${o}">${o?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");v("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){v("模组管理","扫描模组时发生错误。",`<p class="error-state">${u(e.message)}</p>`)}}async function pe(e){if(s.page=e,e==="home")return k();if(e==="saves")return B();if(e==="settings")return me();if(e==="mods")return z();if(e==="new")return ce()}m.addEventListener("click",async e=>{const t=e.target.closest("[data-world-tab]");if(t&&s.world)return s.worldTab=t.dataset.worldTab,s.worldNotice="",C();const o=e.target.closest("[data-world-action]");if(o&&s.world&&o.dataset.worldAction==="toggle-audit"&&!s.busy){s.auditOpen=!s.auditOpen,s.auditOpen&&(s.domainEventsOpen=!1),A(),T();return}if(o&&s.world&&o.dataset.worldAction==="toggle-domain-events"&&!s.busy){s.domainEventsOpen=!s.domainEventsOpen,s.domainEventsOpen&&(s.auditOpen=!1),T(),A();return}if(o&&s.world&&!s.busy){g+=1,s.busy=!0;try{const n=o.dataset.worldAction;if(n==="set-speed"){const l=Number(o.dataset.speed);s.world=await window.gameHost.world.setSpeed(l),E(s.world),s.worldNotice=l===0?"世界时间已暂停。":`世界时间已切换为 ${l}x。`}else if(n==="advance")s.world=await window.gameHost.world.advanceDay(),E(s.world),s.worldNotice="兼容性调试操作：世界时间已推进一天。";else if(n==="save"){const l=await window.gameHost.world.save();s.world.dirty=!1;const p=await window.gameHost.world.getClockStatus();q(p),s.worldNotice=`世界已保存：${l.saveId}`}else if(n==="leave")return s.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),g+=1,_(),w=null,d=null,s.world=null,s.auditOpen=!1,s.domainEventsOpen=!1,s.worldNotice="",k());C()}catch(n){s.worldNotice=`操作失败：${n.message}`,C()}finally{s.busy=!1}return}const i=e.target.closest("[data-action]");if(!i||s.busy)return;const a=i.dataset.action;try{if(a==="home")return k();if(a==="new"||a==="saves"||a==="settings"||a==="mods")return pe(a);if(a==="quit"&&($()?await window.gameHost.app.quit():v("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),a==="save-settings"){const n=document.querySelector("#settings-result"),l={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)},simulation:{base_day_seconds:Number(document.querySelector("#base-day-seconds").value)}};await window.gameHost.settings.write(l),n.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(a==="delete-save"){const n=i.dataset.id;if(!window.confirm(`确定永久删除存档 ${n} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(n),await B()}if(a==="load-save")return ue(i.dataset.id);if(a==="toggle-mod"){const n=i.dataset.id,l=i.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[n]:!l}}}),await z();const p=document.createElement("p");p.className="notice",p.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(p)}}catch(n){const l=document.querySelector("#settings-result")||document.querySelector(".subpage-body");l&&(l.textContent="操作失败："+n.message)}});k();
