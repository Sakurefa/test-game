(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))t(e);new MutationObserver(e=>{for(const i of e)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&t(o)}).observe(document,{childList:!0,subtree:!0});function r(e){const i={};return e.integrity&&(i.integrity=e.integrity),e.referrerPolicy&&(i.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?i.credentials="include":e.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function t(e){if(e.ep)return;e.ep=!0;const i=r(e);fetch(e.href,i)}})();function n(a){return String(a??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}function f(a,s){return a.localization?.[s]||`[${s||"missing-localization-key"}]`}function c(a,s,r=""){return s?.nameKey?f(a,s.nameKey):r}function $(a,s){return s?.descriptionKey?f(a,s.descriptionKey):""}function p(a){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(a||0)}function E(a){const s=a.colonies.reduce((e,i)=>e+i.state.population,0),r=a.wars.filter(e=>e.state.status==="active").length,t=a.factions.find(e=>e.id===a.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${n(a.universe.id)}</span><h2>${n(c(a,a.universe))}</h2><p>${n($(a,a.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${n(c(a,t,"未知势力"))}</b><small>种子：${a.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${a.systems.length}</b></article>
      <article><small>殖民地</small><b>${a.colonies.length}</b></article>
      <article><small>总人口</small><b>${p(s)}</b></article>
      <article><small>活跃战争</small><b>${r}</b></article>
      <article><small>可用资金</small><b>${p(a.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${a.systems.map(e=>{const i=a.factions.find(o=>o.id===e.factionId);return`
          <article class="system-card">
            <span class="system-coordinate">${e.position.x}, ${e.position.y}</span>
            <h4>${n(c(a,e))}</h4>
            <p>${n($(a,e))}</p>
            <small>所属势力：${n(c(a,i,"中立"))}</small>
            <div class="system-links">${e.links.map(o=>n(c(a,a.systems.find(u=>u.id===o),o))).join(" · ")}</div>
            <div class="system-locations">${e.locations.map(o=>n(c(a,o,o.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${a.tradeRoutes.map(e=>{const i=a.systems.find(u=>u.id===e.fromSystemId),o=a.systems.find(u=>u.id===e.toSystemId);return`<span><b>${n(c(a,e,e.id))}</b><small>${n(c(a,i,e.fromSystemId))} → ${n(c(a,o,e.toSystemId))} · ${e.travelDays} 天 · 风险 ${Math.round(e.risk*100)}% · 容量 ${p(e.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${a.recentEvents.map(e=>`
        <article><time>第 ${e.day} 天 · ${n(e.date)}</time><p>${n(e.text)}</p></article>
      `).join("")}</div>
    </section>`}function S(a){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${a.colonies.map(s=>{const r=Object.entries(s.state.stockpiles).map(([e,i])=>{const o=a.commodities.find(u=>u.id===e);return`<span><small>${n(c(a,o,e))}</small><b>${p(i)} ${n(o?.unitKey?f(a,o.unitKey):"")}</b></span>`}).join(""),t=s.state.industries.map(e=>{const i=a.recipes.find(o=>o.id===e.recipeId);return`<li>${n(c(a,i,e.recipeId))} <small>等级 ${e.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${n(s.location.systemId)}</span><h4>${n(c(a,s))}</h4><p>${n(c(a,s.faction))} · ${n(c(a,s.location))}</p></div><b class="stability">${s.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${p(s.state.population)}</b></div>
              <div class="stock-grid">${r}</div>
              <div class="industry-list"><b>生产设施</b><ul>${t}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function T(a){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${a.markets.map(s=>{const r=a.colonies.find(t=>t.id===s.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${n(s.id)}</span><h4>${n(c(a,s))}</h4><p>${n(c(a,r,s.colonyId))}</p></div>
            <div class="quote-table">
              ${s.instruments.map(t=>`
                <div class="quote-row">
                  <div><b>${n(t.ticker||t.name)}</b><small>${n(t.name)} · ${t.kind==="equity"?"证券":n(t.unit)}</small></div>
                  <div class="quote-value"><b>${p(t.price)}</b><small class="${t.change>0?"positive":t.change<0?"negative":""}">${t.change>0?"+":""}${p(t.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`}).join("")}
      </div>
    </section>`}function h(a){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${a.factions.map(s=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(s.color)?s.color:"#8ca8c8"}"></i><div><b>${n(c(a,s))}</b><small>${n(f(a,s.governmentKey))} · ${n($(a,s))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${a.fleets.map(s=>{const r=a.systems.flatMap(t=>t.locations).find(t=>t.id===s.locationId);return`
          <article class="fleet-row"><div><b>${n(c(a,s))}</b><small>${n(c(a,s.faction))} · ${n(c(a,r,s.locationId))}</small><p>${s.ships.map(t=>{const e=a.shipClasses.find(i=>i.id===t.shipClassId);return`${n(c(a,e,t.shipClassId))} × ${t.quantity}`}).join("　")}</p></div><span>${s.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${a.wars.map(s=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${n(c(a,s))}</h4><p>${n($(a,s))}</p><div><b>${s.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${s.state.daysActive} 天</span><span>${s.participants.map(r=>n(c(a,a.factions.find(t=>t.id===r),r))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function A(a,s="overview",r=""){const t=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],e=s==="colonies"?S(a):s==="markets"?T(a):s==="military"?h(a):E(a);return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date"><small>GALACTIC DATE</small><b>${n(a.world.clock.date)}</b><span>第 ${a.world.clock.day} 天</span></div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${t.map(([i,o])=>`<button data-world-tab="${i}" class="${s===i?"active":""}">${o}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="advance" class="world-primary">推进一天</button>
          <button data-world-action="save">保存世界</button>
          <button data-world-action="leave">返回主菜单</button>
        </div>
      </div>
      ${r?`<div class="world-notice">${n(r)}</div>`:""}
      <div class="world-content">${e}</div>
      <footer class="world-footer"><span>存档：${n(a.saveId||"未命名")} · ${a.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${a.world.schemaVersion} · 内容指纹 ${a.world.contentHash.slice(0,10)}</span></footer>
    </main>`}const y=document.querySelector("#app"),l={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:""};function d(a){return String(a??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}function v(){return!!window.gameHost}function g(a){y.innerHTML=`
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
        <section class="menu-panel">${a}</section>
      </div>
      <footer class="title-footer">
        <span>INDEPENDENT DESKTOP EXPERIENCE</span>
        <span>ENGINE PROTOTYPE 0.2</span>
      </footer>
    </main>`}function b(){l.page="home",g(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${v()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function m(a,s,r){g(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${d(a)}</span><h2>${d(a)}</h2><p>${d(s)}</p></div>
    <div class="subpage-body">${r}</div>
  `)}function w(){if(!l.world)return b();l.page="world",y.innerHTML=A(l.world,l.worldTab,l.worldNotice)}async function O(){if(!v())return m("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{l.world=await window.gameHost.world.startNew(),l.worldTab="overview",l.worldNotice="新航程已建立。你可以切换栏目查看世界，或推进一天观察生产与价格变化。",w()}catch(a){m("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${d(a.message)}</p>`)}}async function j(a){try{l.world=await window.gameHost.world.loadSave(a),l.worldTab="overview",l.worldNotice="存档载入成功。随机数状态与模拟日期已从存档恢复。",w()}catch(s){m("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${d(s.message)}</p>`)}}async function I(){if(l.page="saves",!v())return m("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.slots=await window.gameHost.save.listSlots();const a=l.slots.map(s=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${d(s.id)}</span><h3>${d(s.metadata?.name||"无法读取的存档")}</h3><p>${s.status==="ok"?s.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":s.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+d(s.error)}</p><small>${d(s.metadata?.updated_at||s.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${s.status}">${s.status==="ok"?"正常":s.status==="incompatible"?"不兼容":"损坏"}</span>${s.status==="ok"&&s.hasWorld?`<button class="small-button" data-action="load-save" data-id="${d(s.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${d(s.id)}">删除</button></div>
      </article>`).join("");m("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",a||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(a){m("读取存档","读取存档列表时发生错误。",`<p class="error-state">${d(a.message)}</p>`)}}async function k(){if(l.page="settings",!v())return m("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.settings=await window.gameHost.settings.read();const a=l.settings.general,s=l.settings.graphics,r=l.settings.audio;m("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${a.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${a.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${a.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(t=>`<option value="${t}" ${s.ui_scale===t?"selected":""}>${t}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(t=>`<option value="${t}" ${r.master_volume===t?"selected":""}>${t}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(a){m("设置","无法读取配置文件。",`<p class="error-state">${d(a.message)}</p>`)}}async function N(){if(l.page="mods",!v())return m("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.mods=await window.gameHost.mods.list();const a=l.mods.map(s=>{const r=s.id==="core"||s.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${d(s.id)} · API ${d(s.apiVersion??"—")}</span><h3>${d(s.name)}</h3><p>${d(s.description||s.error||"无描述")}</p><small>作者：${d(s.author)}　版本：${d(s.version)}</small>${s.error?`<p class="error-state">${d(s.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${r?"ok":"off"}">${r?"已启用":"已禁用"}</span>${s.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${d(s.id)}" data-enabled="${r}">${r?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");m("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",a||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(a){m("模组管理","扫描模组时发生错误。",`<p class="error-state">${d(a.message)}</p>`)}}async function R(a){if(l.page=a,a==="home")return b();if(a==="saves")return I();if(a==="settings")return k();if(a==="mods")return N();if(a==="new")return O()}y.addEventListener("click",async a=>{const s=a.target.closest("[data-world-tab]");if(s&&l.world)return l.worldTab=s.dataset.worldTab,l.worldNotice="",w();const r=a.target.closest("[data-world-action]");if(r&&l.world&&!l.busy){l.busy=!0;try{const i=r.dataset.worldAction;if(i==="advance")l.world=await window.gameHost.world.advanceDay(),l.worldNotice="时间已推进一天。殖民地生产、市场报价与战争纪年均已更新。";else if(i==="save"){const o=await window.gameHost.world.save();l.world.dirty=!1,l.worldNotice=`世界已保存：${o.saveId}`}else if(i==="leave")return l.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),l.world=null,l.worldNotice="",b());w()}catch(i){l.worldNotice=`操作失败：${i.message}`,w()}finally{l.busy=!1}return}const t=a.target.closest("[data-action]");if(!t||l.busy)return;const e=t.dataset.action;try{if(e==="home")return b();if(e==="new"||e==="saves"||e==="settings"||e==="mods")return R(e);if(e==="quit"&&(v()?await window.gameHost.app.quit():m("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),e==="save-settings"){const i=document.querySelector("#settings-result"),o={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)}};await window.gameHost.settings.write(o),i.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(e==="delete-save"){const i=t.dataset.id;if(!window.confirm(`确定永久删除存档 ${i} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(i),await I()}if(e==="load-save")return j(t.dataset.id);if(e==="toggle-mod"){const i=t.dataset.id,o=t.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[i]:!o}}}),await N();const u=document.createElement("p");u.className="notice",u.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(u)}}catch(i){const o=document.querySelector("#settings-result")||document.querySelector(".subpage-body");o&&(o.textContent="操作失败："+i.message)}});b();
