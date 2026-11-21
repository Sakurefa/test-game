const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {readModPackages}=require("../electron/mod-loader.cjs");
const {SeededRandom,NamedRandomStreams,createCalculationService,addDays,compileCatalog,createWorld,advanceDay,advanceDays,advanceCampaignTime,migrateWorldState,validateWorldState}=require("../engine/index.cjs");
async function mods(){return readModPackages(path.join(__dirname,"..","mods"));}
async function catalog(){const r=compileCatalog(await mods());if(!r.ok)throw new Error(r.error);return r.catalog;}
test("game clock handles month boundaries and leap years",()=>{assert.equal(addDays("2478-04-30",1),"2478-05-01");assert.equal(addDays("2480-02-28",1),"2480-02-29");assert.equal(addDays("2480-02-28",2),"2480-03-01");assert.throws(()=>addDays("2480-02-30",1),/Invalid game date/);});
test("seeded random generator can be resumed",()=>{const a=new SeededRandom("frontier-test"),v=[a.next(),a.next(),a.next()],s=a.snapshot(),b=new SeededRandom(s.seed,s.state);assert.deepEqual([b.next(),b.next()],[a.next(),a.next()]);assert.notDeepEqual(v,[0,0,0]);});
test("Core and community Mod INI definitions compile",async()=>{const c=await catalog();assert.equal(c.universe.name,undefined);assert.equal(c.localizations["zh-CN"][c.universe.nameKey],"赫利俄斯边境");assert.equal(c.systems.size,4);assert.equal(c.colonies.size,3);assert.equal(c.fleets.size,2);assert.equal(c.wars.size,1);assert.ok(c.events.has("supply-rumor"));assert.ok(c.events.has("example-positive-news"));});
test("catalog rejects unresolved production references",async()=>{const m=await mods(),core=m.find(x=>x.id==="core");core.data.content["universe.ini"].colonies[0].industries[0].recipeId="missing-recipe";const r=compileCatalog(m);assert.equal(r.ok,false);assert.match(r.error,/industry recipe/);});
test("daily market and war systems run daily while colony production runs weekly",async()=>{const c=await catalog(),w=createWorld(c,{seed:42,createdAt:"2478-04-01T00:00:00.000Z"}),ore=w.colonies["new-dawn-colony"].stockpiles.ore,food=w.colonies["verdant-colony"].stockpiles.food,price=w.markets["verdant-exchange"].prices.food;advanceDay(w,c);assert.equal(w.clock.date,"2478-04-02");assert.equal(w.clock.day,1);assert.equal(w.colonies["new-dawn-colony"].stockpiles.ore,ore);assert.equal(w.colonies["verdant-colony"].stockpiles.food,food);assert.notEqual(w.markets["verdant-exchange"].prices.food,price);assert.equal(w.wars["cinder-conflict"].daysActive,16);assert.deepEqual(w.events.at(-1).systemsRun,["economy.market-pricing","military.war-chronology"]);for(let day=0;day<6;day++)advanceDay(w,c);assert.equal(w.clock.day,7);assert.ok(w.colonies["new-dawn-colony"].stockpiles.ore>ore);assert.ok(w.colonies["verdant-colony"].stockpiles.food>food);assert.deepEqual(w.events.at(-1).systemsRun,["colonies.production","economy.market-pricing","military.war-chronology"]);});
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
