const test=require("node:test"),assert=require("node:assert/strict");
const {MAX_COMMAND_RECEIPTS,createCommandDispatcher,validateCommandReceiptState}=require("../engine/commands.cjs");
const {createDomainEventBus,createWorldCommandRuntime}=require("../engine/index.cjs");
const worldFixture=()=>({schemaVersion:5,clock:{day:12},counter:5,commandReceipts:[]});
function createDispatcher(options={}){
 return createCommandDispatcher([{
  id:"player.counter.increment",
  validate:({payload})=>Number.isInteger(payload.amount)&&payload.amount>0?true:"Amount must be a positive integer",
  authorize:({context})=>context?.canControlWorld===true,
  execute:({world,payload})=>{
   world.counter+=payload.amount;
   return {result:{counter:world.counter},events:[{type:"player.counter-incremented",scope:"world",payload:{amount:payload.amount,counter:world.counter}}]};
  }
 }],options);
}
const command=(commandId="cmd-00000001",payload={amount:2})=>({commandId,type:"player.counter.increment",payload});

test("commands validate before executing and commit an isolated world draft",()=>{
 const original=worldFixture(),dispatcher=createDispatcher({validateWorld:draft=>Number.isInteger(draft.counter)&&draft.counter>=0});
 const outcome=dispatcher.dispatch({world:original,command:command(),context:{canControlWorld:true}});
 assert.notEqual(outcome.world,original);assert.equal(original.counter,5);assert.equal(outcome.world.counter,7);
 assert.deepEqual(outcome.result,{counter:7});assert.equal(outcome.duplicate,false);
 assert.equal(outcome.events.length,1);assert.equal(outcome.events[0].idempotencyKey,"command:cmd-00000001:0");
 assert.equal(outcome.world.commandReceipts.length,1);assert.equal(validateCommandReceiptState(outcome.world),true);
});

test("replayed command IDs return the original result without applying state or events twice",()=>{
 const dispatcher=createDispatcher(),first=dispatcher.dispatch({world:worldFixture(),command:command(),context:{canControlWorld:true}});
 const reordered=dispatcher.dispatch({world:first.world,command:command("cmd-00000001",{amount:2}),context:{canControlWorld:true}});
 assert.equal(reordered.world,first.world);assert.equal(reordered.world.counter,7);assert.deepEqual(reordered.result,first.result);
 assert.equal(reordered.duplicate,true);assert.deepEqual(reordered.events,[]);
});

test("reusing a command ID for different intent is rejected",()=>{
 const dispatcher=createDispatcher(),first=dispatcher.dispatch({world:worldFixture(),command:command(),context:{canControlWorld:true}});
 assert.throws(()=>dispatcher.dispatch({world:first.world,command:command("cmd-00000001",{amount:3}),context:{canControlWorld:true}}),/already used for a different command/);
});

test("invalid and unauthorized commands leave the authoritative world untouched",()=>{
 const dispatcher=createDispatcher(),original=worldFixture();
 assert.throws(()=>dispatcher.dispatch({world:original,command:command("cmd-00000002",{amount:0}),context:{canControlWorld:true}}),/positive integer/);
 assert.throws(()=>dispatcher.dispatch({world:original,command:command(),context:{canControlWorld:false}}),/authorization/);
 assert.equal(original.counter,5);assert.deepEqual(original.commandReceipts,[]);
});

test("handler and post-transition validation failures cannot partially mutate the input world",()=>{
 const original=worldFixture();
 const failing=createCommandDispatcher([{
  id:"player.counter.increment",validate:()=>true,
  execute:({world})=>{world.counter=999;throw new Error("handler failed");}
 }]);
 assert.throws(()=>failing.dispatch({world:original,command:command(),context:{}}),/handler failed/);
 const invalidWorld=createDispatcher({validateWorld:()=>false});
 assert.throws(()=>invalidWorld.dispatch({world:original,command:command(),context:{canControlWorld:true}}),/invalid world state/);
 assert.equal(original.counter,5);assert.deepEqual(original.commandReceipts,[]);
});

test("command handlers must be synchronous and command envelopes must be bounded JSON data",()=>{
 const asyncDispatcher=createCommandDispatcher([{id:"player.counter.increment",validate:()=>true,execute:async()=>({result:null,events:[]})}]);
 assert.throws(()=>asyncDispatcher.dispatch({world:worldFixture(),command:command(),context:{}}),/must be synchronous/);
 const dispatcher=createDispatcher();
 assert.throws(()=>dispatcher.dispatch({world:worldFixture(),command:command("cmd-00000003",{amount:Number.NaN}),context:{canControlWorld:true}}),/finite/);
 assert.throws(()=>dispatcher.dispatch({world:worldFixture(),command:{...command(),extra:true},context:{canControlWorld:true}}),/envelope/);
});

