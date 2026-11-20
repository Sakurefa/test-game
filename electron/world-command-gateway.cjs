const {createCommandDispatcher}=require("../engine/commands.cjs");
const {createWorldCommandRuntime}=require("../engine/command-runtime.cjs");
const {createDomainEventBus}=require("../engine/event-bus.cjs");
const {createTransferCommand}=require("../engine/ledger.cjs");

function createWorldCommandGateway({
 getWorld,getCatalog,getActor,onWorldCommit,onEvent=()=>{}
}={}){
 for(const [name,fn] of Object.entries({getWorld,getCatalog,getActor,onWorldCommit,onEvent})){
  if(typeof fn!=="function")throw new TypeError("World command gateway requires "+name+"()");
 }
 const eventBus=createDomainEventBus();
 eventBus.subscribe("*",event=>onEvent(event));
 const dispatcher=createCommandDispatcher([createTransferCommand()]);
 const runtime=createWorldCommandRuntime({dispatcher,eventBus,onCommit:onWorldCommit});
 let disposed=false;
 function dispatch(command){
  if(disposed)throw new Error("World command gateway has been disposed");
  const world=getWorld(),catalog=getCatalog();
  if(!world||!catalog)throw new Error("No active world is loaded");
  const actor=getActor(world);
  if(!actor||typeof actor.type!=="string"||typeof actor.id!=="string")throw new Error("No trusted command actor is available");
  const outcome=runtime.dispatch({world,command,context:{actor}});
  return {
   duplicate:outcome.duplicate,
   result:outcome.result,
   events:outcome.events,
   eventDelivery:outcome.eventDelivery
  };
 }
 function publishEvent(event){
  if(disposed)throw new Error("World command gateway has been disposed");
  return eventBus.publish(event);
 }
 function dispose(){
  if(disposed)return false;
  disposed=true;
  eventBus.dispose();
  return true;
 }
 return Object.freeze({dispatch,publishEvent,dispose,isDisposed:()=>disposed,commandTypes:()=>dispatcher.commandTypes()});
}
module.exports={createWorldCommandGateway};
