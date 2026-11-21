const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {readModPackages}=require("../electron/mod-loader.cjs");
const {SeededRandom,NamedRandomStreams,createCalculationService,addDays,compileCatalog,createWorld,advanceDay,advanceDays,advanceCampaignTime,migrateWorldState,validateWorldState}=require("../engine/index.cjs");
const { CampaignTimeController } = require("../engine/campaign-time.cjs");
async function mods(){return readModPackages(path.join(__dirname,"..","mods"));}
async function catalog(){const r=compileCatalog(await mods());if(!r.ok)throw new Error(r.error);return r.catalog;}
test("game clock handles month boundaries and leap years",()=>{assert.equal(addDays("2478-04-30",1),"2478-05-01");assert.equal(addDays("2480-02-28",1),"2480-02-29");assert.equal(addDays("2480-02-28",2),"2480-03-01");assert.throws(()=>addDays("2480-02-30",1),/Invalid game date/);});
test("seeded random generator can be resumed",()=>{const a=new SeededRandom("frontier-test"),v=[a.next(),a.next(),a.next()],s=a.snapshot(),b=new SeededRandom(s.seed,s.state);assert.deepEqual([b.next(),b.next()],[a.next(),a.next()]);assert.notDeepEqual(v,[0,0,0]);});
test("Core and community Mod INI definitions compile",async()=>{const c=await catalog();assert.equal(c.universe.name,undefined);assert.equal(c.localizations["zh-CN"][c.universe.nameKey],"赫利俄斯边境");assert.equal(c.systems.size,4);assert.equal(c.colonies.size,3);assert.equal(c.fleets.size,2);assert.equal(c.wars.size,1);assert.ok(c.events.has("supply-rumor"));assert.ok(c.events.has("example-positive-news"));assert.equal(c.commodities.get("food").dailyNeedPerThousand,.001);assert.equal(c.commodities.get("water").dailyNeedPerThousand,.0015);});
test("catalog rejects unresolved production references",async()=>{const m=await mods(),core=m.find(x=>x.id==="core");core.data.content["universe.ini"].colonies[0].industries[0].recipeId="missing-recipe";const r=compileCatalog(m);assert.equal(r.ok,false);assert.match(r.error,/industry recipe/);});
test("daily needs settle before market pricing while colony production remains weekly",async()=>{
 const c=await catalog(),w=createWorld(c,{seed:42,createdAt:"2478-04-01T00:00:00.000Z"});
 const initialNewDawn=structuredClone(w.colonies["new-dawn-colony"]);
 const initialVerdant=structuredClone(w.colonies["verdant-colony"]);
 const price=w.markets["verdant-exchange"].prices.food;
 advanceDay(w,c);
 let newDawn=w.colonies["new-dawn-colony"],verdant=w.colonies["verdant-colony"];
 assert.equal(w.clock.date,"2478-04-02");assert.equal(w.clock.day,1);
 assert.equal(newDawn.stockpiles.ore,initialNewDawn.stockpiles.ore);
 assert.equal(newDawn.stockpiles.food,117.9);assert.equal(newDawn.stockpiles.water,106.85);
 assert.equal(verdant.stockpiles.food,initialVerdant.stockpiles.food-1.45);
 assert.equal(newDawn.population,initialNewDawn.population);assert.equal(newDawn.stability,initialNewDawn.stability);
 assert.equal(newDawn.lastNeedsReport.day,1);
 assert.notEqual(w.markets["verdant-exchange"].prices.food,price);
 assert.ok(Object.values(newDawn.stockpiles).every((amount)=>amount>=0));
 for(let day=0;day<6;day++)advanceDay(w,c);
 newDawn=w.colonies["new-dawn-colony"];verdant=w.colonies["verdant-colony"];
 assert.equal(w.clock.day,7);
 assert.ok(newDawn.stockpiles.ore>initialNewDawn.stockpiles.ore);
 assert.ok(verdant.stockpiles.food>initialVerdant.stockpiles.food);
 assert.equal(newDawn.lastProductionReport.day,7);
 assert.equal(newDawn.lastNeedsReport.day,7);
 assert.deepEqual(w.events.at(-1).systemsRun,["colonies.production","population.needs-consumption","economy.market-pricing","military.war-chronology"]);
});
test("daily needs consume food and water before market pricing and retain unmet demand",async()=>{
 const c=await catalog(),w=createWorld(c,{seed:"daily-population-needs"});
 const initialNewDawn=structuredClone(w.colonies["new-dawn-colony"]);
 const initialVerdant=structuredClone(w.colonies["verdant-colony"]);
 const initialPrice=w.markets["verdant-exchange"].prices.food;
 advanceDay(w,c);
 const newDawn=w.colonies["new-dawn-colony"],verdant=w.colonies["verdant-colony"];
 assert.equal(newDawn.stockpiles.food,117.9);
 assert.equal(newDawn.stockpiles.water,106.85);
 assert.equal(verdant.stockpiles.food,initialVerdant.stockpiles.food-1.45);
 assert.equal(verdant.stockpiles.water,initialVerdant.stockpiles.water-2.175);
 assert.equal(newDawn.lastNeedsReport.day,1);
 assert.equal(newDawn.lastNeedsReport.shortageCount,0);
 assert.equal(w.markets["verdant-exchange"].prices.food!==initialPrice,true);
 assert.equal(newDawn.population,initialNewDawn.population);
 assert.equal(newDawn.stability,initialNewDawn.stability);
 assert.equal(w.audit.calculations.filter((record)=>record.formulaId==="economy.population-needs"&&record.day===1).length,3);
 assert.deepEqual(w.events.at(-1).systemsRun,["population.needs-consumption","economy.market-pricing","military.war-chronology"]);
 assert.ok(Object.values(newDawn.stockpiles).every((amount)=>amount>=0));
});
test("daily needs report stock shortage without underflow or automatic population changes",async()=>{
 const c=await catalog(),w=createWorld(c,{seed:"daily-needs-shortage"});
 const colonyId="new-dawn-colony";
 w.colonies[colonyId].stockpiles.water=1;
 const population=w.colonies[colonyId].population,stability=w.colonies[colonyId].stability;
 advanceDay(w,c);
 const colony=w.colonies[colonyId];
 const water=colony.lastNeedsReport.needs.find((item)=>item.commodityId==="water");
 assert.equal(water.available,1);
 assert.equal(water.requested,3.15);
 assert.equal(water.consumed,1);
 assert.equal(water.unmet,2.15);
 assert.equal(water.satisfaction,.3175);
 assert.equal(water.status,"shortage");
 assert.equal(colony.stockpiles.water,0);
 assert.equal(colony.population,population);
 assert.equal(colony.stability,stability);
 assert.equal(colony.lastNeedsReport.shortageCount,1);
 const event=w.domainEvents.find((item)=>item.type==="colony.needs-settled"&&item.subjectId===colonyId);
 assert.equal(event.payload.shortageCount,1);
 assert.equal(event.payload.needs.find((item)=>item.commodityId==="water").unmet,2.15);
});
test("weekly production replenishes input stock before same-day population needs and market pricing",async()=>{
 const c=await catalog(),w=createWorld(c,{seed:"weekly-production-before-needs"});
 for(let day=0;day<7;day++)advanceDay(w,c);
 const colony=w.colonies["verdant-colony"];
 const production=colony.lastProductionReport.industries.find((item)=>item.recipeId==="food-production");
 const foodNeed=colony.lastNeedsReport.needs.find((item)=>item.commodityId==="food");
 assert.equal(colony.lastProductionReport.day,7);
 assert.equal(colony.lastNeedsReport.day,7);
 assert.ok(production.produced.food>0);
 assert.ok(foodNeed.available>foodNeed.requested);
 assert.equal(foodNeed.unmet,0);
 assert.deepEqual(w.events.at(-1).systemsRun,["colonies.production","population.needs-consumption","economy.market-pricing","military.war-chronology"]);
});
test("weekly production report explains limited inputs and matches the stockpile settlement",async()=>{
  const c=await catalog(),w=createWorld(c,{seed:"production-report-limited"});
  const colony=w.colonies["verdant-colony"],industry=colony.industries[0],recipe=c.recipes.get(industry.recipeId);
  colony.population=1; // Keep this test focused on the weekly production input limit.
  colony.industries=[structuredClone(industry)];
  const requestedBatches=industry.level*Math.max(.1,Math.min(1,colony.stability/100));
  const inputTotals=new Map();
  for(const input of recipe.inputs||[])inputTotals.set(input.commodityId,(inputTotals.get(input.commodityId)||0)+input.quantity);
  for(const [id,quantity] of inputTotals)colony.stockpiles[id]=quantity*requestedBatches*2;
  const limitingId=recipe.inputs[0].commodityId;
  colony.stockpiles[limitingId]=inputTotals.get(limitingId)*requestedBatches/2;
  const before={...colony.stockpiles};
  advanceDays(w,c,7);
  const settledColony=w.colonies["verdant-colony"];
  const report=settledColony.lastProductionReport;
  assert.equal(report.day,7);
  assert.equal(report.industries.length,1);
  const entry=report.industries[0];
  assert.equal(entry.status,"limited");
  assert.equal(entry.limitingInput,limitingId);
  assert.equal(entry.limitingAvailable,before[limitingId]);
  assert.ok(Math.abs(entry.limitingRequired-inputTotals.get(limitingId)*requestedBatches)<1e-9);
  assert.ok(Math.abs(entry.actualBatches-requestedBatches/2)<1e-9);
  assert.equal(entry.requestedBatches,requestedBatches);
  for(const id of new Set([...Object.keys(before),...Object.keys(entry.consumed),...Object.keys(entry.produced)])){
    let expected=before[id]||0;
    if(Object.hasOwn(entry.consumed,id))expected=Math.round((Math.max(0,expected-entry.consumed[id])+Number.EPSILON)*1000)/1000;
    if(Object.hasOwn(entry.produced,id))expected=Math.round((expected+entry.produced[id]+Number.EPSILON)*1000)/1000;
    assert.equal(settledColony.stockpiles[id],expected);
  }
});
test("weekly production report keeps zero-output facilities and identifies the empty limiting stockpile",async()=>{
  const c=await catalog(),w=createWorld(c,{seed:"production-report-empty"});
  const colony=w.colonies["verdant-colony"],industry=w.colonies["verdant-colony"].industries[0],recipe=c.recipes.get(industry.recipeId);
  colony.population=1; // Keep this test focused on the empty production input.
  colony.industries=[structuredClone(industry)];
  const requestedBatches=industry.level*Math.max(.1,Math.min(1,colony.stability/100));
  const inputTotals=new Map();
  for(const input of recipe.inputs||[])inputTotals.set(input.commodityId,(inputTotals.get(input.commodityId)||0)+input.quantity);
  for(const [id,quantity] of inputTotals)colony.stockpiles[id]=quantity*requestedBatches*2;
  const limitingId=recipe.inputs[0].commodityId;
  colony.stockpiles[limitingId]=0;
  const before={...colony.stockpiles};
  advanceDays(w,c,7);
  const settledColony=w.colonies["verdant-colony"];
  const entry=settledColony.lastProductionReport.industries[0];
  assert.equal(entry.status,"no-output");
  assert.equal(entry.actualBatches,0);
  assert.equal(entry.limitingInput,limitingId);
  assert.equal(entry.limitingAvailable,0);
  assert.ok(entry.limitingRequired>0);
  assert.deepEqual(entry.consumed,Object.fromEntries([...inputTotals.keys()].map(id=>[id,0])));
  assert.deepEqual(entry.produced,Object.fromEntries((recipe.outputs||[]).map(item=>[item.commodityId,0])));
  assert.deepEqual(settledColony.stockpiles,before);
});
test("input-free extraction reports normal production without a false shortage",async()=>{
  const c=await catalog(),w=createWorld(c,{seed:"production-report-no-input"});
  advanceDays(w,c,7);
  const colony=w.colonies["new-dawn-colony"];
  const entry=colony.lastProductionReport.industries.find(item=>item.recipeId==="ore-extraction");
  assert.ok(entry);
  assert.equal(entry.status,"normal");
  assert.equal(entry.limitingInput,null);
  assert.equal(entry.limitingAvailable,null);
  assert.equal(entry.limitingRequired,null);
  assert.equal(entry.actualBatches,entry.requestedBatches);
  assert.ok(entry.requestedOutput.ore>0);
  assert.ok(entry.produced.ore>0);
});
test("continuous campaign time preserves fractions and catches up every daily and weekly boundary",async()=>{const c=await catalog(),w=createWorld(c,{seed:51});let result=advanceCampaignTime(w,c,0.4);assert.equal(result.daysAdvanced,0);assert.equal(w.clock.day,0);assert.equal(w.clock.dayFraction,0.4);result=advanceCampaignTime(w,c,13.6);assert.equal(result.daysAdvanced,14);assert.equal(w.clock.day,14);assert.equal(w.clock.dayFraction,0);assert.equal(w.scheduler.lastRunDayBySystem["colonies.production"],14);assert.equal(w.scheduler.lastRunDayBySystem["economy.market-pricing"],14);assert.equal(w.scheduler.lastRunDayBySystem["military.war-chronology"],14);});
test("legacy world schemas 1 and 2 migrate to event-enabled schema without changing calendar time",async()=>{const c=await catalog(),legacy=createWorld(c,{seed:5});legacy.schemaVersion=1;delete legacy.clock.dayFraction;delete legacy.scheduler;delete legacy.commandReceipts;delete legacy.finance;delete legacy.player.accountId;legacy.player.account={cash:250000,holdings:{}};legacy.clock.date="2478-04-13";legacy.clock.day=12;legacy.rng={seed:5,state:123};const migrated=migrateWorldState(legacy);assert.equal(migrated.schemaVersion,7);assert.deepEqual(migrated.clock,{date:"2478-04-13",day:12,dayFraction:0});assert.deepEqual(migrated.scheduler,{lastRunDayBySystem:{}});assert.deepEqual(migrated.rng,{seed:5,streams:{}});assert.deepEqual(migrated.audit,{calculations:[]});assert.deepEqual(migrated.domainEvents,[]);assert.equal(migrated.domainEventSequence,0);assert.deepEqual(migrated.commandReceipts,[]);assert.equal(migrated.finance.accounts["player-main"].balanceMinor,25000000);assert.equal(migrated.finance.transactions[0].day,12);assert.equal(migrated.finance.transactions[0].date,"2478-04-13");assert.equal(validateWorldState(migrated,c),true);const schema2=createWorld(c,{seed:6});schema2.schemaVersion=2;schema2.rng={seed:6,state:999};delete schema2.audit;delete schema2.commandReceipts;delete schema2.finance;delete schema2.player.accountId;schema2.player.account={cash:125000,holdings:{}};assert.equal(migrateWorldState(schema2).schemaVersion,7);assert.equal(schema2.finance.accounts["player-main"].balanceMinor,12500000);assert.equal(validateWorldState(schema2,c),true);const schema3=createWorld(c,{seed:7});schema3.schemaVersion=3;delete schema3.domainEvents;delete schema3.domainEventSequence;delete schema3.commandReceipts;delete schema3.finance;delete schema3.player.accountId;schema3.player.account={cash:75000,holdings:{}};assert.equal(migrateWorldState(schema3).schemaVersion,7);assert.equal(schema3.finance.accounts["player-main"].balanceMinor,7500000);assert.equal(validateWorldState(schema3,c),true);});
test("schema-five saves migrate player cash and positions into the canonical ledger",async()=>{const c=await catalog(),legacy=createWorld(c,{seed:9});legacy.schemaVersion=5;delete legacy.finance;delete legacy.player.accountId;legacy.player.account={cash:12345.67,holdings:{"frontier-industries":4}};const migrated=migrateWorldState(legacy);assert.equal(migrated.schemaVersion,7);assert.equal(migrated.player.accountId,"player-main");assert.equal(migrated.finance.accounts["player-main"].balanceMinor,1234567);assert.deepEqual(migrated.finance.accounts["player-main"].positions,{"frontier-industries":4});assert.equal(migrated.player.account,undefined);assert.equal(validateWorldState(migrated,c),true);});
test("schema-four saves migrate command receipt history without changing world state",async()=>{const c=await catalog(),legacy=createWorld(c,{seed:8});legacy.schemaVersion=4;delete legacy.commandReceipts;delete legacy.finance;delete legacy.player.accountId;legacy.player.account={cash:50000,holdings:{}};legacy.clock.day=8;legacy.clock.date="2478-04-09";const migrated=migrateWorldState(legacy);assert.equal(migrated.schemaVersion,7);assert.deepEqual(migrated.commandReceipts,[]);assert.equal(migrated.clock.day,8);assert.equal(migrated.clock.date,"2478-04-09");assert.equal(migrated.finance.accounts["player-main"].balanceMinor,5000000);assert.equal(migrated.finance.transactions[0].day,8);assert.equal(migrated.finance.transactions[0].date,"2478-04-09");assert.equal(validateWorldState(migrated,c),true);});
test("seeded simulations and resumed saves are deterministic",async()=>{const c=await catalog(),o={seed:"repeatable-frontier",createdAt:"2478-04-01T00:00:00.000Z"},a=createWorld(c,o),b=createWorld(c,o);advanceDays(a,c,7);advanceDays(b,c,7);assert.deepEqual(a,b);const resumed=JSON.parse(JSON.stringify(a));advanceDays(a,c,3);advanceDays(resumed,c,3);assert.deepEqual(a,resumed);assert.equal(validateWorldState(resumed,c),true);});
test("simulation rejects oversized jumps and mismatched content",async()=>{const c=await catalog(),w=createWorld(c,{seed:7});assert.throws(()=>advanceDays(w,c,31),/between 1 and 30/);assert.throws(()=>advanceDay(w,{...c,contentHash:"different"}),/different Mod content/);});
test("catalog rejects invalid recipe quantities and dates",async()=>{const m=await mods(),badRecipe=structuredClone(m);badRecipe.find(x=>x.id==="core").data.content["economy.ini"].recipes[0].outputs[0].quantity=0;let r=compileCatalog(badRecipe);assert.equal(r.ok,false);assert.match(r.error,/Invalid numeric value.*recipe output/);const badDate=structuredClone(m);badDate.find(x=>x.id==="core").data.content["universe.ini"].universe.startDate="2478-02-30";r=compileCatalog(badDate);assert.equal(r.ok,false);assert.match(r.error,/Invalid date.*startDate/);});
test("catalog rejects routes with invalid risk",async()=>{const m=await mods();m.find(x=>x.id==="core").data.content["universe.ini"].tradeRoutes[0].risk=1.5;const r=compileCatalog(m);assert.equal(r.ok,false);assert.match(r.error,/route.*risk/);});
test("all display names, descriptions and units resolve from localization INI",async()=>{const c=await catalog();for(const n of ["universes","systems","locations","tradeRoutes","factions","colonies","commodities","recipes","markets","companies","securities","shipClasses","fleets","wars","events"])for(const e of c[n].values()){assert.equal(e.name,undefined);assert.equal(e.description,undefined);assert.equal(typeof e.nameKey,"string");assert.ok(c.localizations["zh-CN"][e.nameKey]);if(e.descriptionKey)assert.ok(c.localizations["zh-CN"][e.descriptionKey]);if(e.unitKey)assert.ok(c.localizations["zh-CN"][e.unitKey]);}});
test("catalog rejects missing localized strings",async()=>{const m=await mods();delete m.find(x=>x.id==="core").data.localization["zh-CN.ini"].content["entity.solace.name"];const r=compileCatalog(m);assert.equal(r.ok,false);assert.match(r.error,/Missing localization key.*entity.solace.name/);});

