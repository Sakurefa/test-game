const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {readModPackages}=require("../electron/mod-loader.cjs");
const {createCalculationService,createDomainEventBus,compileCatalog,createWorld,advanceDay,advanceDays,validateWorldState}=require("../engine/index.cjs");
async function loadCatalog(){const mods=await readModPackages(path.join(__dirname,"..","mods"));const compiled=compileCatalog(mods);if(!compiled.ok)throw new Error(compiled.error);return compiled.catalog;}
test("colony production formula calculates expected throughput and stock constraints",()=>{
 const calculations=createCalculationService();
 const normal=calculations.evaluate("economy.colony-production",{level:3,stability:80,recipeInputs:[{commodityId:"water",quantity:2,available:5}],recipeOutputs:[{commodityId:"food",quantity:8}]},{day:7});
 assert.equal(normal.result.efficiency,0.8);assert.ok(Math.abs(normal.result.batchScale-2.4)<1e-10);
 assert.ok(Math.abs(normal.result.consumed.water-4.8)<1e-10);assert.ok(Math.abs(normal.result.produced.food-19.2)<1e-10);
 assert.equal(normal.record.version,1);assert.equal(normal.record.randomDraws.length,0);assert.ok(normal.record.steps.some(step=>step.id==="stability-efficiency"));
 const constrained=calculations.evaluate("economy.colony-production",{level:3,stability:80,recipeInputs:[{commodityId:"water",quantity:2,available:1}],recipeOutputs:[{commodityId:"food",quantity:8}]},{day:7});
 assert.equal(constrained.result.batchScale,0.5);assert.equal(constrained.result.limitingInput,"water");assert.equal(constrained.result.consumed.water,1);assert.equal(constrained.result.produced.food,4);
});
test("security quotes have bounded daily movement and absolute price corridor",()=>{
 const calculations=createCalculationService(),high={next:()=>0.999999};let price=100;
 for(let day=1;day<=40;day++){const {result}=calculations.evaluate("economy.security-price",{outputValue:1e6,volatility:1,previousPrice:price,initialPrice:100,maxDailyChange:0.12},{random:high,randomStreamId:"test.security",day});assert.ok(result.price<=price*1.12001);assert.ok(result.price>=price*0.999);assert.ok(result.price<=1000&&result.price>=10);assert.ok(result.change<=12);price=result.price;}
 assert.equal(price,1000);
 const low={next:()=>0.000001};price=100;
 for(let day=1;day<=40;day++){const {result}=calculations.evaluate("economy.security-price",{outputValue:0,volatility:1,previousPrice:price,initialPrice:100,maxDailyChange:0.12},{random:low,randomStreamId:"test.security-low",day});assert.ok(result.price>=price*0.87999);assert.ok(result.price<=price*1.001);assert.ok(result.price>=10&&result.price<=1000);price=result.price;}
 assert.equal(price,10);
});
test("commodity prices recover extreme prior quotes into a base-price corridor",()=>{
 const calculations=createCalculationService(),{result,record}=calculations.evaluate("economy.commodity-price",{basePrice:20,targetStock:100,stock:0,priceElasticity:1,volatility:1,previousPrice:1e6},{random:{next:()=>0.5},randomStreamId:"test.commodity",day:1});
 assert.ok(result.price>=2&&result.price<=200);assert.equal(record.version,2);assert.ok(record.modifiers.some(modifier=>modifier.id==="reference-price-corridor"));
});
test("weekly production records its calculations and cannot underflow stockpiles",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"production-audit"});world.colonies["verdant-colony"].stockpiles.water=0.25;advanceDays(world,catalog,7);
 const records=world.audit.calculations.filter(record=>record.formulaId==="economy.colony-production");
 assert.ok(records.length>=3);assert.ok(records.every(record=>record.day===7&&record.randomDraws.length===0));
 assert.ok(records.some(record=>record.result.limitingInput==="water"||record.result.batchScale===0));
 for(const colony of Object.values(world.colonies))for(const quantity of Object.values(colony.stockpiles))assert.ok(quantity>=0&&Number.isFinite(quantity));
 assert.equal(validateWorldState(world,catalog),true);
});
test("daily and weekly systems emit typed market, war and colony events",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"domain-event-economy"});advanceDay(world,catalog);
 assert.ok(world.domainEvents.some(event=>event.type==="market.prices-settled"));assert.ok(world.domainEvents.some(event=>event.type==="war.chronology-advanced"));
 const previousSequence=world.domainEventSequence;advanceDays(world,catalog,6);
 assert.ok(world.domainEvents.some(event=>event.type==="colony.production-settled"&&event.day===7));assert.ok(world.domainEventSequence>previousSequence);assert.equal(validateWorldState(world,catalog),true);
});
test("economic settlements and event history remain deterministic across save resumes",async()=>{
 const catalog=await loadCatalog(),options={seed:"deterministic-economy",createdAt:"2478-04-01T00:00:00.000Z"};
 const first=createWorld(catalog,options),second=createWorld(catalog,options);advanceDays(first,catalog,14);advanceDays(second,catalog,14);assert.deepEqual(first,second);
 const resumed=structuredClone(first);advanceDays(first,catalog,7);advanceDays(resumed,catalog,7);assert.deepEqual(first,resumed);
});
test("world validation rejects negative inventory and non-finite market quotes",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"invalid-state"});
 const badInventory=structuredClone(world);badInventory.colonies["new-dawn-colony"].stockpiles.ore=-1;assert.throws(()=>validateWorldState(badInventory,catalog),/invalid stockpile quantity/);
 const badQuote=structuredClone(world);badQuote.markets["new-dawn-market"].prices.ore=Number.POSITIVE_INFINITY;assert.throws(()=>validateWorldState(badQuote,catalog),/invalid market price/);
});

