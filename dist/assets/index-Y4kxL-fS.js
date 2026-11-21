(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const d of r.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&n(d)}).observe(document,{childList:!0,subtree:!0});function i(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(a){if(a.ep)return;a.ep=!0;const r=i(a);fetch(a.href,r)}})();function se({dayFraction:e,speed:t,baseDayDurationMs:i,elapsedMs:n}){if(!Number.isFinite(e)||e<0||e>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");if(!Number.isFinite(t)||t<0||t>4)throw new RangeError("Campaign display speed must be between 0x and 4x");if(!Number.isFinite(i)||i<=0)throw new RangeError("Base game-day duration must be positive");if(!Number.isFinite(n)||n<0)throw new RangeError("Elapsed display time must be non-negative");const a=e+(t===0?0:n*t/i);return Math.max(0,Math.min(.999,a))}function D(e,t){if(!Number.isInteger(e)||e<0)throw new RangeError("Campaign day must be a non-negative integer");if(!Number.isFinite(t)||t<0||t>=1)throw new RangeError("Campaign display fraction must be between 0 and 1");return Math.max(0,Math.min(.999,(e%7+t)/7))}function oe({day:e,dayFraction:t,speed:i,baseDayDurationMs:n,elapsedMs:a}){const r=se({dayFraction:t,speed:i,baseDayDurationMs:n,elapsedMs:a});return D(e,r)}function re(e,t=30){if(!Number.isInteger(t)||t<1)throw new RangeError("Calculation record limit must be a positive integer");const i=e?.audit?.calculations;return Array.isArray(i)?i.slice(-t).reverse():[]}function le(e,t){const i=e?.steps?.find(n=>n.id===t);return Number.isFinite(i?.value)?i.value:null}function A(e){return e&&typeof e=="object"&&!Array.isArray(e)?e:{}}function de(e){const t=A(e?.inputs),i=A(e?.result);switch(e?.formulaId){case"economy.commodity-price":{const n=le(e,"scarcity"),a=n===null?"audit.status.unknown":n>0?"audit.status.stock_scarce":n<0?"audit.status.stock_surplus":"audit.status.stock_balanced";return{kind:"commodity-price",titleKey:"audit.formula.commodity_price",explanationKey:n===null?"audit.explanation.formula_unknown":n>0?"audit.explanation.commodity_scarce":n<0?"audit.explanation.commodity_surplus":"audit.explanation.commodity_balanced",statusKey:a,facts:[{labelKey:"audit.field.current_stock",value:t.stock,commodityUnit:!0},{labelKey:"audit.field.target_stock",value:t.targetStock,commodityUnit:!0},{labelKey:"audit.field.previous_price",value:t.previousPrice,suffix:" CR"},{labelKey:"audit.field.current_price",value:i.price,suffix:" CR"},{labelKey:"audit.field.daily_change",value:i.change,suffix:"%"}]}}case"economy.security-price":{const n=Number.isFinite(i.change)?i.change:null;return{kind:"security-price",titleKey:"audit.formula.security_price",explanationKey:"audit.explanation.security_price",statusKey:n===null?"audit.status.unknown":n>0?"audit.status.price_up":n<0?"audit.status.price_down":"audit.status.price_steady",facts:[{labelKey:"audit.field.previous_price",value:t.previousPrice,suffix:" CR"},{labelKey:"audit.field.current_price",value:i.price,suffix:" CR"},{labelKey:"audit.field.daily_change",value:n,suffix:"%"},{labelKey:"audit.field.issuer_output_signal",value:t.outputValue}]}}case"economy.colony-production":{const n=i.batchScale;return{kind:"colony-production",titleKey:"audit.formula.colony_production",explanationKey:"audit.explanation.colony_production",statusKey:Number.isFinite(n)&&n<=0?"audit.status.no_output":i.limitingInput?"audit.status.production_limited":"audit.status.production_normal",facts:[{labelKey:"audit.field.stability_efficiency",value:i.efficiency,percentScale:100,suffix:"%"},{labelKey:"audit.field.requested_batches",value:i.requestedBatches},{labelKey:"audit.field.actual_batches",value:n}],inputs:Array.isArray(t.recipeInputs)?t.recipeInputs.map(r=>({commodityId:r.commodityId,perBatch:r.quantity,available:r.available})):[],limitingInput:typeof i.limitingInput=="string"?i.limitingInput:null,consumed:A(i.consumed),produced:A(i.produced)}}default:return{kind:"unknown",titleKey:"audit.formula.unknown",explanationKey:"audit.explanation.formula_unknown",statusKey:"audit.status.unknown",facts:[]}}}function ce(e,t=30){if(!Number.isInteger(t)||t<1)throw new RangeError("Domain event limit must be a positive integer");return(Array.isArray(e?.domainEvents)?e.domainEvents:[]).slice(-t).reverse()}function ue(e){return e?.payload&&typeof e.payload=="object"&&!Array.isArray(e.payload)?e.payload:{}}function me(e){const t=ue(e);switch(e?.type){case"market.prices-settled":return{kind:"market-settled",titleKey:"audit.event.market_settled",explanationKey:"audit.explanation.market_settled",cadenceKey:"audit.cadence.market_daily",facts:[{labelKey:"audit.field.updated_instruments",value:t.instrumentCount??0}],changes:t.changes&&typeof t.changes=="object"?{...t.changes}:{}};case"war.chronology-advanced":return{kind:"war-advanced",titleKey:"audit.event.war_advanced",explanationKey:"audit.explanation.war_advanced",cadenceKey:"audit.cadence.war_daily",facts:[{labelKey:"audit.field.war_days_active",value:t.daysActive??0}]};case"colony.production-settled":return{kind:"colony-production",titleKey:"audit.event.colony_production",explanationKey:"audit.explanation.colony_production_event",cadenceKey:"audit.cadence.colony_weekly",facts:[{labelKey:"audit.field.industry_count",value:t.industryCount??0},{labelKey:"audit.field.active_industry_count",value:t.activeIndustryCount??0}],production:t.production&&typeof t.production=="object"?{...t.production}:{}};default:return{kind:"event-driven",titleKey:"audit.event.other",explanationKey:"audit.explanation.event_driven",cadenceKey:"audit.cadence.event_driven",facts:[]}}}function o(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function _(e){return o(JSON.stringify(e??null,null,2))}function pe(e,t){const i=new Set((t.randomDraws||[]).map(n=>n.streamId).filter(Boolean));for(const n of e.markets||[])for(const a of n.instruments||[]){const r=`economy.market.${n.id}.${a.id}`;if(i.has(r))return{...a,marketName:c(e,n)}}return null}function j(e,t){const i=e.commodities.find(a=>a.id===t),n=i?.unitKey?l(e,i.unitKey):"";return`${c(e,i,t)}${n?" · "+n:""}`}function W(e,t,i){return t?.length?`<div class="audit-fact-grid">${t.map(n=>{if(!Number.isFinite(n.value))return"";const a=n.percentScale?n.value*n.percentScale:n.value,r=n.commodityUnit?` ${o(i?.unit||"")}`:o(n.suffix||"");return`<span><small>${o(l(e,n.labelKey))}</small><b>${f(a)}${r}</b></span>`}).join("")}</div>`:""}function M(e,t,i){const n=Object.entries(i||{});if(!n.length)return"";const a=n.map(([r,d])=>`<span>${o(j(e,r))}<b>${f(d)}</b></span>`).join("");return`<div class="audit-resource-group"><small>${o(l(e,t))}</small><div>${a}</div></div>`}function ye(e,t){const i=de(t),n=Array.isArray(t.randomDraws)?t.randomDraws:[],a=pe(e,t),r=a?`${a.marketName} · ${a.ticker||a.name}`:"",d=(i.inputs||[]).map(u=>`
    <span>${o(j(e,u.commodityId))}
      <b>每批 ${f(u.perBatch)} · 可用 ${f(u.available)}</b>
    </span>`).join(""),y=i.limitingInput?`<p class="audit-limiter">${o(l(e,"audit.field.limiting_input"))}：${o(j(e,i.limitingInput))}</p>`:"",w=i.statusKey?.split(".").at(-1)||"unknown",$=i.statusKey?`<b class="audit-status ${o(w)}">${o(l(e,i.statusKey))}</b>`:"",b=i.statusKey?`<small class="audit-record-status-note">${o(l(e,i.statusKey))}</small>`:"";return`
    <details class="audit-record">
      <summary>
        <span><b>第 ${t.day??"—"} 天 · ${o(l(e,i.titleKey))}</b><small>${o(t.formulaId)} · v${t.version}${r?" · "+o(r):""}</small>${b}</span>
        <em>${o(l(e,"audit.random_draws"))}：${n.length}</em>
      </summary>
      <div class="audit-record-body">
        <div class="audit-readable-summary">
          <p class="audit-explanation">${o(l(e,i.explanationKey))}</p>
          ${$}
          ${W(e,i.facts,a)}
          ${d?`<div class="audit-resource-group"><small>${o(l(e,"audit.field.recipe_inputs"))}</small><div>${d}</div></div>`:""}
          ${y}
          ${M(e,"audit.field.consumed",i.consumed)}
          ${M(e,"audit.field.produced",i.produced)}
        </div>
        <details class="audit-raw-details">
          <summary>${o(l(e,"audit.raw_calculation"))}</summary>
          <div class="audit-record-body">
            <section><h5>${o(l(e,"audit.raw_inputs"))}</h5><pre>${_(t.inputs)}</pre></section>
            <section><h5>${o(l(e,"audit.raw_steps"))}</h5><pre>${_(t.steps)}</pre></section>
            <section><h5>${o(l(e,"audit.raw_modifiers"))}</h5><pre>${_(t.modifiers)}</pre></section>
            <section><h5>${o(l(e,"audit.raw_random"))}</h5><pre>${_(n)}</pre></section>
            <section><h5>${o(l(e,"audit.raw_result"))}</h5><pre>${_(t.result)}</pre></section>
          </div>
        </details>
      </div>
    </details>`}function B(e){const t=re(e.world,30),i=t.length?t.map(n=>ye(e,n)).join(""):`<div class="audit-empty">${o(l(e,"audit.empty_calculations"))}</div>`;return`
    <aside class="calculation-audit-panel" data-audit-panel aria-label="${o(l(e,"audit.calculation_panel"))}">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">CALCULATION TRACE / READ ONLY</span><h3>${o(l(e,"audit.calculation_panel"))}</h3><small>${t.length} / 30</small></div>
        <button data-world-action="toggle-audit" aria-label="${o(l(e,"audit.close"))}">${o(l(e,"audit.close"))}</button>
      </header>
      <div class="audit-panel-body">${i}</div>
      <footer class="audit-panel-footer">${o(l(e,"audit.calculation_footer"))}</footer>
    </aside>`}function ve(e,t){const n=(t.scope==="colony"?e.colonies:t.scope==="market"?e.markets:t.scope==="war"?e.wars:[]).find(a=>a.id===t.subjectId);return n?c(e,n):t.subjectId||l(e,"audit.no_subject")}function we(e,t){const i=Object.entries(t||{});if(!i.length)return"";const n=i.map(([a,r])=>{const y=e.markets.find($=>$.instruments.some(b=>b.id===a))?.instruments.find($=>$.id===a),w=y?.ticker||y?.name||a;return`<span>${o(w)}<b>${r>0?"+":""}${f(r)}%</b></span>`}).join("");return`<div class="audit-resource-group"><small>${o(l(e,"audit.field.quote_changes"))}</small><div>${n}</div></div>`}function fe(e,t){const i=me(t),n=ve(e,t);return`
    <details class="audit-record domain-event-record">
      <summary>
        <span><b>#${t.sequence} · 第 ${t.day} 天 · ${o(l(e,i.titleKey))}</b><small>${o(t.date)} · ${o(n)}</small><small class="audit-cadence">${o(l(e,i.cadenceKey))}</small></span>
        <em>${Object.keys(t.payload||{}).length}</em>
      </summary>
      <div class="audit-record-body">
        <div class="audit-readable-summary">
          <p class="audit-explanation">${o(l(e,i.explanationKey))}</p>
          ${W(e,i.facts)}
          ${we(e,i.changes)}
          ${M(e,"audit.field.production_output",i.production)}
        </div>
        <details class="audit-raw-details">
          <summary>${o(l(e,"audit.raw_event"))}</summary>
          <div class="audit-record-body">
            <section><h5>${o(l(e,"audit.raw_metadata"))}</h5><pre>${_({id:t.id,sequence:t.sequence,day:t.day,date:t.date,type:t.type,scope:t.scope,subjectId:t.subjectId,idempotencyKey:t.idempotencyKey})}</pre></section>
            <section><h5>${o(l(e,"audit.raw_payload"))}</h5><pre>${_(t.payload)}</pre></section>
          </div>
        </details>
      </div>
    </details>`}function U(e){const t=ce(e.world,30),i=t.length?t.map(n=>fe(e,n)).join(""):`<div class="audit-empty">${o(l(e,"audit.empty_events"))}</div>`;return`
    <aside class="calculation-audit-panel domain-event-panel" data-domain-event-panel aria-label="${o(l(e,"audit.event_panel"))}">
      <header class="audit-panel-header">
        <div><span class="world-eyebrow">DOMAIN EVENT STREAM / READ ONLY</span><h3>${o(l(e,"audit.event_panel"))}</h3><small>${t.length} / 30 · ${o(l(e,"audit.event_history_retention"))}</small></div>
        <button data-world-action="toggle-domain-events" aria-label="${o(l(e,"audit.close"))}">${o(l(e,"audit.close"))}</button>
      </header>
      <div class="audit-panel-body">${i}</div>
      <footer class="audit-panel-footer">${o(l(e,"audit.event_footer"))}</footer>
    </aside>`}function l(e,t){return e.localization?.[t]||`[${t||"missing-localization-key"}]`}function c(e,t,i=""){return t?.nameKey?l(e,t.nameKey):i}function K(e,t){return t?.descriptionKey?l(e,t.descriptionKey):""}function f(e){return new Intl.NumberFormat("zh-CN",{maximumFractionDigits:2}).format(e||0)}function V(e){return`
    <section class="world-section" data-world-region="recent-events">
      <div class="world-section-head"><div><span class="world-eyebrow">RECENT LOG</span><h3>最近动态</h3></div></div>
      <div class="event-list">${e.recentEvents.map(t=>`
        <article><time>第 ${t.day} 天 · ${o(t.date)}</time><p>${o(t.text)}</p></article>
      `).join("")}</div>
    </section>`}function be(e){const t=e.colonies.reduce((a,r)=>a+r.state.population,0),i=e.wars.filter(a=>a.state.status==="active").length,n=e.factions.find(a=>a.id===e.world.player.factionId);return`
    <section class="world-intro">
      <div><span class="world-eyebrow">SECTOR OVERVIEW / ${o(e.universe.id)}</span><h2>${o(c(e,e.universe))}</h2><p>${o(K(e,e.universe))}</p></div>
      <div class="world-faction"><small>玩家所属势力</small><b>${o(c(e,n,"未知势力"))}</b><small>种子：${e.world.metadata.seed}</small></div>
    </section>
    <section class="world-metrics">
      <article><small>已知星系</small><b>${e.systems.length}</b></article>
      <article><small>殖民地</small><b>${e.colonies.length}</b></article>
      <article><small>总人口</small><b>${f(t)}</b></article>
      <article><small>活跃战争</small><b>${i}</b></article>
      <article><small>可用资金</small><b>${f(e.world.finance.accounts[e.world.player.accountId].balanceMinor/100)} CR</b></article>
    </section>
    <section class="world-section">
      <div class="world-section-head"><div><span class="world-eyebrow">STARMAP</span><h3>星系网络</h3></div><small>星系间的连接代表已知航道，不代表即时移动</small></div>
      <div class="system-grid">
        ${e.systems.map(a=>{const r=e.factions.find(d=>d.id===a.factionId);return`
          <article class="system-card">
            <span class="system-coordinate">${a.position.x}, ${a.position.y}</span>
            <h4>${o(c(e,a))}</h4>
            <p>${o(K(e,a))}</p>
            <small>所属势力：${o(c(e,r,"中立"))}</small>
            <div class="system-links">${a.links.map(d=>o(c(e,e.systems.find(y=>y.id===d),d))).join(" · ")}</div>
            <div class="system-locations">${a.locations.map(d=>o(c(e,d,d.id))).join(" / ")}</div>
          </article>`}).join("")}
      </div>
      <div class="route-strip">
        <div class="route-heading"><b>已知贸易航线</b><small>航行时间为静态内容参数，当前尚未生成实际货物流</small></div>
        <div class="route-list">${e.tradeRoutes.map(a=>{const r=e.systems.find(y=>y.id===a.fromSystemId),d=e.systems.find(y=>y.id===a.toSystemId);return`<span><b>${o(c(e,a,a.id))}</b><small>${o(c(e,r,a.fromSystemId))} → ${o(c(e,d,a.toSystemId))} · ${a.travelDays} 天 · 风险 ${Math.round(a.risk*100)}% · 容量 ${f(a.capacity)}</small></span>`}).join("")}</div>
      </div>
    </section>
    ${V(e)}`}function z(e){return`
    <section class="world-section" data-world-region="colony-production">
      <div class="world-section-head"><div><span class="world-eyebrow">SETTLEMENTS</span><h3>殖民地与生产</h3></div><small>当前生产按殖民地库存结算，星际物流尚未接入</small></div>
      <div class="colony-grid">
        ${e.colonies.map(t=>{const i=Object.entries(t.state.stockpiles).map(([w,$])=>{const b=e.commodities.find(u=>u.id===w);return`<span><small>${o(c(e,b,w))}</small><b>${f($)} ${o(b?.unitKey?l(e,b.unitKey):"")}</b></span>`}).join(""),n=t.state.lastProductionReport,a=new Map((n?.industries||[]).map(w=>[w.industryIndex,w])),r=w=>Object.entries(w||{}).map(([$,b])=>{const u=e.commodities.find(T=>T.id===$),O=u?.unitKey?l(e,u.unitKey):"";return`${o(c(e,u,$))} ${f(b)} ${o(O)}`}).join("、")||"无",d=t.state.industries.map((w,$)=>{const b=e.recipes.find(R=>R.id===w.recipeId),u=a.get($);if(!u)return`<li class="industry-entry"><div class="industry-entry-heading"><span>${o(c(e,b,w.recipeId))} <small>等级 ${w.level}</small></span></div><div class="industry-pending">等待首次周生产结算</div></li>`;const O=u.status==="normal"?"生产正常":u.status==="no-output"?"无产出":"原料受限",T=u.status==="normal"?"normal":"limited",q=u.limitingInput?e.commodities.find(R=>R.id===u.limitingInput):null,ie=q?.unitKey?l(e,q.unitKey):"",ne=u.limitingInput?`限制原料：${o(c(e,q,u.limitingInput))} · 库存 ${f(u.limitingAvailable)} / 计划需求 ${f(u.limitingRequired)} ${o(ie)}`:"原料充足";return`<li class="industry-entry">
              <div class="industry-entry-heading"><span>${o(c(e,b,w.recipeId))} <small>等级 ${w.level}</small></span><b class="industry-status ${T}">${O}</b></div>
              <div class="industry-batches">生产批次：${f(u.actualBatches)} / ${f(u.requestedBatches)}</div>
              <div class="industry-output"><span>计划产出</span><b>${r(u.requestedOutput)}</b></div>
              <div class="industry-output"><span>实际产出</span><b>${r(u.produced)}</b></div>
              <div class="industry-limiter ${u.limitingInput?"warning":""}">${ne}</div>
            </li>`}).join(""),y=n?`最近结算：第 ${n.day} 天`:"等待首次周生产结算";return`
            <article class="colony-card">
              <div class="colony-heading"><div><span class="world-eyebrow">${o(t.location.systemId)}</span><h4>${o(c(e,t))}</h4><p>${o(c(e,t.faction))} · ${o(c(e,t.location))}</p></div><b class="stability">${t.state.stability}%</b></div>
              <div class="colony-population"><span>人口</span><b>${f(t.state.population)}</b></div>
              <div class="stock-grid">${i}</div>
              <div class="industry-list"><div class="industry-list-heading"><b>生产设施</b><small>${y}</small></div><ul>${d}</ul></div>
            </article>`}).join("")}
      </div>
    </section>`}function G(e){return`
    <section class="world-section" data-world-region="market-quotes">
      <div class="world-section-head"><div><span class="world-eyebrow">COMMERCE & FINANCE</span><h3>地方市场</h3></div><small>报价随库存稀缺度和可复现的随机扰动变化</small></div>
      <div class="market-grid">
        ${e.markets.map(t=>{const i=e.colonies.find(n=>n.id===t.colonyId);return`
          <article class="market-card">
            <div><span class="world-eyebrow">${o(t.id)}</span><h4>${o(c(e,t))}</h4><p>${o(c(e,i,t.colonyId))}</p></div>
            <div class="quote-table">
              ${t.instruments.map(n=>`
                <div class="quote-row">
                  <div><b>${o(n.ticker||n.name)}</b><small>${o(n.name)} · ${n.kind==="equity"?"证券":o(n.unit)}</small></div>
                  <div class="quote-value"><b>${f(n.price)}</b><small class="${n.change>0?"positive":n.change<0?"negative":""}">${n.change>0?"+":""}${f(n.change)}%</small></div>
                </div>
              `).join("")}
            </div>
          </article>`}).join("")}
      </div>
    </section>`}function Y(e){return`
    <section class="world-section" data-world-region="war-chronology">
      <div class="world-section-head"><div><span class="world-eyebrow">STRATEGIC SITUATION</span><h3>势力与战争</h3></div><small>舰队目前为静态编制数据，战术指令与实时战斗仍在后续阶段</small></div>
      <div class="military-grid">
        <div class="military-panel"><h4>势力</h4>${e.factions.map(t=>`
          <article class="faction-row"><i style="background:${/^#[0-9a-fA-F]{6}$/.test(t.color)?t.color:"#8ca8c8"}"></i><div><b>${o(c(e,t))}</b><small>${o(l(e,t.governmentKey))} · ${o(K(e,t))}</small></div></article>
        `).join("")}</div>
        <div class="military-panel"><h4>舰队</h4>${e.fleets.map(t=>{const i=e.systems.flatMap(n=>n.locations).find(n=>n.id===t.locationId);return`
          <article class="fleet-row"><div><b>${o(c(e,t))}</b><small>${o(c(e,t.faction))} · ${o(c(e,i,t.locationId))}</small><p>${t.ships.map(n=>{const a=e.shipClasses.find(r=>r.id===n.shipClassId);return`${o(c(e,a,n.shipClassId))} × ${n.quantity}`}).join("　")}</p></div><span>${t.state.readiness}%<small>战备</small></span></article>`}).join("")}</div>
      </div>
      <div class="war-list">${e.wars.map(t=>`
        <article class="war-card"><span class="world-eyebrow">ACTIVE CONFLICT</span><h4>${o(c(e,t))}</h4><p>${o(K(e,t))}</p><div><b>${t.state.status==="active"?"进行中":"已结束"}</b><span>持续 ${t.state.daysActive} 天</span><span>${t.participants.map(i=>o(c(e,e.factions.find(n=>n.id===i),i))).join("　VS　")}</span></div></article>
      `).join("")}</div>
    </section>`}function $e(e,t){switch(t){case"recent-events":return V(e);case"colony-production":return z(e);case"market-quotes":return G(e);case"war-chronology":return Y(e);default:return""}}function ge(e,t="overview",i="",n=!1,a=!1){const r=[["overview","星域总览"],["colonies","殖民地与生产"],["markets","市场与金融"],["military","势力与战争"]],d=t==="colonies"?z(e):t==="markets"?G(e):t==="military"?Y(e):be(e),w=(D(e.world.clock.day,e.world.clock.dayFraction||0)*100).toFixed(1),$=e.world.clock.day%7+1;return`
    <main class="world-screen">
      <header class="world-header">
        <div class="world-brand"><span class="world-mark">F</span><div><b>FRONTIER</b><small>STAR SYSTEMS SIMULATION</small></div></div>
        <div class="world-date">
          <small>GALACTIC DATE</small>
          <b data-world-date>${o(e.world.clock.date)}</b>
          <div class="world-day-summary"><span data-world-day>第 ${e.world.clock.day} 天 · 第 ${Math.floor(e.world.clock.day/7)+1} 周 · 本周第 ${$} 天</span><strong data-world-percent>${w}%</strong></div>
          <div class="campaign-week-track" data-world-progress-track role="progressbar" aria-label="当前游戏周进度，划分为七个日刻度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w}">
            <span class="campaign-week-fill" data-world-progress style="width:${w}%"></span>
            <span class="campaign-week-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          </div>
        </div>
      </header>
      <div class="world-toolbar">
        <div class="world-tabs">${r.map(([b,u])=>`<button data-world-tab="${b}" class="${t===b?"active":""}">${u}</button>`).join("")}</div>
        <div class="world-actions">
          <button data-world-action="toggle-audit" class="${n?"selected":""}" aria-expanded="${n}">计算审计</button>
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
      ${i?`<div class="world-notice">${o(i)}</div>`:""}
      <div class="world-content">${d}</div>
      <footer class="world-footer"><span data-save-status>存档：${o(e.saveId||"未命名")} · ${e.dirty?"有未保存更改":"已保存"}</span><span>世界版本 ${e.world.schemaVersion} · 内容指纹 ${e.world.contentHash.slice(0,10)}</span></footer>
      ${n?B(e):""}
      ${a?U(e):""}
    </main>`}const ke=Object.freeze([{id:"recent-events",tab:"overview",cadence:"daily"},{id:"colony-production",tab:"colonies",cadence:"weekly"},{id:"market-quotes",tab:"markets",cadence:"daily"},{id:"war-chronology",tab:"military",cadence:"daily"}]);function Ce({activeTab:e,previousDay:t,currentDay:i}){if(!Number.isInteger(t)||t<0||!Number.isInteger(i)||i<=t)return[];const n=Math.floor(i/7)>Math.floor(t/7);return ke.filter(a=>a.tab===e&&(a.cadence==="daily"||n)).map(a=>a.id)}const v=document.querySelector("#app"),s={page:"home",settings:null,slots:[],mods:[],error:"",busy:!1,world:null,worldTab:"overview",worldNotice:"",auditOpen:!1,domainEventsOpen:!1};function p(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function I(){return!!window.gameHost}function J(e){v.innerHTML=`
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
    </main>`}function E(){s.page="home",J(`
    <div class="menu-heading"><span class="eyebrow">MAIN MENU</span><h2>主菜单</h2><p>选择一个入口继续。</p></div>
    <nav class="main-menu">
      <button class="menu-button primary" data-action="new"><span class="menu-index">01</span><span><b>开始新航程</b><small>进入赫利俄斯边境的演示世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="saves"><span class="menu-index">02</span><span><b>读取存档</b><small>浏览并恢复已有的世界</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="settings"><span class="menu-index">03</span><span><b>设置</b><small>调整窗口、界面与声音</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button" data-action="mods"><span class="menu-index">04</span><span><b>模组管理</b><small>管理已安装的数据模组</small></span><span class="menu-arrow">→</span></button>
      <button class="menu-button exit" data-action="quit"><span class="menu-index">05</span><span><b>退出</b><small>关闭游戏并释放运行资源</small></span><span class="menu-arrow">↗</span></button>
    </nav>
    ${I()?"":'<p class="notice">当前为浏览器预览模式，桌面接口尚不可用。</p>'}
  `)}function Ie(e){C+=1,s.world=null,s.busy=!1,s.auditOpen=!1,s.domainEventsOpen=!1,s.worldNotice="",E();const t=e.logContext||e.stack||e.message||"No error details available";v.insertAdjacentHTML("beforeend",`
    <div class="fatal-error-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="fatal-error-title">
      <section class="fatal-error-panel">
        <div class="fatal-error-heading">
          <span class="eyebrow">WORLD EXECUTION STOPPED / ${p(e.failureId||"UNKNOWN")}</span>
          <h2 id="fatal-error-title">世界运行发生错误</h2>
          <p>游戏已停止当前世界并返回主菜单。请复制下方诊断记录并提交给开发者。</p>
        </div>
        <div class="fatal-error-message"><b>${p(e.source||"unknown")}</b><span>${p(e.message||"Unknown error")}</span></div>
        <label for="fatal-error-report">错误行及前后日志（可直接复制）</label>
        <textarea id="fatal-error-report" readonly spellcheck="false">${p(t)}</textarea>
        <div class="fatal-error-actions">
          <button class="action-button" data-action="copy-fatal-error">复制全部诊断记录</button>
          <button class="small-button" data-action="close-fatal-error">关闭并留在主菜单</button>
        </div>
      </section>
    </div>`),document.querySelector("#fatal-error-report")?.focus()}function k(e,t,i){J(`
    <div class="subpage-heading"><button class="back-button" data-action="home">← 返回</button><span class="eyebrow">FRONTIER / ${p(e)}</span><h2>${p(e)}</h2><p>${p(t)}</p></div>
    <div class="subpage-body">${i}</div>
  `)}let g=null,m=null,x=null,h=!1,C=0;function _e(){m={date:v.querySelector("[data-world-date]"),day:v.querySelector("[data-world-day]"),percent:v.querySelector("[data-world-percent]"),progress:v.querySelector("[data-world-progress]"),progressTrack:v.querySelector("[data-world-progress-track]"),status:v.querySelector("[data-time-label]"),speedButtons:[...v.querySelectorAll("[data-world-action='set-speed']")],footer:v.querySelector("[data-save-status]")}}function X(){if(!g||!m)return;const{clock:e,timeControl:t}=g,i=Math.floor(e.day/7)+1,n=e.day%7+1;if(m.date&&m.date.textContent!==e.date&&(m.date.textContent=e.date),m.day){const a=`第 ${e.day} 天 · 第 ${i} 周 · 本周第 ${n} 天`;m.day.textContent!==a&&(m.day.textContent=a)}if(m.status){const a=t.paused?"时间已暂停":`世界时间 · ${t.speed}x`;m.status.textContent!==a&&(m.status.textContent=a)}for(const a of m.speedButtons){const r=Number(a.dataset.speed)===t.speed;a.classList.contains("selected")!==r&&(a.classList.toggle("selected",r),a.setAttribute("aria-pressed",String(r)))}if(m.footer){const a=`存档：${g.saveId||"未命名"} · ${g.dirty?"有未保存更改":"已保存"}`;m.footer.textContent!==a&&(m.footer.textContent=a)}}function H(){if(!g||!m)return;const{clock:e,timeControl:t}=g,i=t.speed>0?Math.max(0,performance.now()-g.syncedAt):0,a=(oe({day:e.day,dayFraction:e.dayFraction||0,speed:t.speed,baseDayDurationMs:t.baseDayDurationMs,elapsedMs:i})*100).toFixed(1);if(m.percent&&m.percent.textContent!==`${a}%`&&(m.percent.textContent=`${a}%`),m.progress){const r=`${a}%`;m.progress.style.width!==r&&(m.progress.style.width=r)}if(m.progressTrack){const r=String(Number(a));m.progressTrack.getAttribute("aria-valuenow")!==r&&m.progressTrack.setAttribute("aria-valuenow",r)}}function Q(){x!==null&&(cancelAnimationFrame(x),x=null)}function Z(){x=null,!(s.page!=="world"||!s.world||!g)&&(H(),g.timeControl.speed>0&&(x=requestAnimationFrame(Z)))}function ee(){g?.timeControl.speed>0&&x===null&&(x=requestAnimationFrame(Z))}function P(e){!s.world||!e?.clock||!e?.timeControl||(g={clock:{...e.clock},timeControl:{...e.timeControl},saveId:e.saveId??s.world.saveId,dirty:e.dirty??s.world.dirty,syncedAt:performance.now()},s.world.world.clock={...e.clock},s.world.timeControl={...e.timeControl},e.saveId!==void 0&&(s.world.saveId=e.saveId),e.dirty!==void 0&&(s.world.dirty=e.dirty),X(),H(),g.timeControl.speed>0?ee():Q())}function N(e){P({clock:e.world.clock,timeControl:e.timeControl,saveId:e.saveId,dirty:e.dirty})}function S(){if(!s.world)return E();s.page="world",v.innerHTML=ge(s.world,s.worldTab,s.worldNotice,s.auditOpen,s.domainEventsOpen),_e(),X(),H(),ee()}function xe(e,t){const i=Ce({activeTab:s.worldTab,previousDay:t,currentDay:e.world.clock.day});if(i.length>0){const n=v.querySelector(".world-content"),a=n?.scrollTop??0;for(const r of i){const d=v.querySelector(`[data-world-region="${r}"]`);if(!d)continue;const y=$e(e,r);y&&(d.outerHTML=y)}n&&(n.scrollTop=a)}s.auditOpen&&F(),s.domainEventsOpen&&L()}function F(){const e=v.querySelector("[data-audit-panel]"),t=v.querySelector("[data-world-action='toggle-audit']");if(t&&(t.classList.toggle("selected",s.auditOpen),t.setAttribute("aria-expanded",String(s.auditOpen))),!s.auditOpen){e?.remove();return}if(!s.world)return;const i=B(s.world);if(e){const a=e.querySelector(".audit-panel-body")?.scrollTop??0;e.outerHTML=i;const r=v.querySelector("[data-audit-panel] .audit-panel-body");r&&(r.scrollTop=a)}else v.querySelector(".world-screen")?.insertAdjacentHTML("beforeend",i)}function L(){const e=v.querySelector("[data-domain-event-panel]"),t=v.querySelector("[data-world-action='toggle-domain-events']");if(t&&(t.classList.toggle("selected",s.domainEventsOpen),t.setAttribute("aria-expanded",String(s.domainEventsOpen))),!s.domainEventsOpen){e?.remove();return}if(!s.world)return;const i=U(s.world);if(e){const a=e.querySelector(".audit-panel-body")?.scrollTop??0;e.outerHTML=i;const r=v.querySelector("[data-domain-event-panel] .audit-panel-body");r&&(r.scrollTop=a)}else v.querySelector(".world-screen")?.insertAdjacentHTML("beforeend",i)}async function Ee(){if(!I()||s.page!=="world"||!s.world||s.busy||h)return;h=!0;const e=C,t=s.world,i=t.world.clock.day;try{const n=await window.gameHost.world.getClockStatus();if(e!==C||s.page!=="world"||s.world!==t||s.busy)return;if(n.clock.day!==i){const a=await window.gameHost.world.getStatus();if(e!==C||s.page!=="world"||s.world!==t||s.busy)return;s.world=a,N(a),xe(a,i)}else P(n)}catch(n){console.error("World clock synchronization failed",n)}finally{h=!1}}setInterval(()=>{Ee()},250);async function Se(){if(C+=1,!I())return k("开始新航程","需要桌面运行环境。",'<p class="empty-state">请通过独立启动器打开游戏，浏览器预览不具备存档和模拟接口。</p>');try{s.world=await window.gameHost.world.startNew(),s.auditOpen=!1,s.domainEventsOpen=!1,N(s.world),s.worldTab="overview",s.worldNotice="新航程已建立，世界时间初始暂停。使用右侧速度控制开始运行；市场每日更新，殖民地工业每七天结算一次。",S()}catch(e){k("无法启动世界","核心内容未通过验证，或者存档目录不可写。",`<p class="error-state">${p(e.message)}</p>`)}}async function Ne(e){C+=1;try{s.world=await window.gameHost.world.loadSave(e),s.auditOpen=!1,s.domainEventsOpen=!1,N(s.world),s.worldTab="overview",s.worldNotice="存档载入成功，世界时间默认暂停。日期、随机数与结算调度状态已从存档恢复。",S()}catch(t){k("无法载入存档","该存档可能不是世界存档，或者所需 Mod 内容已经发生变化。",`<p class="error-state">${p(t.message)}</p>`)}}async function te(){if(s.page="saves",!I())return k("读取存档","存档列表需要桌面运行环境。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.slots=await window.gameHost.save.listSlots();const e=s.slots.map(t=>`
      <article class="data-card">
        <div class="card-main"><span class="card-kicker">${p(t.id)}</span><h3>${p(t.metadata?.name||"无法读取的存档")}</h3><p>${t.status==="ok"?t.hasWorld?"世界存档正常 · 载入时会校验 Mod 内容版本":"旧版本空数据槽 · 尚无可载入的世界":t.status==="incompatible"?"存档版本不兼容":"存档数据或元数据有问题："+p(t.error)}</p><small>${p(t.metadata?.updated_at||t.metadata?.created_at||"无时间信息")}</small></div>
        <div class="card-actions"><span class="status-pill ${t.status}">${t.status==="ok"?"正常":t.status==="incompatible"?"不兼容":"损坏"}</span>${t.status==="ok"&&t.hasWorld?`<button class="small-button" data-action="load-save" data-id="${p(t.id)}">载入</button>`:""}<button class="small-button danger" data-action="delete-save" data-id="${p(t.id)}">删除</button></div>
      </article>`).join("");k("读取存档","世界状态保存在游戏根目录 save/ 对应槽位的 data/world.json 中。",e||'<p class="empty-state">还没有存档。开始一段新航程即可创建第一个世界。</p>')}catch(e){k("读取存档","读取存档列表时发生错误。",`<p class="error-state">${p(e.message)}</p>`)}}async function Ae(){if(s.page="settings",!I())return k("设置","桌面设置接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.settings=await window.gameHost.settings.read();const e=s.settings.general,t=s.settings.graphics,i=s.settings.audio,n=s.settings.simulation;k("设置","修改后会写入游戏根目录 setting/，也可以直接编辑 INI 文件。",`
      <div class="setting-row"><div><b>窗口模式</b><small>独占全屏当前由 Electron 全屏窗口模拟，并非传统独占显示模式。</small></div><select id="window-mode"><option value="windowed" ${e.window_mode==="windowed"?"selected":""}>窗口化</option><option value="borderless" ${e.window_mode==="borderless"?"selected":""}>无边框全屏</option><option value="exclusive" ${e.window_mode==="exclusive"?"selected":""}>独占全屏（兼容模拟）</option></select></div>
      <div class="setting-row"><div><b>UI 缩放</b><small>调整界面整体大小。</small></div><select id="ui-scale">${[80,90,100,110,120,130,140,150,160].map(a=>`<option value="${a}" ${t.ui_scale===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>基础时间流速</b><small>1x 下经过一个游戏日所需的现实秒数；暂停与 1x–4x 倍率独立。</small></div><select id="base-day-seconds">${[10,30,60,120,300,600].map(a=>`<option value="${a}" ${n.base_day_seconds===a?"selected":""}>${a} 秒 / 游戏日</option>`).join("")}</select></div>
      <div class="setting-row"><div><b>主音量</b><small>预留给后续音频系统。</small></div><select id="master-volume">${[0,25,50,75,100].map(a=>`<option value="${a}" ${i.master_volume===a?"selected":""}>${a}%</option>`).join("")}</select></div>
      <div class="form-actions"><button class="action-button" data-action="save-settings">保存设置</button><span id="settings-result" class="inline-result"></span></div>
    `)}catch(e){k("设置","无法读取配置文件。",`<p class="error-state">${p(e.message)}</p>`)}}async function ae(){if(s.page="mods",!I())return k("模组管理","桌面 Mod 接口不可用。",'<p class="empty-state">请通过游戏启动器打开。</p>');try{s.mods=await window.gameHost.mods.list();const e=s.mods.map(t=>{const i=t.id==="core"||t.enabled!==!1;return`
        <article class="data-card">
          <div class="card-main"><span class="card-kicker">${p(t.id)} · API ${p(t.apiVersion??"—")}</span><h3>${p(t.name)}</h3><p>${p(t.description||t.error||"无描述")}</p><small>作者：${p(t.author)}　版本：${p(t.version)}</small>${t.error?`<p class="error-state">${p(t.error)}</p>`:""}</div>
          <div class="card-actions"><span class="status-pill ${i?"ok":"off"}">${i?"已启用":"已禁用"}</span>${t.id==="core"?'<span class="locked-label">核心锁定</span>':`<button class="small-button" data-action="toggle-mod" data-id="${p(t.id)}" data-enabled="${i}">${i?"禁用":"启用"}</button>`}</div>
        </article>`}).join("");k("模组管理","Mod 只提供 registry、content 和 localization 数据，不执行代码。启停变更将在重启后生效。",e||'<p class="empty-state">mods/ 中尚未发现模组。</p>')}catch(e){k("模组管理","扫描模组时发生错误。",`<p class="error-state">${p(e.message)}</p>`)}}async function Ke(e){if(s.page=e,e==="home")return E();if(e==="saves")return te();if(e==="settings")return Ae();if(e==="mods")return ae();if(e==="new")return Se()}v.addEventListener("click",async e=>{const t=e.target.closest("[data-world-tab]");if(t&&s.world)return s.worldTab=t.dataset.worldTab,s.worldNotice="",S();const i=e.target.closest("[data-world-action]");if(i&&s.world&&i.dataset.worldAction==="toggle-audit"&&!s.busy){s.auditOpen=!s.auditOpen,s.auditOpen&&(s.domainEventsOpen=!1),F(),L();return}if(i&&s.world&&i.dataset.worldAction==="toggle-domain-events"&&!s.busy){s.domainEventsOpen=!s.domainEventsOpen,s.domainEventsOpen&&(s.auditOpen=!1),L(),F();return}if(i&&s.world&&!s.busy){C+=1,s.busy=!0;try{const r=i.dataset.worldAction;if(r==="set-speed"){const d=Number(i.dataset.speed);s.world=await window.gameHost.world.setSpeed(d),N(s.world),s.worldNotice=d===0?"世界时间已暂停。":`世界时间已切换为 ${d}x。`}else if(r==="advance")s.world=await window.gameHost.world.advanceDay(),N(s.world),s.worldNotice="兼容性调试操作：世界时间已推进一天。";else if(r==="save"){const d=await window.gameHost.world.save();s.world.dirty=!1;const y=await window.gameHost.world.getClockStatus();P(y),s.worldNotice=`世界已保存：${d.saveId}`}else if(r==="leave")return s.world.dirty&&!window.confirm("当前世界有尚未保存的更改。返回主菜单将丢失这些更改，确定继续吗？")?void 0:(await window.gameHost.world.leave(),C+=1,Q(),g=null,m=null,s.world=null,s.auditOpen=!1,s.domainEventsOpen=!1,s.worldNotice="",E());S()}catch(r){s.worldNotice=`操作失败：${r.message}`,S()}finally{s.busy=!1}return}const n=e.target.closest("[data-action]");if(!n||s.busy)return;const a=n.dataset.action;try{if(a==="copy-fatal-error"){const r=document.querySelector("#fatal-error-report");r&&(r.focus(),r.select(),await navigator.clipboard.writeText(r.value),n.textContent="已复制");return}if(a==="close-fatal-error"){document.querySelector(".fatal-error-backdrop")?.remove();return}if(a==="home")return E();if(a==="new"||a==="saves"||a==="settings"||a==="mods")return Ke(a);if(a==="quit"&&(I()?await window.gameHost.app.quit():k("退出","浏览器预览模式无法关闭桌面应用。",'<p class="empty-state">请关闭浏览器窗口。</p>')),a==="save-settings"){const r=document.querySelector("#settings-result"),d={general:{window_mode:document.querySelector("#window-mode").value},graphics:{ui_scale:Number(document.querySelector("#ui-scale").value)},audio:{master_volume:Number(document.querySelector("#master-volume").value)},simulation:{base_day_seconds:Number(document.querySelector("#base-day-seconds").value)}};await window.gameHost.settings.write(d),r.textContent="已保存。窗口模式已应用，部分设置可能需要重启。"}if(a==="delete-save"){const r=n.dataset.id;if(!window.confirm(`确定永久删除存档 ${r} 吗？此操作不可撤销。`))return;await window.gameHost.save.removeSlot(r),await te()}if(a==="load-save")return Ne(n.dataset.id);if(a==="toggle-mod"){const r=n.dataset.id,d=n.dataset.enabled==="true";await window.gameHost.settings.write({mods:{enabled:{[r]:!d}}}),await ae();const y=document.createElement("p");y.className="notice",y.textContent="状态已保存，重启游戏后生效。",document.querySelector(".subpage-body")?.prepend(y)}}catch(r){const d=document.querySelector("#settings-result")||document.querySelector(".subpage-body");d&&(d.textContent="操作失败："+r.message)}});E();I()&&window.gameHost.app.onWorldFatalError(Ie);
