const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {MAX_MANIFEST_BYTES,MAX_INI_BYTES,readModPackages,loadCoreContent}=require("../electron/mod-loader.cjs");
const {parseIni}=require("../electron/ini-parser.cjs");
async function fixture(t){const r=await fs.mkdtemp(path.join(os.tmpdir(),"frontier-mods-"));t.after(()=>fs.rm(r,{recursive:true,force:true}));return r;}
function manifest(id="example-mod",content="sample.ini"){return `[mod]\nid = ${id}\nname = "Example Mod"\nversion = 1.0.0\nauthor = "Test"\napi_version = 3\n\n[files]\nregistry =\ncontent = ${content}\nlocalization =\n`;}
async function write(root,id,m=manifest(id),files={}){const d=path.join(root,id);await fs.mkdir(d,{recursive:true});await fs.writeFile(path.join(d,"manifest.ini"),m);for(const [cat,items]of Object.entries(files)){const p=path.join(d,cat);await fs.mkdir(p,{recursive:true});for(const [n,v]of Object.entries(items))await fs.writeFile(path.join(p,n),v);}return d;}
test("loads declared INI content and normalizes entity sections",async t=>{const r=await fixture(t);await write(r,"example-mod",manifest(),{content:{"sample.ini":"[event.market-open]\nname_key = event.market-open.name\nweight = 1\n"}});const [m]=await readModPackages(r);assert.equal(m.error,undefined);assert.deepEqual(m.data.content["sample.ini"].events[0],{id:"market-open",nameKey:"event.market-open.name",weight:1});});
test("Core cannot be disabled; optional Mods can",async t=>{const r=await fixture(t);await write(r,"core",manifest("core",""));await write(r,"example-mod",manifest());const m=await readModPackages(r,{enabledMods:{core:false,"example-mod":false}});assert.equal(m.find(x=>x.id==="core").enabled,true);assert.equal(m.find(x=>x.id==="example-mod").enabled,false);});
test("malformed package does not hide valid package",async t=>{const r=await fixture(t);await write(r,"good",manifest("good"),{content:{"sample.ini":"[event.good]\nweight=1"}});await write(r,"bad",manifest("bad"),{content:{"sample.ini":"[event.bad]\nvalue=[1,2]"}});const m=await readModPackages(r);assert.equal(m.find(x=>x.id==="good").error,undefined);assert.match(m.find(x=>x.id==="bad").error,/Inline JSON/);});
test("rejects unsupported API versions and executable code declarations",async t=>{const r=await fixture(t);await write(r,"old",manifest("old").replace("api_version = 3","api_version = 999"));await write(r,"code",manifest("code").replace("api_version = 3","api_version = 3\ncode_files = main.js"));const m=await readModPackages(r);assert.match(m.find(x=>x.id==="old").error,/unsupported.*API version/i);assert.match(m.find(x=>x.id==="code").error,/data-only/i);});
test("rejects JSON manifests and JSON category files",async t=>{const r=await fixture(t),d=await write(r,"json-mod");await fs.writeFile(path.join(d,"manifest.json"),"{}");let m=await readModPackages(r);assert.match(m[0].error,/JSON Mod manifests are forbidden/);await fs.rm(path.join(d,"manifest.json"));await fs.mkdir(path.join(d,"content"));await fs.writeFile(path.join(d,"content","hidden.json"),"{}");m=await readModPackages(r);assert.match(m[0].error,/JSON files are forbidden/);});
test("rejects traversal and non-INI filenames",async t=>{const r=await fixture(t);await write(r,"bad",manifest("bad","../outside.json"));const [m]=await readModPackages(r);assert.match(m.error,/only \.ini files/);});
test("rejects oversized manifest and INI files",async t=>{const r=await fixture(t),d=await write(r,"large");await fs.writeFile(path.join(d,"manifest.ini")," ".repeat(MAX_MANIFEST_BYTES+1));let [m]=await readModPackages(r);assert.match(m.error,/too large/);const r2=await fixture(t);await write(r2,"large",manifest("large"),{content:{"sample.ini":" ".repeat(MAX_INI_BYTES+1)}});[m]=await readModPackages(r2);assert.match(m.error,/too large/);});
test("normalizes registry INI sections",async t=>{const r=await fixture(t),m=manifest("example-mod","").replace("registry =","registry = definitions.ini");await write(r,"example-mod",m,{registry:{"definitions.ini":"[entry.my-event]\ntype = event"}});const [x]=await readModPackages(r);assert.deepEqual(x.data.registry["definitions.ini"].entries,[{id:"my-event",type:"event"}]);});
test("parses INI scalars and rejects inline JSON and duplicate keys",()=>{assert.deepEqual(parseIni('[market]\nname="Market"\nopen=true\nprice=12.5\nnotes=some text'),{market:{name:"Market",open:true,price:12.5,notes:"some text"}});assert.deepEqual(parseIni("[x]\na=[1,2]"),{x:{a:[1,2]}});assert.throws(()=>parseIni("[x]\na=[1,2]",{rejectInlineJson:true}),/Inline JSON/);assert.throws(()=>parseIni("[x]\na=1\na=2"),/Duplicate INI key/);});
test("loads localization INI",async t=>{const r=await fixture(t),m=manifest("locale","").replace("localization =","localization = zh-CN.ini");await write(r,"locale",m,{localization:{"zh-CN.ini":'[language]\nlocale=zh-CN\n[content]\nhello="你好"'}});const [x]=await readModPackages(r);assert.equal(x.data.localization["zh-CN.ini"].content.hello,"你好");});
test("loads Core and ignores disabled optional package",async t=>{const r=await fixture(t);await write(r,"core",manifest("core",""));await write(r,"optional",manifest("optional"));const x=await loadCoreContent(r,{enabledMods:{optional:false}});assert.equal(x.ok,true);assert.equal(x.mods.find(m=>m.id==="optional").enabled,false);});