test("named random streams are stable and isolated from unrelated stream consumption",()=>{
  const first=new NamedRandomStreams("isolation-seed"),second=new NamedRandomStreams("isolation-seed");
  const a1=first.get("economy.market.alpha.ore").next();
  first.get("economy.market.beta.food").next();first.get("economy.market.beta.food").next();
  const b1=first.get("economy.market.alpha.ore").next();
  assert.equal(a1,second.get("economy.market.alpha.ore").next());
  assert.equal(b1,second.get("economy.market.alpha.ore").next());
});
test("named random streams restore exact state and serialize in stable key order",()=>{
  const streams=new NamedRandomStreams(77),a=streams.get("economy.market.alpha.ore");
  a.next();a.next();streams.get("military.war.frontier").next();
  const snapshot=streams.snapshot(),restored=new NamedRandomStreams(snapshot.seed,snapshot.streams);
  assert.deepEqual(restored.get("economy.market.alpha.ore").snapshot(),a.snapshot());
  assert.deepEqual(restored.snapshot(),snapshot);
});
test("named random stream IDs and saved seeds are validated",()=>{
  assert.throws(()=>new NamedRandomStreams(1).get("Bad ID"),/stable lowercase ID/);
  assert.throws(()=>new NamedRandomStreams(1,{"economy.market.ore":{seed:2,state:3}}),/does not match/);
});
test("market formula service records inputs, modifiers, steps and actual random draws",async()=>{
  const c=await catalog(),w=createWorld(c,{seed:"formula-audit"});
  advanceDay(w,c);
  const records=w.audit.calculations;
  assert.ok(records.length>0);
  const commodity=records.find(x=>x.formulaId==="economy.commodity-price");
  assert.ok(commodity);
  assert.equal(commodity.version,2);
  assert.equal(commodity.day,1);
  assert.ok(commodity.steps.some(x=>x.id==="scarcity"));
  assert.ok(commodity.modifiers.some(x=>x.id==="market-volatility"));
  assert.equal(commodity.randomDraws.length,1);
  assert.match(commodity.randomDraws[0].streamId,/^economy\.market\./);
  assert.equal(commodity.randomDraws[0].method,"next");
  assert.ok(Object.hasOwn(commodity,"result"));
  assert.ok(records.some(x=>x.formulaId==="economy.security-price"));
});
test("calculation audit history is bounded and reading it does not consume random draws",()=>{
  const service=createCalculationService({definitions:[{id:"test.roll",version:1,calculate:({random,recordStep})=>{const value=random.next();recordStep("roll",value);return value;}}],historyLimit:2});
  const random=new SeededRandom(8);
  service.evaluate("test.roll",{}, {random,randomStreamId:"test.roll.stream",day:1});
  const stateAfterFirst=random.snapshot();
  const beforeRead=service.getRecords();
  service.getRecords();service.getRecords();
  assert.deepEqual(random.snapshot(),stateAfterFirst);
  service.evaluate("test.roll",{}, {random,randomStreamId:"test.roll.stream",day:2});
  service.evaluate("test.roll",{}, {random,randomStreamId:"test.roll.stream",day:3});
  assert.equal(service.size,2);
  assert.equal(beforeRead.length,1);
});

