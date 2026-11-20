const COMMAND_ID_PATTERN=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const COMMAND_TYPE_PATTERN=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const EVENT_TYPE_PATTERN=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const EVENT_SCOPE_PATTERN=/^[a-z][a-z0-9_-]{0,31}$/;
const EVENT_SUBJECT_PATTERN=/^[a-z0-9][a-z0-9._-]{1,63}$/;
const EVENT_KEY_PATTERN=/^[a-z0-9][a-z0-9:._-]{0,127}$/;
const MAX_COMMAND_RECEIPTS=256;
const MAX_COMMAND_PAYLOAD_BYTES=8192;
const MAX_COMMAND_RESULT_BYTES=16384;

function isRecord(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function normalizeJson(value,label,maxBytes){
 const ancestors=new Set();
 function visit(item){
  if(item===null||typeof item==="string"||typeof item==="boolean")return item;
  if(typeof item==="number"){if(!Number.isFinite(item))throw new TypeError(label+" numbers must be finite");return item;}
  if(typeof item!=="object")throw new TypeError(label+" must contain JSON-safe values only");
  if(ancestors.has(item))throw new TypeError(label+" cannot contain circular references");
  ancestors.add(item);
  let result;
  if(Array.isArray(item))result=item.map(visit);
  else{
   const prototype=Object.getPrototypeOf(item);
   if(prototype!==Object.prototype&&prototype!==null)throw new TypeError(label+" must contain plain objects only");
   result={};
   for(const key of Object.keys(item).sort())result[key]=visit(item[key]);
  }
  ancestors.delete(item);
  return result;
 }
 const normalized=visit(value);
 const serialized=JSON.stringify(normalized);
 if(Buffer.byteLength(serialized,"utf8")>maxBytes)throw new RangeError(label+" exceeds the "+maxBytes+" byte limit");
 return {value:JSON.parse(serialized),serialized};
}
function deepFreeze(value,seen=new Set()){
 if(!value||typeof value!=="object"||seen.has(value))return value;
 seen.add(value);
 for(const child of Object.values(value))deepFreeze(child,seen);
 return Object.freeze(value);
}
function assertSynchronous(value,label){
 if(value&&typeof value.then==="function")throw new TypeError(label+" must be synchronous");
 return value;
}
function runGuard(guard,args,label){
 const result=assertSynchronous(guard(args),label);
 if(result===false)throw new Error(label+" rejected the command");
 if(typeof result==="string"&&result.length>0)throw new Error(result);
 if(result!==undefined&&result!==true&&result!==null)throw new TypeError(label+" must return true, false, a message or undefined");
}

function validateCommandReceiptState(world){
 if(!isRecord(world)||!Array.isArray(world.commandReceipts)||world.commandReceipts.length>MAX_COMMAND_RECEIPTS)throw new Error("Save has an invalid command receipt history");
 const seen=new Set();
 for(const receipt of world.commandReceipts){
  if(!isRecord(receipt)||typeof receipt.commandId!=="string"||!COMMAND_ID_PATTERN.test(receipt.commandId)
   ||typeof receipt.type!=="string"||!COMMAND_TYPE_PATTERN.test(receipt.type)
   ||typeof receipt.signature!=="string"||receipt.signature.length>MAX_COMMAND_PAYLOAD_BYTES+160
   ||!Number.isInteger(receipt.day)||receipt.day<0||!Object.hasOwn(receipt,"result")||seen.has(receipt.commandId)){
   throw new Error("Save contains an invalid command receipt");
  }
  const separator=receipt.signature.indexOf("\n");
  if(separator<1||receipt.signature.slice(0,separator)!==receipt.type)throw new Error("Save contains an invalid command receipt signature");
  let payload;
  try{payload=JSON.parse(receipt.signature.slice(separator+1));}catch{throw new Error("Save contains an invalid command receipt payload signature");}
  const canonical=normalizeJson(payload,"Command receipt payload",MAX_COMMAND_PAYLOAD_BYTES);
  if(canonical.serialized!==receipt.signature.slice(separator+1))throw new Error("Save contains a non-canonical command receipt signature");
  normalizeJson(receipt.result,"Command receipt result",MAX_COMMAND_RESULT_BYTES);
  seen.add(receipt.commandId);
 }
 return true;
}

function normalizeCommandEvents(events,commandId){
 if(!Array.isArray(events))throw new TypeError("Command events must be an array");
 return events.map((event,index)=>{
  if(!isRecord(event))throw new TypeError("Command event descriptors must be objects");
  const type=event.type;
  const scope=event.scope??"world";
  const subjectId=event.subjectId??null;
  const idempotencyKey=event.idempotencyKey??"command:"+commandId+":"+index;
  if(typeof type!=="string"||!EVENT_TYPE_PATTERN.test(type))throw new TypeError("Command event requires a stable type ID");
  if(typeof scope!=="string"||!EVENT_SCOPE_PATTERN.test(scope))throw new TypeError("Command event requires a valid scope");
  if(subjectId!==null&&(typeof subjectId!=="string"||!EVENT_SUBJECT_PATTERN.test(subjectId)))throw new TypeError("Command event subjectId must be a stable identifier or null");
  if(typeof idempotencyKey!=="string"||!EVENT_KEY_PATTERN.test(idempotencyKey))throw new TypeError("Command event requires a valid idempotency key");
  const payload=normalizeJson(event.payload??{},"Command event payload",MAX_COMMAND_RESULT_BYTES).value;
  if(!isRecord(payload))throw new TypeError("Command event payload must be an object");
  return {type,scope,subjectId,payload,idempotencyKey};
 });
}

function createCommandDispatcher(definitions=[],options={}){
 if(!Array.isArray(definitions))throw new TypeError("Command definitions must be an array");
 if(options.validateWorld!==undefined&&typeof options.validateWorld!=="function")throw new TypeError("Command world validator must be a function");
 const handlers=new Map();
 function register(definition){
  if(!isRecord(definition)||typeof definition.id!=="string"||!COMMAND_TYPE_PATTERN.test(definition.id))throw new TypeError("Every command requires a stable lowercase ID");
  if(handlers.has(definition.id))throw new Error("Duplicate command definition: "+definition.id);
  if(typeof definition.validate!=="function"||typeof definition.execute!=="function")throw new TypeError("Command "+definition.id+" requires validate and execute functions");
  if(definition.authorize!==undefined&&typeof definition.authorize!=="function")throw new TypeError("Command "+definition.id+".authorize must be a function");
  handlers.set(definition.id,Object.freeze({...definition}));
  return definition.id;
 }
 for(const definition of definitions)register(definition);

 function dispatch({world,command,context={}}={}){
  if(!isRecord(world))throw new TypeError("A world state is required to dispatch a command");
  if(!isRecord(command)||Object.keys(command).some(key=>!["commandId","type","payload"].includes(key))
   ||typeof command.commandId!=="string"||!COMMAND_ID_PATTERN.test(command.commandId)
   ||typeof command.type!=="string"||!COMMAND_TYPE_PATTERN.test(command.type)
   ||!isRecord(command.payload))throw new TypeError("Invalid command envelope");
  if(world.commandReceipts!==undefined&&!Array.isArray(world.commandReceipts))throw new Error("World has an invalid command receipt history");
  const receipts=world.commandReceipts??[];
  if(world.commandReceipts!==undefined)validateCommandReceiptState(world);
  const payload=normalizeJson(command.payload,"Command payload",MAX_COMMAND_PAYLOAD_BYTES);
  const signature=command.type+"\n"+payload.serialized;
  const prior=receipts.find(receipt=>receipt.commandId===command.commandId);
  if(prior){
   if(prior.type!==command.type||prior.signature!==signature)throw new Error("Command ID was already used for a different command: "+command.commandId);
   return {world,result:structuredClone(prior.result),events:[],duplicate:true};
  }

  const definition=handlers.get(command.type);
  if(!definition)throw new Error("Unknown command type: "+command.type);
  const readOnlyWorld=deepFreeze(structuredClone(world));
  const readOnlyPayload=deepFreeze(payload.value);
  const guardArgs={world:readOnlyWorld,payload:readOnlyPayload,context,commandId:command.commandId};
  runGuard(definition.validate,guardArgs,"Command validation "+command.type);
  if(definition.authorize)runGuard(definition.authorize,guardArgs,"Command authorization "+command.type);

  const draft=structuredClone(world);
  if(!Array.isArray(draft.commandReceipts))draft.commandReceipts=[];
  const receiptsBeforeHandler=JSON.stringify(draft.commandReceipts);
  const rawOutcome=assertSynchronous(definition.execute({
   world:draft,payload:structuredClone(payload.value),context,commandId:command.commandId
  }),"Command handler "+command.type);
  if(JSON.stringify(draft.commandReceipts)!==receiptsBeforeHandler)throw new Error("Command handler "+command.type+" cannot modify command receipts");
  if(!isRecord(rawOutcome)||Object.keys(rawOutcome).some(key=>!["result","events"].includes(key)))throw new TypeError("Command handler "+command.type+" must return { result, events }");
  const result=normalizeJson(rawOutcome.result===undefined?null:rawOutcome.result,"Command result",MAX_COMMAND_RESULT_BYTES).value;
  const events=normalizeCommandEvents(rawOutcome.events??[],command.commandId);
  if(options.validateWorld){
   const validation=assertSynchronous(options.validateWorld(draft,context),"Command world validation");
   runGuard(()=>validation,{},"Command world validation");
  }
  const day=Number.isInteger(draft.clock?.day)?draft.clock.day:0;
  draft.commandReceipts.push({commandId:command.commandId,type:command.type,signature,day,result:structuredClone(result)});
  if(draft.commandReceipts.length>MAX_COMMAND_RECEIPTS)draft.commandReceipts.splice(0,draft.commandReceipts.length-MAX_COMMAND_RECEIPTS);
  return {world:draft,result,events,duplicate:false};
 }
 return Object.freeze({register,dispatch,getCommand:id=>handlers.get(id)||null,commandTypes:()=>[...handlers.keys()]});
}

module.exports={
 COMMAND_ID_PATTERN,COMMAND_TYPE_PATTERN,MAX_COMMAND_RECEIPTS,MAX_COMMAND_PAYLOAD_BYTES,MAX_COMMAND_RESULT_BYTES,
 createCommandDispatcher,validateCommandReceiptState
};
