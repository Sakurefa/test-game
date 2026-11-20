const test=require("node:test"),assert=require("node:assert/strict");
const {createDomainEventBus}=require("../engine/event-bus.cjs");

test("event bus delivers matching and wildcard subscriptions in registration order",()=>{
 const bus=createDomainEventBus(),received=[];
 bus.subscribe("*",event=>received.push("all:"+event.type));
 bus.subscribe("market.prices-settled",event=>received.push("market:"+event.payload.count));
 bus.subscribe("war.chronology-advanced",event=>received.push("war"));
 const result=bus.publish({type:"market.prices-settled",payload:{count:3}});
 assert.deepEqual(received,["all:market.prices-settled","market:3"]);
 assert.deepEqual({delivered:result.delivered,failed:result.failed},{delivered:2,failed:0});
 assert.equal(bus.getSubscriberCount(),3);
});

test("subscribers receive detached deeply frozen event snapshots",()=>{
 const bus=createDomainEventBus(),source={type:"colony.production-settled",payload:{stock:{ore:4}}};
 let observed;
 bus.subscribe("colony.production-settled",event=>{
  observed=event;
  assert.equal(Object.isFrozen(event),true);
  assert.equal(Object.isFrozen(event.payload),true);
  assert.equal(Object.isFrozen(event.payload.stock),true);
 });
 bus.publish(source);source.payload.stock.ore=999;
 assert.equal(observed.payload.stock.ore,4);
});

test("unsubscribe is idempotent and affects subsequent publications only",()=>{
 const bus=createDomainEventBus(),received=[];
 const unsubscribe=bus.subscribe(event=>received.push(event.type));
 assert.equal(unsubscribe(),true);assert.equal(unsubscribe(),false);
 bus.publish({type:"market.prices-settled"});
 assert.deepEqual(received,[]);assert.equal(bus.getSubscriberCount(),0);
});

test("subscriber failures are isolated and reported without blocking later subscribers",()=>{
 const bus=createDomainEventBus(),received=[];
 bus.subscribe("market.prices-settled",()=>{throw new Error("projection unavailable");});
 bus.subscribe("market.prices-settled",()=>received.push("continued"));
 const result=bus.publish({type:"market.prices-settled"});
 assert.equal(result.delivered,1);assert.equal(result.failed,1);assert.equal(result.errors[0].message,"projection unavailable");
 assert.deepEqual(received,["continued"]);
});

test("event bus validates subscriptions and has an explicit disposal lifecycle",()=>{
 const bus=createDomainEventBus();
 assert.throws(()=>bus.subscribe("Bad Type",()=>{}),/stable type ID/);
 assert.throws(()=>bus.subscribe("market.prices-settled",null),/handler/);
 bus.dispose();assert.equal(bus.isDisposed(),true);assert.equal(bus.getSubscriberCount(),0);
 assert.throws(()=>bus.publish({type:"market.prices-settled"}),/disposed/);
});