test("a failed system discards the candidate day instead of partially mutating the live world", async () => {
  const c = await catalog();
  const world = createWorld(c, { seed: "atomic-day" });
  const before = structuredClone(world);
  const brokenMarkets = new Map(c.markets);
  brokenMarkets.get = () => undefined;
  const brokenCatalog = { ...c, markets: brokenMarkets };
  assert.throws(() => advanceDay(world, brokenCatalog), /colonyId|undefined/);
  assert.deepEqual(world, before);
});

test("day boundary reports a missing required market price before settlement", async () => {
  const c = await catalog();
  const world = createWorld(c, { seed: "missing-price" });
  const before = structuredClone(world);
  const marketId = c.markets.keys().next().value;
  const instrumentId = c.markets.get(marketId).commodityIds[0];
  world.markets[marketId].prices[instrumentId] = 0;
  const corrupted = structuredClone(world);
  assert.throws(() => advanceDay(world, c), new RegExp("DAY_INPUT required market price.*" + marketId));
  assert.deepEqual(world, corrupted);
});

test("schema-six saves gain an empty per-Mod state namespace during migration", async () => {
  const c = await catalog();
  const legacy = createWorld(c, { seed: "schema-six" });
  legacy.schemaVersion = 6;
  delete legacy.modState;
  const migrated = migrateWorldState(legacy);
  assert.equal(migrated.schemaVersion, 7);
  assert.deepEqual(migrated.modState, {});
  assert.equal(validateWorldState(migrated, c), true);
});

