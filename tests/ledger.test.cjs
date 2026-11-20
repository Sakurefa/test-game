const test=require("node:test"),assert=require("node:assert/strict");
const {
 createFinancialLedger,validateFinancialLedger,createLedgerCurrency,createLedgerAccount,recordBalancedTransaction,getAccountBalance,createTransferCommand,
 validateWorldFinancialState
}=require("../engine/ledger.cjs");
const {createCommandDispatcher}=require("../engine/commands.cjs");
const {createWorldCommandRuntime}=require("../engine/command-runtime.cjs");
const {createDomainEventBus}=require("../engine/event-bus.cjs");

function createWorld(startingBalanceMinor=25000000){
 return {
  schemaVersion:6,clock:{day:4,date:"2478-04-05"},player:{factionId:"free-port-alliance",accountId:"player-main"},
  finance:createFinancialLedger({playerFactionId:"free-port-alliance",startDate:"2478-04-01",startingBalanceMinor}),
  commandReceipts:[],domainEventSequence:0,domainEvents:[]
 };
}
const transfer=(commandId="cmd-transfer-001",amountMinor=1250)=>({
 commandId,type:"finance.transfer",payload:{fromAccountId:"player-main",toAccountId:"system-treasury",amountMinor}
});
function createFinanceRuntime(world,seen=[]){
 const bus=createDomainEventBus();
 bus.subscribe("finance.transfer-settled",event=>seen.push(event));
 const dispatcher=createCommandDispatcher([createTransferCommand()],{validateWorld:draft=>validateWorldFinancialState(draft)});
 return createWorldCommandRuntime({dispatcher,eventBus:bus});
}

test("financial ledger starts with balanced opening capital and integer minor units",()=>{
 const world=createWorld();
 assert.equal(getAccountBalance(world.finance,"player-main"),25000000);
 assert.equal(getAccountBalance(world.finance,"system-treasury"),-25000000);
 assert.equal(world.finance.sequence,1);
 assert.equal(world.finance.transactions[0].type,"finance.opening-capital");
 assert.equal(validateFinancialLedger(world.finance),true);
 const empty=createFinancialLedger({playerFactionId:"free-port-alliance",startDate:"2478-04-01",startingBalanceMinor:0});
 assert.equal(empty.sequence,0);assert.equal(empty.transactions.length,0);assert.equal(validateFinancialLedger(empty),true);
});

test("balanced transactions update both accounts and return a detached history fact",()=>{
 const world=createWorld();
 const transaction=recordBalancedTransaction(world.finance,{
  day:4,date:"2478-04-05",type:"finance.transfer-settled",commandId:"cmd-transfer-0001",
  entries:[{accountId:"player-main",deltaMinor:-12345},{accountId:"system-treasury",deltaMinor:12345}]
 });
 assert.equal(transaction.id,"ledger-2");assert.equal(transaction.sequence,2);
 assert.equal(world.finance.accounts["player-main"].balanceMinor,24987655);
 assert.equal(world.finance.accounts["system-treasury"].balanceMinor,-24987655);
 assert.equal(validateFinancialLedger(world.finance),true);
});

test("ledger rejects unbalanced, duplicate, unknown, zero and unsafe entries without partial mutation",()=>{
 const world=createWorld(),before=structuredClone(world.finance);
 assert.throws(()=>recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.bad",entries:[
  {accountId:"player-main",deltaMinor:-100},{accountId:"system-treasury",deltaMinor:99}
 ]}),/not balanced/);
 assert.deepEqual(world.finance,before);
 assert.throws(()=>recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.bad",entries:[
  {accountId:"player-main",deltaMinor:-100},{accountId:"player-main",deltaMinor:100}
 ]}),/repeated ledger entry/);
 assert.throws(()=>recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.bad",entries:[
  {accountId:"missing-account",deltaMinor:-100},{accountId:"system-treasury",deltaMinor:100}
 ]}),/Invalid or repeated/);
 assert.throws(()=>recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.bad",entries:[
  {accountId:"player-main",deltaMinor:0},{accountId:"system-treasury",deltaMinor:0}
 ]}),/Invalid or repeated/);
 assert.deepEqual(world.finance,before);
});

test("ledger command IDs are unique and overdraft limits are enforced atomically",()=>{
 const world=createWorld();
 recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.transfer-settled",commandId:"cmd-transfer-0002",entries:[
  {accountId:"player-main",deltaMinor:-100},{accountId:"system-treasury",deltaMinor:100}
 ]});
 const before=structuredClone(world.finance);
 assert.throws(()=>recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.transfer-settled",commandId:"cmd-transfer-0002",entries:[
  {accountId:"player-main",deltaMinor:-100},{accountId:"system-treasury",deltaMinor:100}
 ]}),/already been committed/);
 assert.throws(()=>recordBalancedTransaction(world.finance,{day:4,date:"2478-04-05",type:"finance.transfer-settled",commandId:"cmd-transfer-0003",entries:[
  {accountId:"player-main",deltaMinor:-999999999},{accountId:"system-treasury",deltaMinor:999999999}
 ]}),/Insufficient funds/);
 assert.deepEqual(world.finance,before);
});

