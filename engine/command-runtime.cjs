const {createDomainEventEmitter}=require("./domain-events.cjs");
const {activateDomainEventTriggers}=require("./triggers.cjs");

function createWorldCommandRuntime({dispatcher,eventBus=null,onCommit=null}={}){
 if(!dispatcher||typeof dispatcher.dispatch!=="function")throw new TypeError("A command dispatcher is required");
 if(eventBus!==null&&(!eventBus||typeof eventBus.publish!=="function"))throw new TypeError("Event bus must provide publish(event)");
 if(onCommit!==null&&typeof onCommit!=="function")throw new TypeError("World command commit callback must be a function");
 if(eventBus?.isDisposed?.())throw new Error("Domain event bus has been disposed");

 function commitWorld(world){
  if(onCommit){
   const result=onCommit(world);
   if(result&&typeof result.then==="function"){
    if(typeof result.catch==="function")result.catch(()=>{});
    throw new TypeError("World command commit callback must be synchronous");
   }
  }
 }
 function dispatch({world,command,context={}}={}){
  if(eventBus?.isDisposed?.())throw new Error("Domain event bus has been disposed");
  const outcome=dispatcher.dispatch({world,command,context});
  if(outcome.duplicate)return {...outcome,events:[],eventDelivery:[]};
  try {
   if(!outcome.events.length){
    commitWorld(outcome.world);
    return {...outcome,events:[],eventDelivery:[]};
   }
   const nextWorld=outcome.world;
   if(!nextWorld.clock||!Number.isInteger(nextWorld.clock.day)||typeof nextWorld.clock.date!=="string")throw new Error("Command runtime requires an authoritative campaign clock");
   const recordDomainEvent=createDomainEventEmitter(nextWorld,nextWorld.clock);
   const emitDomainEvent=(input)=>{
    const previousSequence=nextWorld.domainEventSequence;
    const event=recordDomainEvent(input);
    if(event.sequence>previousSequence&&nextWorld.triggerQueue!==undefined){
     activateDomainEventTriggers(nextWorld,event);
    }
    return event;
   };
   const committedEvents=outcome.events.map(event=>emitDomainEvent(event));
   commitWorld(nextWorld);
   const eventDelivery=[];
   if(eventBus)for(const event of committedEvents){if(event.sequence>previousSequence)eventDelivery.push(eventBus.publish(event));}
   return {...outcome,events:committedEvents,eventDelivery};
  } catch(error) {
   const failure=new Error("Command commit/event publication failed: "+error.message,{cause:error});
   failure.code="WORLD_COMMAND_COMMIT_FAILURE";
   throw failure;
  }
 }
 return Object.freeze({dispatch});
}
module.exports={createWorldCommandRuntime};
