"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {readModPackages}=require("../electron/mod-loader.cjs");
const {createCalculationService,createDomainEventBus,compileCatalog,createWorld,advanceDay,advanceDays,validateWorldState}=require("../engine/index.cjs");
const {createModExtensionRuntime}=require("../engine/mod-runtime.cjs");

async function loadCatalog(){
 const mods=await readModPackages(path.join(__dirname,"..","mods"));
 const compiled=compileCatalog(mods);
 if(!compiled.ok)throw new Error(compiled.error);
 return compiled.catalog;
}
function calculationsFor(catalog){
 return createCalculationService({definitions:createModExtensionRuntime(catalog.extensions).formulaDefinitions()});
}
function productionInputs(available){
 return {
  level:3,stability:80,minimumEfficiency:.1,maximumEfficiency:1,
  stabilityScale:100,maximumIndustryLevel:20,
  recipeInputs:[{commodityId:"water",quantity:2,available}],
  recipeOutputs:[{commodityId:"food",quantity:8}]
 };
}
function commodityInputs(previousPrice){
 return {
  basePrice:20,targetStock:100,stock:0,priceElasticity:1,volatility:1,
  previousPrice,minimumPriceMultiplier:.1,maximumPriceMultiplier:10,
  scarcityMinimum:-1,scarcityMaximum:1.5,
  fundamentalMinimumMultiplier:.25,fundamentalMaximumMultiplier:3.5,
  priceAdjustmentRate:.18
 };
}
function securityInputs(previousPrice,outputValue){
 return {
  outputValue,volatility:1,previousPrice,initialPrice:100,
  maximumDailyChange:.12,minimumPriceMultiplier:.1,maximumPriceMultiplier:10,
  outputDriftPerUnit:.00001,maximumOutputDrift:.003
 };
}

test("Mod-defined production formula calculates expected throughput and stock constraints",async()=>{
 const catalog=await loadCatalog(),calculations=calculationsFor(catalog);
 const normal=calculations.evaluate("economy.colony-production",productionInputs(5),{day:7});
 assert.equal(normal.result.efficiency,.8);assert.ok(Math.abs(normal.result.batchScale-2.4)<1e-10);
 assert.ok(Math.abs(normal.result.consumed.water-4.8)<1e-10);assert.ok(Math.abs(normal.result.produced.food-19.2)<1e-10);
 assert.equal(normal.record.version,1);assert.equal(normal.record.randomDraws.length,0);
 assert.ok(normal.record.steps.some(step=>step.id==="stability-efficiency"));
 const constrained=calculations.evaluate("economy.colony-production",productionInputs(1),{day:7});
 assert.equal(constrained.result.batchScale,.5);assert.equal(constrained.result.limitingInput,"water");
 assert.equal(constrained.result.consumed.water,1);assert.equal(constrained.result.produced.food,4);
});

test("Mod-defined security formula applies declared movement and price limits",async()=>{
 const calculations=calculationsFor(await loadCatalog());
 let price=100;
 for(let day=1;day<=40;day++){
  const {result}=calculations.evaluate("economy.security-price",securityInputs(price,1e6),{day,randomStreamId:"test.security"});
  assert.ok(result.price<=price*1.12001);assert.ok(result.price>=price*.87999);
  assert.ok(result.price<=1000&&result.price>=10);assert.ok(Math.abs(result.change)<=12.001);price=result.price;
 }
 assert.ok(price<=1000&&price>=10);
});

test("Mod-defined commodity formula enforces the configured price corridor",async()=>{
 const calculations=calculationsFor(await loadCatalog());
 const {result,record}=calculations.evaluate("economy.commodity-price",commodityInputs(1e6),{
  randomStreamId:"test.commodity",random:{next:()=>0.25},day:1
 });
 assert.ok(result.price>=2&&result.price<=200);
 assert.equal(record.version,3);
 assert.ok(record.modifiers.some(modifier=>modifier.id==="market-volatility"));
 assert.equal(record.randomDraws.length,1);
});

test("weekly Core Mod production records calculations and cannot underflow stockpiles",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"production-audit"});
 world.colonies["verdant-colony"].stockpiles.water=.25;
 advanceDays(world,catalog,7);
 const records=world.audit.calculations.filter(record=>record.formulaId==="economy.colony-production");
 assert.ok(records.length>=3);assert.ok(records.every(record=>record.day===7&&record.randomDraws.length===0));
 assert.ok(records.some(record=>record.result.limitingInput==="water"||record.result.batchScale===0));
 for(const colony of Object.values(world.colonies))for(const quantity of Object.values(colony.stockpiles))assert.ok(quantity>=0&&Number.isFinite(quantity));
 assert.equal(validateWorldState(world,catalog),true);
});

