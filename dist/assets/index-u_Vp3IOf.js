(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))t(e);new MutationObserver(e=>{for(const o of e)if(o.type==="childList")for(const c of o.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&t(c)}).observe(document,{childList:!0,subtree:!0});function i(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?o.credentials="include":e.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function t(e){if(e.ep)return;e.ep=!0;const o=i(e);fetch(e.href,o)}})();function n(s){return String(s??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a])}function m(s){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(s||0)}function y(s){const a=s.colonies.reduce((t,e)=>t+e.state.population,0),i=s.wars.filter(t=>t.state.status==="active").length;return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${n(s.universe.id)}</span><h2>${n(s.universe.name)}</h2><p>${n(s.universe.description)}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${n(s.factions.find(t=>t.id===s.world.player.factionId)?.name||"未知势力")}</b><small>种子：${s.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${s.systems.length}</b></article>
      <article><small>殖民地</small><b>${s.colonies.length}</b></article>
      <article><small>总人口</small><b>${m(a)}</b></article>
      <article><small>活跃战争</small><b>${i}</b></article>
      <article><small>可用资金</small><b>${m(s.world.player.account.cash)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${s.systems.map(t=>`
          <article class="system-card">
            <span class="system-coordinate">${t.position.x}, ${t.position.y}</span>
            <h4>${n(t.name)}</h4>
            <p>${n(t.description)}</p>
            <small>所属势力：${n(s.factions.find(e=>e.id===t.factionId)?.name||"中立")}</small>
            <div class="system-links">${t.links.map(e=>n(s.systems.find(o=>o.id===e)?.name||e)).join(" · ")}</div>
            <div class="system-locations">${t.locations.map(e=>n(e.name)).join(" / ")}</div>
          </article>`).join("")}
      </div>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${s.recentEvents.map(t=>`
        <article><time>第 ${t.day} 天 · ${n(t.date)}</time><p>${n(t.text)}</p></article>
      `).join("")}</div>
    </section>`}function h(s){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${s.colonies.map(a=>{const i=Object.entries(a.state.stockpiles).map(([e,o])=>{const c=s.commodities.find(u=>u.id===e);return`<span><small>${n(c?.name||e)}</small><b>${m(o)} ${n(c?.unit||"")}</b></span>`}).join(""),t=a.state.industries.map(e=>{const o=s.recipes.find(c=>c.id===e.recipeId);return`<li>${n(o?.name||e.recipeId)} <small>等级 ${e.level}</small></li>`}).join("");return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${n(a.location.systemId)}</span><h4>${n(a.name)}</h4><p>${n(a.faction.name)} · ${n(a.location.name)}</p></div><b class="stability">${a.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${m(a.state.population)}</b></div>
              <div class="stock-grid">${i}</div>
              <div class="industry-list"><b>生产设施</b><ul>${t}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function N(s){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${s.markets.map(a=>`
          <article class="market-card">
            <div><span class="world-eyebrow">${n(a.id)}</span><h4>${n(a.name)}</h4><p>${n(s.colonies.find(i=>i.id===a.colonyId)?.name||a.colonyId)}</p></div>
            <div class="quote-table">
              ${a.instruments.map(i=>`
                <div class="quote-row">
                  <div><b>${n(i.ticker||i.name)}</b><small>${n(i.name)} · ${i.kind==="equity"?"证券":n(i.unit)}</small></div>
                  <div class="quote-value"><b>${m(i.price)}</b><small class="${i.change>0?"positive":i.change<0?"negative":""}">${i.change>0?"+":""}${m(i.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`).join("")}
      </div>
    </section>`}function I(s){return`
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${s.factions.map(a=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(a.color)?a.color:"#8ca8c8"}"></i><div><b>${n(a.name)}</b><small>${n(a.government)} · ${n(a.description)}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${s.fleets.map(a=>`
          <article class="fleet-row"><div><b>${n(a.name)}</b><small>${n(a.faction.name)} · ${n(a.locationId)}</small><p>${a.ships.map(i=>`${n(s.shipClasses.find(t=>t.id===i.shipClassId)?.name||i.shipClassId)} × ${i.quantity}`).join("　")}</p></div><span>${a.state.readiness}%<small>战备</small></span></article>
        `).join("")}</div>
      </div>
      <div class="war-list">${s.wars.map(a=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${n(a.name)}</h4><p>${n(a.description)}</p><div><b>${a.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${a.state.daysActive} 天</span><span>${a.participants.map(i=>n(s.factions.find(t=>t.id===i)?.name||i)).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function E(s,a="overview",i=""){const t=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],e=a==="colonies"?h(s):a==="markets"?N(s):a==="military"?I(s):y(s);return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date"><small>GALACTIC DATE</small><b>${n(s.world.clock.date)}</b><span>第 ${s.world.clock.day} 天</span></div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${t.map(([o,c])=>`<button data-world-tab="${o}" class="${a===o?"active":""}">${c}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="advance" class="world-primary">推进一天</button>
          <button data-world-action="save">保存世界</button>
          <button data-world-action="leave">返回主菜单</button>
        </div>
      </div>
      ${i?`<div class="world-notice">${n(i)}</div>`:""}
      <div class="world-content">${e}</div>
      <footer class="world-footer"><span>存档：${n(s.saveId||"未命名")}</span><span>世界版本 ${s.world.schemaVersion} · 内容指纹 ${s.world.contentHash.slice(0,10)}</span></footer>
    </main>`}const b=document.querySelector("#app"),l={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:""};function r(s){return String(s??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a])}function p(){return!!window.gameHost}function $(s){b.innerHTML=`
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
        <section class="menu-panel">${s}</section>
      </div>
      <footer class="title-footer">
        <span>INDEPENDENT DESKTOP EXPERIENCE</span>
        <span>ENGINE PROTOTYPE 0.2</span>
      </footer>
    </main>`}function w(){l.page="home",$(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${p()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function d(s,a,i){$(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${r(s)}</span><h2>${r(s)}</h2><p>${r(a)}</p></div>
    <div class="subpage-body">${i}</div>
  `)}function v(){if(!l.world)return w();l.page="world",b.innerHTML=E(l.world,l.worldTab,l.worldNotice)}async function T(){if(!p())return d("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{l.world=await window.gameHost.world.startNew(),l.worldTab="overview",l.worldNotice="新航程已建立。你可以切换栏目查看世界，或推进一天观察生产与价格变化。",v()}catch(s){d("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${r(s.message)}</p>`)}}async function S(s){try{l.world=await window.gameHost.world.loadSave(s),l.worldTab="overview",l.worldNotice="存档载入成功。随机数状态与模拟日期已从存档恢复。",v()}catch(a){d("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${r(a.message)}</p>`)}}async function g(){if(l.page="saves",!p())return d("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.slots=await window.gameHost.save.listSlots();const s=l.slots.map(a=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${r(a.id)}</span><h3>${r(a.metadata?.name||"无法读取的存档")}</h3><p>${a.status==="ok"?"存档元数据正常 · 世界存档载入时会校验内容版本":a.status==="incompatible"?"存档版本不兼容":"存档元数据损坏："+r(a.error)}</p><small>${r(a.metadata?.updated_at||a.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${a.status}">${a.status==="ok"?"正常":a.status==="incompatible"?"不兼容":"损坏"}</span>${a.status==="ok"?`<button class="small-button" data-action="load-save" data-id="${r(a.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${r(a.id)}">删除</button></div>
      </article>`).join("");d("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",s||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(s){d("读取存档","读取存档列表时发生错误。",`<p class="error-state">${r(s.message)}</p>`)}}async function A(){if(l.page="settings",!p())return d("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.settings=await window.gameHost.settings.read();const s=l.settings.general,a=l.settings.graphics,i=l.settings.audio;d("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${s.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${s.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${s.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(t=>`<option value="${t}" ${a.ui_scale===t?"selected":""}>${t}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(t=>`<option value="${t}" ${i.master_volume===t?"selected":""}>${t}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(s){d("设置","无法读取配置文件。",`<p class="error-state">${r(s.message)}</p>`)}}async function f(){if(l.page="mods",!p())return d("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.mods=await window.gameHost.mods.list();const s=l.mods.map(a=>{const i=a.id==="core"||a.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${r(a.id)} · API ${r(a.apiVersion??"—")}</span><h3>${r(a.name)}</h3><p>${r(a.description||a.error||"无描述")}</p><small>作者：${r(a.author)}　版本：${r(a.version)}</small>${a.error?`<p class="error-state">${r(a.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${i?"ok":"off"}">${i?"已启用":"已禁用"}</span>${a.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${r(a.id)}" data-enabled="${i}">${i?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");d("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",s||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(s){d("模组管理","扫描模组时发生错误。",`<p class="error-state">${r(s.message)}</p>`)}}async function O(s){if(l.page=s,s==="home")return w();if(s==="saves")return g();if(s==="settings")return A();if(s==="mods")return f();if(s==="new")return T()}b.addEventListener("click",async s=>{const a=s.target.closest("[data-world-tab]");if(a&&l.world)return l.worldTab=a.dataset.worldTab,l.worldNotice="",v();const i=s.target.closest("[data-world-action]");if(i&&l.world&&!l.busy){l.busy=!0;try{const o=i.dataset.worldAction;if(o==="advance")l.world=await window.gameHost.world.advanceDay(),l.worldNotice="时间已推进一天。殖民地生产、市场报价与战争纪年均已更新。";else if(o==="save"){const c=await window.gameHost.world.save();l.worldNotice=`世界已保存：${c.saveId}`}else if(o==="leave")return await window.gameHost.world.leave(),l.world=null,l.worldNotice="",w();v()}catch(o){l.worldNotice=`操作失败：${o.message}`,v()}finally{l.busy=!1}return}const t=s.target.closest("[data-action]");if(!t||l.busy)return;const e=t.dataset.action;try{if(e==="home")return w();if(e==="new"||e==="saves"||e==="settings"||e==="mods")return O(e);if(e==="quit"&&(p()?await window.gameHost.app.quit():d("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),e==="save-settings"){const o=document.querySelector("#settings-result"),c={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)}};await window.gameHost.settings.write(c),o.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(e==="delete-save"){const o=t.dataset.id;if(!window.confirm(`确定永久删除存档 ${o} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(o),await g()}if(e==="load-save")return S(t.dataset.id);if(e==="toggle-mod"){const o=t.dataset.id,c=t.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[o]:!c}}}),await f();const u=document.createElement("p");u.className="notice",u.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(u)}}catch(o){const c=document.querySelector("#settings-result")||document.querySelector(".subpage-body");c&&(c.textContent="操作失败："+o.message)}});w();