test("invalid or oversized saved Mod state is rejected at the load boundary", async () => {
  const c = await catalog();
  const world = createWorld(c, { seed: "bad-mod-state" });
  world.modState = { "example-market": { "Bad Key": 1 } };
  assert.throws(() => validateWorldState(world, c), /invalid Mod state keys/);

  const tooLarge = createWorld(c, { seed: "oversized-mod-state" });
  tooLarge.modState = { "example-market": { payload: "x".repeat(70 * 1024) } };
  assert.throws(() => validateWorldState(tooLarge, c), /exceeds the per-Mod limit/);
});


test("schema-six saves upgrade the legacy INI fingerprint when the enabled v4 Mod adds scripts", async () => {
  const c = await catalog();
  assert.notEqual(c.legacyContentHash, c.contentHash);
  const legacy = createWorld(c, { seed: "legacy-mod-fingerprint" });
  legacy.schemaVersion = 6;
  legacy.contentHash = c.legacyContentHash;
  delete legacy.modState;

  const migrated = migrateWorldState(legacy);
  assert.equal(migrated.schemaVersion, 7);
  assert.equal(migrated.contentHashUpgradePending, true);
  assert.equal(validateWorldState(migrated, c), true);
  assert.equal(migrated.contentHash, c.contentHash);
  assert.equal(Object.hasOwn(migrated, "contentHashUpgradePending"), false);
});