test("loads API v4 JavaScript hooks only when scripts are declared",async t=>{
 const root=await fixture(t);
 const api4=manifest("scripted", "").replace("api_version = 3","api_version = 4")
  .replace("localization =","localization =\nscripts = world.js");
 await write(root,"scripted",api4,{scripts:{
  "world.js":"function onDay(input, api) { return { events: [{ type: 'daily-note', payload: { day: input.day, roll: api.random() } }] }; }"
 }});
 const [mod]=await readModPackages(root);
 assert.equal(mod.error,undefined);
 assert.equal(mod.apiVersion,4);
 assert.deepEqual(mod.hooks,{"campaign.after-day":"world.js:onDay"});
 assert.match(mod.scripts["world.js"],/function onDay/);
});

test("rejects API v3 scripts and undeclared or invalid hook targets",async t=>{
 const root=await fixture(t);
 const old=manifest("old","").replace("localization =","localization =\nscripts = world.js");
 await write(root,"old",old,{scripts:{"world.js":"function onDay() { return {}; }"}});
 const newer=manifest("newer","").replace("api_version = 3","api_version = 4")
  .replace("localization =","localization =\nscripts = world.js")
  .concat("\n[hooks]\ncampaign.after-day = missing.js:onDay\n");
 await write(root,"newer",newer,{scripts:{"world.js":"function onDay() { return {}; }"}});
 const mods=await readModPackages(root);
 assert.match(mods.find(mod=>mod.id==="old").error,/API version 4/);
 assert.match(mods.find(mod=>mod.id==="newer").error,/declared script function/);
});

test("rejects undeclared JavaScript files and script symlinks",async t=>{
 const root=await fixture(t);
 const api4=manifest("scripted","").replace("api_version = 3","api_version = 4")
  .replace("localization =","localization =\nscripts = declared.js");
 const directory=await write(root,"scripted",api4,{scripts:{"declared.js":"function onDay(){return{};}"}});
 await fs.writeFile(path.join(directory,"scripts","extra.js"),"function extra(){}");
 let [mod]=await readModPackages(root);
 assert.match(mod.error,/Undeclared JavaScript files/);
 await fs.rm(path.join(directory,"scripts","extra.js"));
 await fs.rm(path.join(directory,"scripts","declared.js"));
 await fs.symlink(path.join(directory,"manifest.ini"),path.join(directory,"scripts","declared.js"));
 [mod]=await readModPackages(root);
 assert.match(mod.error,/missing, linked or exceeds/);
});
