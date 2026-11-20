const MAX_FINANCIAL_TRANSACTIONS=50000;
const MAX_TRANSACTION_ENTRIES=32;
const ACCOUNT_ID_PATTERN=/^[a-z][a-z0-9._-]{1,63}$/;
const OWNER_TYPE_PATTERN=/^(player|faction|company|colony|system)$/;
const CURRENCY_PATTERN=/^[A-Z][A-Z0-9]{1,7}$/;
const TRANSACTION_TYPE_PATTERN=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const COMMAND_ID_PATTERN=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,95}$/;
const RESERVED_ACCOUNT_IDS=new Set(["constructor","prototype","__proto__","tostring","valueof","hasownproperty"]);

function isRecord(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function assertIdentifier(value,pattern,label){
 if(typeof value!=="string"||!pattern.test(value))throw new TypeError(label+" must be a stable identifier");
}
function createFinancialLedger({playerFactionId,startDate,openingDay=0,startingBalanceMinor=25000000,positions={}}={}){
 assertIdentifier(playerFactionId,/^[a-z0-9][a-z0-9._-]{1,63}$/,"Player faction ID");
 if(typeof startDate!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(startDate))throw new TypeError("A valid ledger start date is required");
 if(!Number.isInteger(openingDay)||openingDay<0)throw new RangeError("Opening ledger day must be a non-negative integer");
 if(!Number.isSafeInteger(startingBalanceMinor)||startingBalanceMinor<0)throw new RangeError("Starting balance must be a non-negative safe integer in minor units");
 if(!isRecord(positions))throw new TypeError("Legacy positions must be an object");
 const ledger={
  currencies:{CR:{id:"CR",minorUnitDigits:2}},
  accounts:{
   "player-main":{id:"player-main",owner:{type:"player",id:playerFactionId},currency:"CR",balanceMinor:startingBalanceMinor,overdraftLimitMinor:0,allowNegative:false,status:"open",positions:structuredClone(positions)},
   "system-treasury":{id:"system-treasury",owner:{type:"system",id:"core"},currency:"CR",balanceMinor:-startingBalanceMinor,overdraftLimitMinor:0,allowNegative:true,status:"open",positions:{}}
  },
  sequence:startingBalanceMinor>0?1:0,
  transactions:startingBalanceMinor>0?[{
   id:"ledger-1",sequence:1,day:openingDay,date:startDate,type:"finance.opening-capital",commandId:null,reference:"world-genesis",
   entries:[{accountId:"player-main",deltaMinor:startingBalanceMinor},{accountId:"system-treasury",deltaMinor:-startingBalanceMinor}]
  }]:[]
 };
 validateFinancialLedger(ledger);
 return ledger;
}
function validateFinancialLedger(ledger) {
  if (!isRecord(ledger) || !isRecord(ledger.currencies) || !isRecord(ledger.accounts)
    || !Number.isInteger(ledger.sequence) || ledger.sequence < 0) throw new Error("Save has an invalid financial ledger header");
  for (const [id, currency] of Object.entries(ledger.currencies)) {
    if (id !== currency?.id || !CURRENCY_PATTERN.test(id)
      || !Number.isInteger(currency.minorUnitDigits) || currency.minorUnitDigits < 0 || currency.minorUnitDigits > 6) {
      throw new Error("Save has an invalid financial currency definition: " + id);
    }
  }
  for (const [id, account] of Object.entries(ledger.accounts)) {
    if (!isRecord(account) || id !== account.id || !ACCOUNT_ID_PATTERN.test(id) || RESERVED_ACCOUNT_IDS.has(id)
      || !isRecord(account.owner) || !OWNER_TYPE_PATTERN.test(account.owner.type)
      || typeof account.owner.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(account.owner.id)
      || !Object.hasOwn(ledger.currencies, account.currency) || !Number.isSafeInteger(account.balanceMinor)
      || !Number.isSafeInteger(account.overdraftLimitMinor) || account.overdraftLimitMinor < 0
      || typeof account.allowNegative !== "boolean" || !["open", "closed"].includes(account.status)
      || !isRecord(account.positions)) throw new Error("Save contains an invalid financial account: " + id);
    if (!account.allowNegative && account.balanceMinor < -account.overdraftLimitMinor) {
      throw new Error("Financial account exceeds its overdraft limit: " + id);
    }
  }
  return true;
}
function createLedgerCurrency(ledger, { id, minorUnitDigits = 2 } = {}) {
  if (typeof id !== "string" || !CURRENCY_PATTERN.test(id)) throw new TypeError("Currency requires a stable uppercase code");
  if (!Number.isInteger(minorUnitDigits) || minorUnitDigits < 0 || minorUnitDigits > 6) throw new RangeError("Currency minor digits must be an integer from 0 to 6");
  if (Object.hasOwn(ledger.currencies, id)) throw new Error("Currency already exists: " + id);
  ledger.currencies[id] = { id, minorUnitDigits };
  return structuredClone(ledger.currencies[id]);
}
function createLedgerAccount(ledger, { id, owner, currency = "CR", overdraftLimitMinor = 0, allowNegative = false, positions = {} } = {}) {
  if (typeof id !== "string" || !ACCOUNT_ID_PATTERN.test(id) || RESERVED_ACCOUNT_IDS.has(id)) throw new TypeError("Account requires a valid non-reserved ID");
  if (Object.hasOwn(ledger.accounts, id)) throw new Error("Financial account already exists: " + id);
  if (!isRecord(owner) || !OWNER_TYPE_PATTERN.test(owner.type) || typeof owner.id !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(owner.id)) throw new TypeError("Financial account requires a stable owner");
  if (!Object.hasOwn(ledger.currencies, currency)) throw new Error("Unknown account currency: " + currency);
  if (!Number.isSafeInteger(overdraftLimitMinor) || overdraftLimitMinor < 0 || typeof allowNegative !== "boolean") throw new TypeError("Invalid account overdraft policy");
  if (!isRecord(positions)) throw new TypeError("Account positions must be an object");
  ledger.accounts[id] = { id, owner: { type: owner.type, id: owner.id }, currency, balanceMinor: 0,
    overdraftLimitMinor, allowNegative, status: "open", positions: structuredClone(positions) };
  return structuredClone(ledger.accounts[id]);
}
function recordBalancedTransaction(ledger,{day,date,type,entries,commandId=null,reference=null}={}){
 validateFinancialLedger(ledger);
 if(!Number.isInteger(day)||day<0||typeof date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))throw new TypeError("Ledger transaction requires an authoritative campaign timestamp");
 assertIdentifier(type,TRANSACTION_TYPE_PATTERN,"Transaction type");
 if(!Array.isArray(entries)||entries.length<2||entries.length>MAX_TRANSACTION_ENTRIES)throw new TypeError("A ledger transaction requires 2–32 entries");
 if(commandId!==null) assertIdentifier(commandId,COMMAND_ID_PATTERN,"Ledger command ID");
 if(reference!==null&&(typeof reference!=="string"||reference.length>128))throw new TypeError("Ledger reference must be a short string or null");
 const seen=new Set(),currencyTotals=new Map(),deltas=[];
 for(const entry of entries){
  if(!isRecord(entry)||typeof entry.accountId!=="string"||!ledger.accounts[entry.accountId]
   ||!Number.isSafeInteger(entry.deltaMinor)||entry.deltaMinor===0||seen.has(entry.accountId))throw new TypeError("Invalid or repeated ledger entry");
  seen.add(entry.accountId);
  const account=ledger.accounts[entry.accountId];
  if(account.status!=="open")throw new Error("Financial account is closed: "+entry.accountId);
  currencyTotals.set(account.currency,(currencyTotals.get(account.currency)||0n)+BigInt(entry.deltaMinor));
  deltas.push({accountId:entry.accountId,deltaMinor:entry.deltaMinor});
 }
 for(const [currency,total] of currencyTotals)if(total!==0n)throw new Error("Transaction is not balanced in "+currency);
 const nextBalances=new Map();
 for(const entry of deltas){
  const account=ledger.accounts[entry.accountId],next=BigInt(account.balanceMinor)+BigInt(entry.deltaMinor);
  if(next>BigInt(Number.MAX_SAFE_INTEGER)||next<BigInt(Number.MIN_SAFE_INTEGER))throw new RangeError("Ledger balance exceeds safe integer limits");
  if(!account.allowNegative&&next<BigInt(-account.overdraftLimitMinor))throw new Error("Insufficient funds in account: "+entry.accountId);
  nextBalances.set(entry.accountId,Number(next));
 }
 const sequence=ledger.sequence+1;
 const transaction={id:"ledger-"+sequence,sequence,day,date,type,commandId,reference,entries:deltas};
 for (const [id, balance] of nextBalances) ledger.accounts[id].balanceMinor = balance;
 ledger.sequence = sequence;
 return structuredClone(transaction);
}
function getAccountBalance(ledger,accountId){
 if(!ledger?.accounts||!Object.hasOwn(ledger.accounts,accountId))throw new Error("Unknown financial account: "+accountId);
 return ledger.accounts[accountId].balanceMinor;
}
function createTransferCommand(){
 return {
  id:"finance.transfer",
  validate:({world,payload})=>{
   if(typeof payload.fromAccountId!=="string"||typeof payload.toAccountId!=="string"||payload.fromAccountId===payload.toAccountId)return "A transfer requires two different accounts";
   if(!Number.isSafeInteger(payload.amountMinor)||payload.amountMinor<=0)return "Transfer amount must be a positive integer in minor currency units";
   const source=world.finance?.accounts?.[payload.fromAccountId],target=world.finance?.accounts?.[payload.toAccountId];
   if(!source||!target)return "Transfer references an unknown account";
   if(source.status!=="open"||target.status!=="open")return "Both transfer accounts must be open";
   if(source.currency!==target.currency)return "Cross-currency transfers require an exchange transaction";
   if(!source.allowNegative&&source.balanceMinor-payload.amountMinor < -source.overdraftLimitMinor)return "Insufficient funds";
   if(target.balanceMinor+payload.amountMinor>Number.MAX_SAFE_INTEGER)return "Destination balance would exceed safe limits";
   return true;
  },
  authorize:({world,payload,context})=>{
   const source=world.finance.accounts[payload.fromAccountId];
   const actor=context?.actor;
   return Boolean(actor&&actor.type===source.owner.type&&actor.id===source.owner.id);
  },
  execute:({world,payload,commandId})=>{
   const day=world.clock.day,date=world.clock.date;
   const transaction=recordBalancedTransaction(world.finance,{
    day,date,type:"finance.transfer-settled",commandId,reference:payload.reference??null,
    entries:[
     {accountId:payload.fromAccountId,deltaMinor:-payload.amountMinor},
     {accountId:payload.toAccountId,deltaMinor:payload.amountMinor}
    ]
   });
   return {
    result:{transactionId:transaction.id,sequence:transaction.sequence,currency:world.finance.accounts[payload.fromAccountId].currency,
     amountMinor:payload.amountMinor,fromBalanceMinor:world.finance.accounts[payload.fromAccountId].balanceMinor,
     toBalanceMinor:world.finance.accounts[payload.toAccountId].balanceMinor},
    events:[{type:"finance.transfer-settled",scope:"account",subjectId:payload.fromAccountId,
     payload:{transactionId:transaction.id,toAccountId:payload.toAccountId,currency:world.finance.accounts[payload.fromAccountId].currency,amountMinor:payload.amountMinor}}]
   };
  }
 };
}
function validateWorldFinancialState(world){
 if(!isRecord(world)||!isRecord(world.player)||typeof world.player.accountId!=="string"||!world.finance)throw new Error("World has no canonical player finance account");
 validateFinancialLedger(world.finance);
 const account=world.finance.accounts[world.player.accountId];
 if(!account||account.owner.type!=="player"||account.owner.id!==world.player.factionId)throw new Error("Player finance account does not match player ownership");
 return true;
}
module.exports={
 MAX_FINANCIAL_TRANSACTIONS,MAX_TRANSACTION_ENTRIES,createFinancialLedger,validateFinancialLedger,
 createLedgerCurrency,createLedgerAccount,recordBalancedTransaction,getAccountBalance,createTransferCommand,validateWorldFinancialState
};