test("schema-seven saves still reject changed JavaScript Mod content", async () => {
  const c = await catalog();
  const world = createWorld(c, { seed: "strict-v4-fingerprint" });
  const changedCatalog = { ...c, contentHash: "changed-script-content-hash" };
  assert.throws(() => validateWorldState(world, changedCatalog), /different Mod content/);
});


test("campaign clock forwards elapsed game days into the simulation advance", async () => {
  const c = await catalog();
  const world = createWorld(c, { seed: "campaign-clock-integration" });
  let now = 0;
  const controller = new CampaignTimeController({
    baseDayDurationMs: 1000,
    now: () => now,
    onAdvance: (elapsedGameDays) => advanceCampaignTime(world, c, elapsedGameDays)
  });

  controller.setSpeed(4);
  now = 250;
  controller.tick();

  assert.equal(world.clock.day, 1);
  assert.equal(world.clock.dayFraction, 0);
});

test("catalog rejects negative daily population need rates",async()=>{
 const packages=await mods(),core=packages.find((item)=>item.id==="core");
 core.data.content["economy.ini"].commodities.find((item)=>item.id==="food").dailyNeedPerThousand=-.1;
 const result=compileCatalog(packages);
 assert.equal(result.ok,false);assert.match(result.error,/dailyNeedPerThousand/);
});

test("sub-mill population demand does not round or mutate untouched stockpiles",async()=>{
 const c=await catalog(),w=createWorld(c,{seed:"zero-population-demand"});
 const colonyId="new-dawn-colony";
 w.colonies[colonyId].population=1;
 w.colonies[colonyId].stockpiles.water=1.23456;
 w.colonies[colonyId].stockpiles.food=9.87654;
 advanceDay(w,c);
 assert.equal(w.colonies[colonyId].stockpiles.water,1.23456);
 assert.equal(w.colonies[colonyId].stockpiles.food,9.87654);
 assert.equal(w.colonies[colonyId].lastNeedsReport.shortageCount,0);
 assert.ok(w.colonies[colonyId].lastNeedsReport.needs.every((need)=>need.requested===0));
});
