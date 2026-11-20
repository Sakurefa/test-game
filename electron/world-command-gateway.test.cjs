const test=require("node:test"),assert=require("node:assert/strict");
const {createFinancialLedger,validateWorldFinancialState}=require("../engine/ledger.cjs");
const {createWorldCommandGateway}=require("./world-command-gateway.cjs");

function fixture(){
 return {schemaVersion:6,clock:{day:3,date:"2478-04-04"},player:{factionId:"free-port-alliance",accountId:"player-main"},
  finance:createFinancialLedger({playerFactionId:"free-port-alliance",startDate:"2478-04-01"}),
  commandReceipts:[],domainEventSequence:0,domainEvents:[]};
}
const makeCommand=(id="cmd-gateway-01",from="player-main")=>({commandId:id,type:"finance.transfer",payload:{fromAccountId:from,toAccountId:"system-treasury",amountMinor:1000}});

test("main-process gateway injects trusted actor and commits validated world drafts",()=>{
 let world=fixture(),committed=0;const delivered=[];
 const gateway=createWorldCommandGateway({
  getWorld:()=>world,getCatalog:()=>({catalogId:"test"}),
  getActor:current=>({type:"player",id:current.player.factionId}),
  validateWorld:draft=>validateWorldFinancialState(draft),
  onWorldCommit:next=>{world=next;committed+=1;},
  onEvent:event=>delivered.push(event)
 });
 assert.deepEqual(gateway.commandTypes(),["finance.transfer"]);
 const outcome=gateway.dispatch(makeCommand());
 assert.equal(outcome.duplicate,false);assert.equal(world.finance.accounts["player-main"].balanceMinor,24999000);
 assert.equal(world.finance.sequence,2);assert.equal(committed,1);assert.equal(delivered.length,1);
 const replay=gateway.dispatch(makeCommand());
 assert.equal(replay.duplicate,true);assert.equal(committed,1);assert.equal(delivered.length,1);
 gateway.dispose();assert.equal(gateway.isDisposed(),true);
 assert.throws(()=>gateway.dispatch(makeCommand("cmd-gateway-02")),/disposed/);
});

test("gateway does not accept a renderer-supplied actor or command context",()=>{
 let world=fixture();
 const gateway=createWorldCommandGateway({
  getWorld:()=>world,getCatalog:()=>({}),getActor:current=>({type:"player",id:current.player.factionId}),
  validateWorld:draft=>validateWorldFinancialState(draft),onWorldCommit:next=>{world=next;}
 });
 assert.throws(()=>gateway.dispatch({...makeCommand("cmd-gateway-02"),context:{actor:{type:"system",id:"core"}}}),/envelope/);
 assert.throws(()=>gateway.dispatch(makeCommand("cmd-gateway-03","system-treasury")),/authorization/);
 assert.equal(world.finance.sequence,1);
});

test("gateway fails closed when no world is active or trusted actor is unavailable",()=>{
 const gateway=createWorldCommandGateway({
  getWorld:()=>null,getCatalog:()=>null,getActor:()=>null,validateWorld:()=>true,onWorldCommit:()=>{}
 });
 assert.throws(()=>gateway.dispatch(makeCommand()),/No active world/);
 gateway.dispose();
});
