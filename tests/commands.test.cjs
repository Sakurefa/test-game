const test=require("node:test"),assert=require("node:assert/strict");
const {MAX_COMMAND_RECEIPTS,createCommandDispatcher,validateCommandReceiptState}=require("../engine/commands.cjs");
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
