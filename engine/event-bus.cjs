const EVENT_TYPE_PATTERN=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
function isRecord(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function deepFreeze(value,seen=new Set()){
 if(!value||typeof value!=="object"||seen.has(value))return value;
 seen.add(value);
 for(const child of Object.values(value))deepFreeze(child,seen);
 return Object.freeze(value);
}
function createDomainEventBus(){
 const subscriptions=[];
 let nextId=1;
 let disposed=false;
 function subscribe(type,handler){
  if(disposed)throw new Error("Domain event bus has been disposed");
  if(typeof type==="function"){handler=type;type="*";}
  if(typeof type!=="string"||(type!=="*"&&!EVENT_TYPE_PATTERN.test(type)))throw new TypeError("Event subscription requires a stable type ID or wildcard");
  if(typeof handler!=="function")throw new TypeError("Event subscription handler must be a function");
  const entry={id:nextId++,type,handler};
  subscriptions.push(entry);
  let active=true;
  return ()=>{
   if(!active)return false;
   active=false;
   const index=subscriptions.indexOf(entry);
   if(index>=0)subscriptions.splice(index,1);
   return index>=0;
  };
 }
 function publish(event){
  if(disposed)throw new Error("Domain event bus has been disposed");
  if(!isRecord(event)||typeof event.type!=="string"||!EVENT_TYPE_PATTERN.test(event.type))throw new TypeError("Cannot publish an invalid domain event");
  const detached=JSON.parse(JSON.stringify(event));
  const immutableEvent=deepFreeze(detached);
  const matching=subscriptions.filter(entry=>entry.type==="*"||entry.type===event.type);
  const errors=[];
  let delivered=0;
  for(const entry of matching){
   try{
    const result=entry.handler(immutableEvent);
    if(result&&typeof result.then==="function")throw new TypeError("Domain event subscribers must be synchronous");
    delivered+=1;
   }catch(error){
    errors.push({subscriptionId:entry.id,eventType:event.type,message:String(error?.message||error)});
   }
  }
  return Object.freeze({delivered,failed:errors.length,errors:Object.freeze(errors.map(error=>Object.freeze({...error})))});
 }
 function dispose(){disposed=true;subscriptions.length=0;}
 return Object.freeze({
  subscribe,publish,dispose,
  getSubscriberCount:()=>subscriptions.length,
  isDisposed:()=>disposed
 });
}
module.exports={createDomainEventBus};