test("ledger validation detects tampered balances, unbalanced history and duplicate command IDs",()=>{
 const world=createWorld(),tampered=structuredClone(world.finance);
 tampered.accounts["player-main"].balanceMinor+=1;
 assert.throws(()=>validateFinancialLedger(tampered),/does not match its ledger/);
 const unbalanced=structuredClone(world.finance);
 unbalanced.transactions[0].entries[0].deltaMinor+=1;
 assert.throws(()=>validateFinancialLedger(unbalanced),/not balanced/);
 const duplicate=structuredClone(world.finance);
 duplicate.sequence=2;
 duplicate.transactions.push({...duplicate.transactions[0],id:"ledger-2",sequence:2,commandId:"cmd-duplicate1"});
 duplicate.transactions[0].commandId="cmd-duplicate1";
 assert.throws(()=>validateFinancialLedger(duplicate),/duplicate ledger command IDs/);
});

test("transfer command validates player ownership and is retry-safe through the world runtime",()=>{
 const world=createWorld(),seen=[],runtime=createFinanceRuntime(world,seen);
 const first=runtime.dispatch({world,command:transfer(),context:{actor:{type:"player",id:"free-port-alliance"}}});
 assert.equal(first.world.finance.accounts["player-main"].balanceMinor,24998750);
 assert.equal(first.world.finance.accounts["system-treasury"].balanceMinor,-24998750);
 assert.equal(first.world.finance.sequence,2);assert.equal(first.world.domainEventSequence,1);
 assert.equal(first.events[0].type,"finance.transfer-settled");assert.equal(seen.length,1);
 const replay=runtime.dispatch({world:first.world,command:transfer(),context:{actor:{type:"player",id:"free-port-alliance"}}});
 assert.equal(replay.duplicate,true);assert.equal(replay.world.finance.sequence,2);assert.equal(replay.world.domainEventSequence,1);assert.equal(seen.length,1);
 assert.equal(validateWorldFinancialState(first.world),true);
});

test("transfer command rejects forged actors, insufficient funds and cross-currency movement",()=>{
 const world=createWorld(),dispatcher=createCommandDispatcher([createTransferCommand()]);
 const command=transfer("cmd-transfer-0002",100);
 assert.throws(()=>dispatcher.dispatch({world,command,context:{actor:{type:"system",id:"core"}}}),/authorization/);
 assert.throws(()=>dispatcher.dispatch({world,command:transfer("cmd-transfer-0003",999999999),context:{actor:{type:"player",id:"free-port-alliance"}}}),/Insufficient funds/);
 world.finance.currencies.EUR={id:"EUR",minorUnitDigits:2};
 world.finance.accounts["euro-account"]={id:"euro-account",owner:{type:"company",id:"frontier-industries"},currency:"EUR",balanceMinor:0,overdraftLimitMinor:0,allowNegative:false,status:"open",positions:{}};
 assert.equal(validateFinancialLedger(world.finance),true);
 const cross={...transfer("cmd-transfer-0004",100),payload:{...transfer().payload,toAccountId:"euro-account"}};
 assert.throws(()=>dispatcher.dispatch({world,command:cross,context:{actor:{type:"player",id:"free-port-alliance"}}}),/Cross-currency transfers/);
 assert.equal(world.finance.sequence,1);
});

test("player finance validation binds the canonical account to the player's faction",()=>{
 const world=createWorld();
 assert.equal(validateWorldFinancialState(world),true);
 world.player.factionId="different-faction";
 assert.throws(()=>validateWorldFinancialState(world),/does not match player ownership/);
});

test("ledger can register owned accounts and currencies without bypassing balanced funding",()=>{
 const ledger=createFinancialLedger({playerFactionId:"free-port-alliance",startDate:"2478-04-01"});
 const company=createLedgerAccount(ledger,{id:"frontier-industries-main",owner:{type:"company",id:"frontier-industries"}});
 assert.equal(company.balanceMinor,0);
 assert.throws(()=>createLedgerAccount(ledger,{id:"frontier-industries-main",owner:{type:"company",id:"frontier-industries"}}),/already exists/);
 assert.throws(()=>createLedgerAccount(ledger,{id:"constructor",owner:{type:"company",id:"frontier-industries"}}),/non-reserved/);
 assert.equal(validateFinancialLedger(ledger),true);
 recordBalancedTransaction(ledger,{day:0,date:"2478-04-01",type:"finance.company-capitalized",entries:[
  {accountId:"system-treasury",deltaMinor:-500000},
  {accountId:"frontier-industries-main",deltaMinor:500000}
 ]});
 assert.equal(getAccountBalance(ledger,"frontier-industries-main"),500000);
 const eur=createLedgerCurrency(ledger,{id:"EUR",minorUnitDigits:2});
 assert.equal(eur.minorUnitDigits,2);
 assert.throws(()=>createLedgerCurrency(ledger,{id:"EUR"}),/already exists/);
 createLedgerAccount(ledger,{id:"eur-clearing",owner:{type:"system",id:"eur-clearing"},currency:"EUR",allowNegative:true});
 createLedgerAccount(ledger,{id:"eur-company",owner:{type:"company",id:"frontier-industries"},currency:"EUR"});
 recordBalancedTransaction(ledger,{day:0,date:"2478-04-01",type:"finance.foreign-capitalized",entries:[
  {accountId:"eur-clearing",deltaMinor:-2500},
  {accountId:"eur-company",deltaMinor:2500}
 ]});
 assert.equal(getAccountBalance(ledger,"eur-company"),2500);
 assert.equal(validateFinancialLedger(ledger),true);
});
