const {createDomainEventEmitter}=require("./domain-events.cjs");

function createWorldCommandRuntime({dispatcher,eventBus=null}={}){
 if(!dispatcher||typeof dispatcher.dispatch!=="function")throw new TypeError("A command dispatcher is required");
 if(eventBus!==null&&(!eventBus||typeof eventBus.publish!=="function"))throw new TypeError("Event bus must provide publish(event)");
 if(eventBus?.isDisposed?.())throw new Error("Domain event bus has been disposed");

 function dispatch({world,command,context={}}={}){
  if(eventBus?.isDisposed?.())throw new Error("Domain event bus has been disposed");
  const outcome=dispatcher.dispatch({world,command,context});
  if(outcome.duplicate)return {...outcome,events:[]};
  if(!outcome.events.length)return {...outcome,events:[]};
  const nextWorld=outcome.world;
  if(!nextWorld.clock||!Number.isInteger(nextWorld.clock.day)||typeof nextWorld.clock.date!=="string")throw new Error("Command runtime requires an authoritative campaign clock");
  const emitDomainEvent=createDomainEventEmitter(nextWorld,nextWorld.clock);
  const committedEvents=outcome.events.map(event=>emitDomainEvent(event));
  if(eventBus)for(const event of committedEvents)eventBus.publish(event);
  return {...outcome,events:committedEvents};
 }
 return Object.freeze({dispatch});
}
module.exports={createWorldCommandRuntime};
