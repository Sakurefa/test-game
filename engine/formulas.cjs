const CALCULATION_AUDIT_LIMIT=200;
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function round(v,digits=3){const f=10**digits;return Math.round((v+Number.EPSILON)*f)/f;}
function cloneRecord(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function requireNumber(o,k,{min=-Infinity,max=Infinity,exclusiveMin=false}={}){
 const v=o[k];if(!Number.isFinite(v)||(exclusiveMin?v<=min:v<min)||v>max)throw new RangeError("Formula input "+k+" is outside its valid numeric range");return v;
}
function createTracingRandom(random,streamId,draws){
 if(!random||typeof random.next!=="function")throw new TypeError("A formula random stream must provide next()");
 return Object.freeze(Object.fromEntries(["next","nextUint32","int","range","chance","pick"].map(method=>[method,(...args)=>{
  if(typeof random[method]!=="function")throw new TypeError("Random stream does not support "+method+"()");
  const value=random[method](...args);draws.push({streamId,method,args:cloneRecord(args),value:cloneRecord(value)});return value;
 }])));
}
const DEFAULT_FORMULAS=Object.freeze([
 Object.freeze({id:"economy.colony-production",version:1,calculate:({inputs,recordStep,recordModifier})=>{
  const level=requireNumber(inputs,"level",{min:0,exclusiveMin:true,max:20}),stability=requireNumber(inputs,"stability",{min:0,max:100});
  if(!Array.isArray(inputs.recipeInputs)||!Array.isArray(inputs.recipeOutputs)||!inputs.recipeOutputs.length)throw new TypeError("Production formula requires recipeInputs and at least one recipeOutput");
  const efficiency=clamp(stability/100,.1,1),requestedBatches=level*efficiency,reqs=new Map();
  for(const item of inputs.recipeInputs){if(!item||typeof item.commodityId!=="string")throw new TypeError("Production inputs require commodity IDs");
   const q=requireNumber(item,"quantity",{min:0,exclusiveMin:true}),available=requireNumber(item,"available",{min:0}),prior=reqs.get(item.commodityId);
   reqs.set(item.commodityId,{quantity:(prior?.quantity||0)+q,available});}
  let batchScale=requestedBatches,limitingInput=null;
  for(const [id,r] of reqs){const possible=r.available/r.quantity;if(possible<batchScale){batchScale=possible;limitingInput=id;}}
  batchScale=Math.max(0,batchScale);const consumed={},produced={};
  for(const [id,r] of reqs)consumed[id]=r.quantity*batchScale;
  for(const item of inputs.recipeOutputs){if(!item||typeof item.commodityId!=="string")throw new TypeError("Production outputs require commodity IDs");
   const q=requireNumber(item,"quantity",{min:0,exclusiveMin:true});produced[item.commodityId]=(produced[item.commodityId]||0)+q*batchScale;}
  recordStep("stability-efficiency",efficiency,"Stability / 100, clamped to 10%–100%");
  recordStep("requested-batches",requestedBatches,"Industry level × stability efficiency");
  if(limitingInput)recordModifier("input-stock-limit",batchScale-requestedBatches,"Limited by available "+limitingInput);
  recordStep("batch-scale",batchScale);recordStep("consumed-inputs",consumed);recordStep("produced-outputs",produced);
  return {efficiency,requestedBatches,batchScale,limitingInput,consumed,produced};
 }}),
 Object.freeze({id:"economy.commodity-price",version:2,calculate:({inputs,random,recordStep,recordModifier})=>{
  const base=requireNumber(inputs,"basePrice",{min:0,exclusiveMin:true}),targetStock=requireNumber(inputs,"targetStock",{min:0,exclusiveMin:true});
  const stock=requireNumber(inputs,"stock",{min:0}),elasticity=requireNumber(inputs,"priceElasticity",{min:0,max:10}),volatility=requireNumber(inputs,"volatility",{min:0,max:1});
  const supplied=requireNumber(inputs,"previousPrice",{min:0,exclusiveMin:true}),floor=base*.1,ceiling=base*10,previous=clamp(supplied,floor,ceiling);
  if(previous!==supplied)recordModifier("reference-price-corridor",previous-supplied,"Previous quote corrected to 0.1×–10× base price");
  const scarcity=clamp((targetStock-stock)/targetStock,-1,1.5);recordStep("scarcity",scarcity);
  const fundamentals=base*clamp(1+scarcity*elasticity,.25,3.5);recordStep("fundamental-price",fundamentals);
  const noise=(random.next()-.5)*volatility;recordModifier("market-volatility",noise,"Seeded daily market variation");
  const rawTarget=fundamentals*(1+noise),target=clamp(rawTarget,floor,ceiling);
  if(target!==rawTarget)recordModifier("target-price-floor-or-ceiling",target-rawTarget,"Commodity reference corridor");
  recordStep("target-price",target);
  const price=round(clamp(previous+(target-previous)*.18,floor,ceiling)),change=round((price-previous)/previous*100,2);
  recordStep("final-price",price);return {price,change};
 }}),
 Object.freeze({id:"economy.security-price",version:2,calculate:({inputs,random,recordStep,recordModifier})=>{
  const initial=requireNumber(inputs,"initialPrice",{min:0,exclusiveMin:true}),supplied=requireNumber(inputs,"previousPrice",{min:0,exclusiveMin:true});
  const output=requireNumber(inputs,"outputValue",{min:0}),volatility=requireNumber(inputs,"volatility",{min:0,max:1}),maxMove=requireNumber(inputs,"maxDailyChange",{min:0,exclusiveMin:true,max:1});
  const floor=initial*.1,ceiling=initial*10,previous=clamp(supplied,floor,ceiling);
  if(previous!==supplied)recordModifier("reference-price-corridor",previous-supplied,"Previous quote corrected to 0.1×–10× initial price");
  const drift=clamp(output*.00001,0,.003);recordStep("operational-drift",drift,"Issuer output signal capped at +0.3% per day");
  const noise=(random.next()-.5)*volatility;recordModifier("market-volatility",noise,"Seeded daily market variation");
  const raw=noise+drift,move=clamp(raw,-maxMove,maxMove);
  if(move!==raw)recordModifier("daily-movement-limit",move-raw,"Daily movement limited to ±"+(maxMove*100)+"%");
  recordStep("daily-change",move);
  const rawPrice=previous*(1+move);
  const lowerQuote=Math.ceil((previous*(1-maxMove)-1e-9)*1000)/1000;
  const upperQuote=Math.floor((previous*(1+maxMove)+1e-9)*1000)/1000;
  const price=round(clamp(rawPrice,Math.max(floor,lowerQuote),Math.min(ceiling,upperQuote)));
  if(price!==round(rawPrice))recordModifier("reference-price-corridor",price-round(rawPrice),"Quote kept inside 0.1×–10× initial price");
  const change=round((price-previous)/previous*100,2);recordStep("final-price",price);return {price,change};
 }})
]);
function createCalculationService({definitions=DEFAULT_FORMULAS,historyLimit=CALCULATION_AUDIT_LIMIT}={}){
 if(!Array.isArray(definitions)||!definitions.length)throw new TypeError("At least one formula definition is required");
 if(!Number.isInteger(historyLimit)||historyLimit<1)throw new RangeError("Calculation audit history limit must be positive");
 const registry=new Map();for(const d of definitions){
  if(!d||typeof d.id!=="string"||!/^[a-z][a-z0-9._-]{1,95}$/.test(d.id)||!Number.isInteger(d.version)||d.version<1||typeof d.calculate!=="function")throw new TypeError("Formula definitions require stable ID, version and calculate");
  if(registry.has(d.id))throw new Error("Duplicate formula ID: "+d.id);registry.set(d.id,Object.freeze({...d}));
 }
 const records=[];
 function evaluate(id,inputs,context={}){
  const d=registry.get(id);if(!d)throw new Error("Unknown calculation formula: "+id);
  if(!inputs||typeof inputs!=="object"||Array.isArray(inputs))throw new TypeError("Formula inputs must be an object");
  const steps=[],modifiers=[],randomDraws=[],random=context.random?createTracingRandom(context.random,context.randomStreamId||"unscoped",randomDraws):null;
  const result=d.calculate({inputs:cloneRecord(inputs),random,recordStep:(id,value,detail="")=>steps.push({id:String(id),value:cloneRecord(value),detail:String(detail)}),recordModifier:(id,value,reason="")=>modifiers.push({id:String(id),value:cloneRecord(value),reason:String(reason)})});
  if(result&&typeof result.then==="function")throw new TypeError("Formula "+id+" must be synchronous");
  const record=Object.freeze({day:Number.isInteger(context.day)?context.day:null,formulaId:id,version:d.version,inputs:cloneRecord(inputs),modifiers,steps,randomDraws,result:cloneRecord(result)});
  records.push(record);if(records.length>historyLimit)records.splice(0,records.length-historyLimit);return {result,record};
 }
 return Object.freeze({evaluate,getDefinition:id=>{const d=registry.get(id);return d?{id:d.id,version:d.version}:null;},
  listDefinitions:()=>[...registry.values()].map(({id,version})=>({id,version})),getRecords:()=>records.map(cloneRecord),clear:()=>{records.length=0;},get size(){return records.length;}});
}
module.exports={CALCULATION_AUDIT_LIMIT,DEFAULT_FORMULAS,createCalculationService};
