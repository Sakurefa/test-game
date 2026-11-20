const DOMAIN_EVENT_HISTORY_LIMIT=300;
const EVENT_TYPE_PATTERN=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const IDENTIFIER_PATTERN=/^[a-z0-9][a-z0-9._-]{1,63}$/;
const SCOPE_PATTERN=/^[a-z][a-z0-9_-]{0,31}$/;
function isRecord(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function clonePayload(value){
 if(!isRecord(value))throw new TypeError("Domain event payload must be an object");
 const encoded=JSON.stringify(value,(key,item)=>{
  if(typeof item==="number"&&!Number.isFinite(item))throw new TypeError("Domain event payload numbers must be finite");
  if(typeof item==="function"||typeof item==="bigint"||typeof item==="undefined")throw new TypeError("Domain event payload must contain JSON-safe values only");
  return item;
 });
 if(encoded===undefined)throw new TypeError("Domain event payload is not serializable");
 return JSON.parse(encoded);
}
function createDomainEventEmitter(world,clock){
 if(!isRecord(world))throw new TypeError("A mutable world state is required for domain events");
 if(!isRecord(clock)||!Number.isInteger(clock.day)||clock.day<0||typeof clock.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(clock.date))throw new TypeError("Domain events require an authoritative campaign day and date");
 if(!Array.isArray(world.domainEvents))world.domainEvents=[];
 if(!Number.isInteger(world.domainEventSequence)||world.domainEventSequence<0)throw new Error("World has an invalid domain-event sequence");
 return function emitDomainEvent({type,scope="world",subjectId=null,payload={}}){
  if(typeof type!=="string"||!EVENT_TYPE_PATTERN.test(type))throw new TypeError("Domain event requires a stable type ID");
  if(typeof scope!=="string"||!SCOPE_PATTERN.test(scope))throw new TypeError("Domain event requires a valid scope");
  if(subjectId!==null&&(typeof subjectId!=="string"||!IDENTIFIER_PATTERN.test(subjectId)))throw new TypeError("Domain event subjectId must be a stable identifier or null");
  const sequence=world.domainEventSequence+1;
  const record={id:"domain-"+sequence,sequence,day:clock.day,date:clock.date,type,scope,subjectId,payload:clonePayload(payload)};
  world.domainEvents.push(record);
  if(world.domainEvents.length>DOMAIN_EVENT_HISTORY_LIMIT)world.domainEvents.splice(0,world.domainEvents.length-DOMAIN_EVENT_HISTORY_LIMIT);
  world.domainEventSequence=sequence;
  return JSON.parse(JSON.stringify(record));
 };
}
function validateDomainEventState(world){
 if(!isRecord(world)||!Array.isArray(world.domainEvents)||!Number.isInteger(world.domainEventSequence)||world.domainEventSequence<0)throw new Error("Save has an invalid domain-event history");
 if(world.domainEvents.length>DOMAIN_EVENT_HISTORY_LIMIT)throw new Error("Save domain-event history exceeds its configured limit");
 let previous=0;
 for(const event of world.domainEvents){
  if(!isRecord(event)||!Number.isInteger(event.sequence)||event.sequence<=previous||event.sequence>world.domainEventSequence||event.id!=="domain-"+event.sequence
   ||!Number.isInteger(event.day)||event.day<0||typeof event.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(event.date)
   ||typeof event.type!=="string"||!EVENT_TYPE_PATTERN.test(event.type)||typeof event.scope!=="string"||!SCOPE_PATTERN.test(event.scope)
   ||(event.subjectId!==null&&(typeof event.subjectId!=="string"||!IDENTIFIER_PATTERN.test(event.subjectId)))||!isRecord(event.payload))throw new Error("Save contains an invalid domain event");
  previous=event.sequence;
 }
 if(world.domainEvents.length>0&&previous!==world.domainEventSequence)throw new Error("Save domain-event sequence does not match its latest retained event");
 return true;
}
module.exports={DOMAIN_EVENT_HISTORY_LIMIT,createDomainEventEmitter,validateDomainEventState};
