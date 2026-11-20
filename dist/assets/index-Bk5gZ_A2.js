(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))n(t);new MutationObserver(t=>{for(const o of t)if(o.type==="childList")for(const d of o.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&n(d)}).observe(document,{childList:!0,subtree:!0});function a(t){const o={};return t.integrity&&(o.integrity=t.integrity),t.referrerPolicy&&(o.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?o.credentials="include":t.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(t){if(t.ep)return;t.ep=!0;const o=a(t);fetch(t.href,o)}})();const p=document.querySelector("#app"),l={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1};function i(e){return String(e??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s])}function c(){return!!window.gameHost}function m(e){p.innerHTML=`
    <main class="title-screen">
      <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
      <header class="title-bar">
        <div class="wordmark"><span class="mark">M</span><span>MARKET</span></div>
        <span class="build-label">DESKTOP EDITION <i></i></span>
      </header>
      <div class="main-layout">
        <section class="hero">
          <div class="overline"><span></span> A PRIVATE MARKET SIMULATION <span></span></div>
          <h1>MARKET</h1>
          <p class="subtitle">随机证券市场</p>
          <div class="rule"></div>
          <p class="tagline">每一次波动，都是一个新的故事。</p>
        </section>
        <section class="menu-panel">${e}</section>
      </div>
      <footer class="title-footer">
        <span>INDEPENDENT DESKTOP EXPERIENCE</span>
        <span>VERSION 0.1.0</span>
      </footer>
    </main>`}function u(){m(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>新存档</b><small>开始一段新的市场旅程</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览已有的存档槽位</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${c()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function r(e,s,a){m(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">MARKET / ${e}</span><h2>${e}</h2><p>${s}</p></div>
    <div class="subpage-body">${a}</div>
  `)}async function b(){if(l.page="saves",!c())return r("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.slots=await window.gameHost.save.listSlots();const e=l.slots.map(s=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${i(s.id)}</span><h3>${i(s.metadata?.name||"无法读取的存档")}</h3><p>${s.status==="ok"?"存档元数据正常 · 游戏载入功能尚未接入":s.status==="incompatible"?"存档版本不兼容":"存档元数据损坏："+i(s.error)}</p><small>${i(s.metadata?.updated_at||s.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${s.status}">${s.status==="ok"?"正常":s.status==="incompatible"?"不兼容":"损坏"}</span><button class="small-button danger" data-action="delete-save" data-id="${i(s.id)}">删除</button></div>
      </article>`).join("");r("读取存档","存档保存在游戏根目录的 save/ 文件夹。",e||'<p class="empty-state">还没有存档。游戏世界内容引擎接入后，这里将显示可读取的存档。</p>')}catch(e){r("读取存档","读取存档列表时发生错误。",`<p class="error-state">${i(e.message)}</p>`)}}async function g(){if(l.page="settings",!c())return r("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.settings=await window.gameHost.settings.read();const e=l.settings.general,s=l.settings.graphics,a=l.settings.audio;r("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(n=>`<option value="${n}" ${s.ui_scale===n?"selected":""}>${n}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(n=>`<option value="${n}" ${a.master_volume===n?"selected":""}>${n}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){r("设置","无法读取配置文件。",`<p class="error-state">${i(e.message)}</p>`)}}async function v(){if(l.page="mods",!c())return r("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{l.mods=await window.gameHost.mods.list();const e=l.mods.map(s=>{const a=s.id==="core"||s.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${i(s.id)} · API ${i(s.apiVersion??"—")}</span><h3>${i(s.name)}</h3><p>${i(s.description||s.error||"无描述")}</p><small>作者：${i(s.author)}　版本：${i(s.version)}</small>${s.error?`<p class="error-state">${i(s.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${a?"ok":"off"}">${a?"已启用":"已禁用"}</span>${s.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${i(s.id)}" data-enabled="${a}">${a?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");r("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){r("模组管理","扫描模组时发生错误。",`<p class="error-state">${i(e.message)}</p>`)}}async function w(e){if(l.page=e,e==="home")return u();if(e==="saves")return b();if(e==="settings")return g();if(e==="mods")return v();e==="new"&&r("新存档","游戏世界内容引擎尚未就绪。",'<p class="empty-state">目前不会创建空壳存档，也不会伪装成可以进入游戏。等世界生成与模拟系统接入后，这个入口才会开放。</p>')}p.addEventListener("click",async e=>{const s=e.target.closest("[data-action]");if(!s||l.busy)return;const a=s.dataset.action;try{if(a==="home")return u();if(a==="new"||a==="saves"||a==="settings"||a==="mods")return w(a);if(a==="quit"&&(c()?await window.gameHost.app.quit():r("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),a==="save-settings"){const n=document.querySelector("#settings-result"),t={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)}};await window.gameHost.settings.write(t),n.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(a==="delete-save"){const n=s.dataset.id;if(!window.confirm(`确定永久删除存档 ${n} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(n),await b()}if(a==="toggle-mod"){const n=s.dataset.id,t=s.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[n]:!t}}}),await v();const o=document.createElement("p");o.className="notice",o.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(o)}}catch(n){const t=document.querySelector("#settings-result")||document.querySelector(".subpage-body");t&&(t.textContent="操作失败："+n.message)}});u();
