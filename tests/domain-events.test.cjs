const test=require("node:test"),assert=require("node:assert/strict");
const {DOMAIN_EVENT_HISTORY_LIMIT,createDomainEventEmitter,validateDomainEventState}=require("../engine/domain-events.cjs");
const fixture=()=>({domainEventSequence:0,domainEvents:[]});
test("domain events use monotonic IDs and authoritative campaign timestamps",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:7,date:"2478-04-08"});
 const first=emit({type:"colony.production-settled",scope:"colony",subjectId:"new-dawn-colony",payload:{ore:13}});
 const second=emit({type:"market.prices-settled",scope:"market",subjectId:"new-dawn-market",payload:{instruments:5}});
 assert.deepEqual([first.id,second.id],["domain-1","domain-2"]);assert.equal(second.sequence,2);
 assert.equal(first.day,7);assert.equal(first.date,"2478-04-08");assert.equal(validateDomainEventState(world),true);
});
test("event payloads are detached JSON-safe copies",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:1,date:"2478-04-02"}),payload={changes:{ore:1.5}};
 const record=emit({type:"market.prices-settled",payload});payload.changes.ore=99;record.payload.changes.ore=88;
 assert.equal(world.domainEvents[0].payload.changes.ore,1.5);
 assert.throws(()=>emit({type:"market.prices-settled",payload:{value:Number.POSITIVE_INFINITY}}),/finite/);
});
test("event history is bounded while sequence remains monotonic",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:1,date:"2478-04-02"});
 for(let i=0;i<DOMAIN_EVENT_HISTORY_LIMIT+7;i++)emit({type:"test.event-recorded",payload:{index:i}});
 assert.equal(world.domainEvents.length,DOMAIN_EVENT_HISTORY_LIMIT);assert.equal(world.domainEvents[0].sequence,8);
 assert.equal(world.domainEventSequence,DOMAIN_EVENT_HISTORY_LIMIT+7);assert.equal(world.domainEvents.at(-1).id,"domain-307");
 assert.equal(validateDomainEventState(world),true);
});
test("event creation rejects invalid types, scopes, subjects and payloads",()=>{
 const world=fixture();assert.throws(()=>createDomainEventEmitter(world,{day:-1,date:"2478-04-02"}),/authoritative/);
 const emit=createDomainEventEmitter(world,{day:0,date:"2478-04-01"});
 assert.throws(()=>emit({type:"Bad Type",payload:{}}),/stable type ID/);
 assert.throws(()=>emit({type:"world.changed",scope:"bad scope",payload:{}}),/valid scope/);
 assert.throws(()=>emit({type:"world.changed",subjectId:"../save",payload:{}}),/stable identifier/);
 assert.throws(()=>emit({type:"world.changed",payload:[]}),/payload must be an object/);
});
test("save validation detects event sequence and record corruption",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:1,date:"2478-04-02"});
 emit({type:"war.chronology-advanced",scope:"war",subjectId:"cinder-conflict",payload:{daysActive:1}});
 const valid=structuredClone(world);assert.equal(validateDomainEventState(valid),true);
 valid.domainEventSequence=2;assert.throws(()=>validateDomainEventState(valid),/sequence/);
 valid.domainEventSequence=1;valid.domainEvents[0].id="domain-2";assert.throws(()=>validateDomainEventState(valid),/invalid domain event/);
});

test("event idempotency keys suppress duplicate facts and reject conflicting reuse",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:7,date:"2478-04-08"});
 const input={type:"colony.production-settled",scope:"colony",subjectId:"new-dawn-colony",idempotencyKey:"campaign-day:7:colony.production-settled:new-dawn-colony",payload:{ore:13}};
 const first=emit(input),duplicate=emit(structuredClone(input));
 assert.deepEqual(duplicate,first);assert.equal(world.domainEvents.length,1);assert.equal(world.domainEventSequence,1);
 assert.throws(()=>emit({...input,payload:{ore:99}}),/idempotency key conflict/);
 assert.throws(()=>emit({...input,idempotencyKey:"Bad Key"}),/idempotencyKey/);
 assert.equal(validateDomainEventState(world),true);
});
test("event history validation rejects duplicate idempotency keys",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:1,date:"2478-04-02"});
 emit({type:"market.prices-settled",scope:"market",subjectId:"new-dawn-market",idempotencyKey:"campaign-day:1:market.prices-settled:new-dawn-market"});
 world.domainEvents.push({...world.domainEvents[0],sequence:2,id:"domain-2"});
 world.domainEventSequence=2;
 assert.throws(()=>validateDomainEventState(world),/duplicate domain event idempotency keys/);
});




test("Domain Event history retains large JSON-safe payloads without a Trigger-only size restriction",()=>{
 const world=fixture(),emit=createDomainEventEmitter(world,{day:1,date:"2478-04-02"});
 const payload={message:"x".repeat(32*1024)};
 emit({type:"market.prices-settled",scope:"market",subjectId:"new-dawn-market",payload});
 assert.equal(world.domainEvents[0].payload.message.length,32*1024);
 assert.equal(validateDomainEventState(world),true);
});