test("daily and weekly domain facts have one idempotent emission per entity and cadence",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"event-cadence"});
 const activeWars=Object.values(world.wars).filter(war=>war.status==="active");
 advanceDays(world,catalog,14);
 const keys=world.domainEvents.map(event=>event.idempotencyKey);
 assert.ok(keys.every(key=>typeof key==="string"&&key.length>0));
 assert.equal(new Set(keys).size,keys.length);
 for(const marketId of Object.keys(world.markets)){
  for(let day=1;day<=14;day++){
   assert.equal(world.domainEvents.filter(event=>event.type==="market.prices-settled"&&event.subjectId===marketId&&event.day===day).length,1);
  }
 }
 for(const war of activeWars){
  for(let day=1;day<=14;day++){
   assert.equal(world.domainEvents.filter(event=>event.type==="war.chronology-advanced"&&event.subjectId===war.id&&event.day===day).length,1);
  }
 }
 for(const colonyId of Object.keys(world.colonies)){
  for(const day of [7,14]){
   assert.equal(world.domainEvents.filter(event=>event.type==="colony.production-settled"&&event.subjectId===colonyId&&event.day===day).length,1);
  }
  assert.equal(world.domainEvents.filter(event=>event.type==="colony.production-settled"&&event.subjectId===colonyId).length,2);
 }
 assert.equal(validateWorldState(world,catalog),true);
});
test("campaign publishes committed domain events through an optional event bus",async()=>{
 const catalog=await loadCatalog(),world=createWorld(catalog,{seed:"event-bus-integration"});
 const bus=createDomainEventBus(),seen=[];
 bus.subscribe("*",event=>seen.push({sequence:event.sequence,type:event.type,frozen:Object.isFrozen(event)}));
 advanceDay(world,catalog,{eventBus:bus});
 assert.deepEqual(seen.map(event=>event.sequence),world.domainEvents.map(event=>event.sequence));
 assert.ok(seen.length>0&&seen.every(event=>event.frozen));
 const before=seen.length;
 advanceDay(world,catalog,{eventBus:bus});
 assert.ok(seen.length>before);
 assert.equal(world.domainEventSequence,seen.length);
});