test("Core Mod recurring systems emit scoped market, war and colony facts",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"domain-event-economy"});
 advanceDay(world,catalog);
 assert.ok(world.domainEvents.some(event=>event.type==="mod.core.market.prices-settled"&&event.scope==="market"));
 assert.ok(world.domainEvents.some(event=>event.type==="mod.core.war.chronology-advanced"&&event.scope==="war"));
 const previousSequence=world.domainEventSequence;
 advanceDays(world,catalog,6);
 assert.ok(world.domainEvents.some(event=>event.type==="mod.core.colony.production-settled"&&event.day===7&&event.scope==="colony"));
 assert.ok(world.domainEventSequence>previousSequence);assert.equal(validateWorldState(world,catalog),true);
});

test("economic settlements and event history remain deterministic across save resumes",async()=>{
 const catalog=await loadCatalog(),options={seed:"deterministic-economy",createdAt:"2478-04-01T00:00:00.000Z"};
 const first=createWorld(catalog,options),second=createWorld(catalog,options);
 advanceDays(first,catalog,14);advanceDays(second,catalog,14);assert.deepEqual(first,second);
 const resumed=structuredClone(first);advanceDays(first,catalog,7);advanceDays(resumed,catalog,7);assert.deepEqual(first,resumed);
});

test("world validation rejects negative inventory and non-finite market quotes",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"invalid-state"});
 const badInventory=structuredClone(world);badInventory.colonies["new-dawn-colony"].stockpiles.ore=-1;
 assert.throws(()=>validateWorldState(badInventory,catalog),/invalid stockpile quantity/);
 const badQuote=structuredClone(world);badQuote.markets["new-dawn-market"].prices.ore=Number.POSITIVE_INFINITY;
 assert.throws(()=>validateWorldState(badQuote,catalog),/invalid market price/);
});

test("daily and weekly domain facts are idempotent within the bounded event-history window",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"event-cadence"});
 const activeWars=Object.values(world.wars).filter(war=>war.status==="active");
 const assertUniqueKeys=()=>{
  const keys=world.domainEvents.map(event=>event.idempotencyKey);
  assert.ok(keys.every(key=>typeof key==="string"&&key.length>0));
  assert.equal(new Set(keys).size,keys.length);
 };
 const assertDailyFacts=(events,startDay,endDay)=>{
  for(const marketId of Object.keys(world.markets)){
   for(let day=startDay;day<=endDay;day++){
    assert.equal(events.filter(event=>event.type==="mod.core.market.prices-settled"&&event.subjectId===marketId&&event.day===day).length,1);
   }
  }
  for(const war of activeWars){
   for(let day=startDay;day<=endDay;day++){
    assert.equal(events.filter(event=>event.type==="mod.core.war.chronology-advanced"&&event.subjectId===war.id&&event.day===day).length,1);
   }
  }
 };
 advanceDays(world,catalog,7);
 const firstWeekEvents=structuredClone(world.domainEvents);
 assertDailyFacts(firstWeekEvents,1,7);
 for(const colonyId of Object.keys(world.colonies)){
  assert.equal(firstWeekEvents.filter(event=>event.type==="mod.core.colony.production-settled"&&event.subjectId===colonyId&&event.day===7).length,1);
 }
 assertUniqueKeys();

 advanceDays(world,catalog,7);
 assertDailyFacts(world.domainEvents,8,14);
 for(const colonyId of Object.keys(world.colonies)){
  assert.equal(world.domainEvents.filter(event=>event.type==="mod.core.colony.production-settled"&&event.subjectId===colonyId&&event.day===14).length,1);
 }
 assertUniqueKeys();
 assert.equal(validateWorldState(world,catalog),true);
});

test("campaign publishes committed Mod domain events through an optional event bus",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"event-bus-integration"});
 const bus=createDomainEventBus(),seen=[];
 bus.subscribe("*",event=>seen.push({sequence:event.sequence,type:event.type,frozen:Object.isFrozen(event)}));
 advanceDay(world,catalog,{eventBus:bus});
 assert.deepEqual(seen.map(event=>event.sequence),world.domainEvents.map(event=>event.sequence));
 assert.ok(seen.length>0&&seen.every(event=>event.frozen));
 const before=seen.length;advanceDay(world,catalog,{eventBus:bus});
 assert.ok(seen.length>before);assert.equal(world.domainEventSequence,seen.length);
});