test("command receipts are bounded and validated before persistence",()=>{
 const world=worldFixture();world.commandReceipts=Array.from({length:MAX_COMMAND_RECEIPTS+1},(_,index)=>({commandId:"cmd-"+String(index).padStart(8,"0"),type:"player.counter.increment",signature:"signature",day:1,result:null}));
 assert.throws(()=>validateCommandReceiptState(world),/invalid command receipt history/);
 world.commandReceipts=[{commandId:"cmd-00000001",type:"player.counter.increment",signature:"signature",day:1,result:null},{commandId:"cmd-00000001",type:"player.counter.increment",signature:"signature",day:1,result:null}];
 assert.throws(()=>validateCommandReceiptState(world),/invalid command receipt/);
});

test("command receipt records are protected from business handler mutation",()=>{
 const world=worldFixture();
 const dispatcher=createCommandDispatcher([{
  id:"player.counter.increment",validate:()=>true,
  execute:({world})=>{world.counter+=1;world.commandReceipts.push({commandId:"cmd-forged00",type:"player.counter.increment",signature:"forged",day:1,result:null});return {result:world.counter,events:[]};}
 }]);
 assert.throws(()=>dispatcher.dispatch({world,command:command(),context:{}}),/cannot modify command receipts/);
 assert.equal(world.counter,5);assert.deepEqual(world.commandReceipts,[]);
});

test("world command runtime commits state, receipt, domain history and bus delivery together",()=>{
 const world={...worldFixture(),clock:{day:12,date:"2478-04-13"},domainEventSequence:0,domainEvents:[]};
 const dispatcher=createCommandDispatcher([{
  id:"player.account.withdraw",validate:({payload,world})=>Number.isFinite(payload.amount)&&payload.amount>0&&payload.amount<=world.counter?true:"Invalid withdrawal amount",
  execute:({world,payload})=>{world.counter-=payload.amount;return {result:{balance:world.counter},events:[{type:"player.account-withdrawn",scope:"world",payload:{amount:payload.amount,balance:world.counter}}]};}
 }]);
 const bus=createDomainEventBus(),seen=[];
 bus.subscribe("player.account-withdrawn",event=>seen.push(event));
 const runtime=createWorldCommandRuntime({dispatcher,eventBus:bus});
 const first=runtime.dispatch({world,command:{commandId:"cmd-withdraw-001",type:"player.account.withdraw",payload:{amount:2}}});
 assert.equal(first.world.counter,3);assert.equal(first.world.commandReceipts.length,1);
 assert.equal(first.world.domainEventSequence,1);assert.equal(first.world.domainEvents.length,1);
 assert.deepEqual(first.events,first.world.domainEvents);assert.equal(seen.length,1);
 const replay=runtime.dispatch({world:first.world,command:{commandId:"cmd-withdraw-001",type:"player.account.withdraw",payload:{amount:2}}});
 assert.equal(replay.duplicate,true);assert.equal(replay.world,first.world);assert.deepEqual(replay.events,[]);
 assert.equal(seen.length,1);assert.equal(first.world.domainEventSequence,1);
});

test("world command runtime rolls back the draft when event persistence conflicts",()=>{
 const world={...worldFixture(),clock:{day:12,date:"2478-04-13"},domainEventSequence:1,domainEvents:[
  {id:"domain-1",sequence:1,day:12,date:"2478-04-13",type:"player.account-withdrawn",scope:"world",subjectId:null,idempotencyKey:"command:cmd-withdraw-002:0",payload:{amount:99}}
 ]};
 const dispatcher=createCommandDispatcher([{
  id:"player.account.withdraw",validate:()=>true,
  execute:({world,payload})=>{world.counter-=payload.amount;return {result:{balance:world.counter},events:[{type:"player.account-withdrawn",scope:"world",payload:{amount:payload.amount,balance:world.counter}}]};}
 }]);
 const runtime=createWorldCommandRuntime({dispatcher});
 assert.throws(()=>runtime.dispatch({world,command:{commandId:"cmd-withdraw-002",type:"player.account.withdraw",payload:{amount:2}}}),/idempotency key conflict/);
 assert.equal(world.counter,5);assert.deepEqual(world.commandReceipts,[]);assert.equal(world.domainEventSequence,1);
});
