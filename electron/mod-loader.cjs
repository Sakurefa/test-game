const fs = require("node:fs/promises");
const path = require("node:path");
const { MAX_INI_BYTES, parseIni } = require("./ini-parser.cjs");
const MOD_API_VERSION = 3;
const MAX_MANIFEST_BYTES = 64 * 1024;
const CATEGORIES = ["registry", "content", "localization"];
const TYPE_FILES = {
  universe:"universes",system:"systems",location:"locations",trade_route:"tradeRoutes",
  faction:"factions",colony:"colonies",commodity:"commodities",recipe:"recipes",
  market:"markets",company:"companies",security:"securities",ship_class:"shipClasses",
  fleet:"fleets",war:"wars",event:"events"
};
const LIST_FIELDS = new Set(["links","location_ids","colony_ids","commodity_ids","security_ids","participants","fleet_ids","tags"]);
function isSafeModId(id){return typeof id==="string"&&/^[a-z0-9][a-z0-9._-]{1,63}$/.test(id);}
function isSafeModFile(file){return typeof file==="string"&&/^[a-zA-Z0-9_-]{1,64}\.ini$/.test(file);}
function splitList(v){return typeof v==="string"&&v.trim()?v.split(";").map(x=>x.trim()).filter(Boolean):[];}
function tuple(v,n,label){if(typeof v!=="string")throw new Error("Invalid "+label+" tuple");const p=v.split(":");if(p.length!==n||p.some(x=>!x.trim()))throw new Error("Invalid "+label+" tuple: "+v);return p;}
function camel(k){return k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());}
function normalizeEntity(section,id,type){
 const e={id};
 for(const [k,v] of Object.entries(section)){
  if(/^(stockpile|industry|input|output|ship)\./.test(k)||k==="position_x"||k==="position_y")continue;
  e[camel(k)]=LIST_FIELDS.has(k)?splitList(v):v;
 }
 if(section.position_x!==undefined||section.position_y!==undefined)e.position={x:section.position_x,y:section.position_y};
 if(type==="colony"){
  e.stockpiles={};for(const [k,v] of Object.entries(section))if(k.startsWith("stockpile."))e.stockpiles[k.slice(10)]=v;
  e.industries=Object.entries(section).filter(([k])=>k.startsWith("industry.")).sort(([a],[b])=>Number(a.slice(9))-Number(b.slice(9))).map(([,v])=>{const [recipeId,level,companyId]=tuple(v,3,"industry");return {recipeId,level:Number(level),...(companyId==="-"?{}:{companyId})};});
 }
 if(type==="recipe")for(const [key,out] of [["input","inputs"],["output","outputs"]])e[out]=Object.entries(section).filter(([k])=>k.startsWith(key+".")).sort(([a],[b])=>Number(a.slice(key.length+1))-Number(b.slice(key.length+1))).map(([,v])=>{const [commodityId,quantity]=tuple(v,2,key);return {commodityId,quantity:Number(quantity)};});
 if(type==="fleet")e.ships=Object.entries(section).filter(([k])=>k.startsWith("ship.")).sort(([a],[b])=>Number(a.slice(5))-Number(b.slice(5))).map(([,v])=>{const [shipClassId,quantity]=tuple(v,2,"ship");return {shipClassId,quantity:Number(quantity)};});
 return e;
}
function normalizeContentIni(data,file){
 const out={};
 for(const [sectionName,section] of Object.entries(data)){
  if(sectionName==="universe"){out.universe=normalizeEntity(section,section.id,"universe");continue;}
  const dot=sectionName.indexOf(".");if(dot<=0)continue;
  const type=sectionName.slice(0,dot),id=sectionName.slice(dot+1),collection=TYPE_FILES[type];
  if(!collection)throw new Error("Unknown content section ["+sectionName+"] in "+file);
  if(!out[collection])out[collection]=[];out[collection].push(normalizeEntity(section,id,type));
 }
 return out;
}
function normalizeRegistryIni(data,file){
 const entries=Object.entries(data).filter(([k])=>k.startsWith("entry.")).map(([k,v])=>({id:k.slice(6),type:v.type}));
 if(!entries.length)throw new Error(file+": no [entry.<id>] sections found");
 if(entries.some(e=>typeof e.type!=="string"))throw new Error(file+": registry entry missing type");
 return {entries};
}
function fileList(v,label){if(typeof v!=="string")throw new Error("Manifest [files]."+label+" must be a semicolon-separated list");return splitList(v);}
async function readCategory(directory,category,declared){
 if(!Array.isArray(declared)||declared.some(f=>!isSafeModFile(f)))throw new Error("Invalid "+category+" file declaration: only .ini files are supported");
 if(new Set(declared).size!==declared.length)throw new Error("Duplicate "+category+" file declaration");
 const out={};if(!declared.length)return out;
 const dir=path.join(directory,category),st=await fs.lstat(dir);
 if(!st.isDirectory()||st.isSymbolicLink())throw new Error("Mod "+category+"/ directory is missing or linked");
 if((await fs.readdir(dir)).some(f=>f.toLowerCase().endsWith(".json")))throw new Error("JSON files are forbidden in Mod "+category+"/; use INI");
 for(const file of declared){const p=path.join(dir,file),s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.size>MAX_INI_BYTES)throw new Error(category+" file is missing, linked or too large: "+file);out[file]=parseIni(await fs.readFile(p,"utf8"));}
 return out;
}
async function readModPackages(root,options={}){
 const enabledMods=options.enabledMods||{};await fs.mkdir(root,{recursive:true});const entries=await fs.readdir(root,{withFileTypes:true}),mods=[];
 for(const entry of entries){
  if(!entry.isDirectory()||!isSafeModId(entry.name))continue;
  const dir=path.join(root,entry.name);
  try{
   try{await fs.access(path.join(dir,"manifest.json"));throw new Error("JSON Mod manifests are forbidden; use manifest.ini");}catch(e){if(e.message.includes("forbidden"))throw e;if(e.code!=="ENOENT")throw e;}
   const mp=path.join(dir,"manifest.ini"),ms=await fs.lstat(mp);if(!ms.isFile()||ms.isSymbolicLink()||ms.size>MAX_MANIFEST_BYTES)throw new Error("Manifest is missing, linked or too large");
   const parsed=parseIni(await fs.readFile(mp,"utf8")),meta=parsed.mod,files=parsed.files;
   if(!meta||!files||meta.id!==entry.name||typeof meta.name!=="string"||typeof meta.version!=="string"||typeof meta.author!=="string"||meta.api_version!==MOD_API_VERSION||Object.keys(meta).some(k=>["code","code_files","scripts","script_files"].includes(k)))throw new Error("Invalid manifest or unsupported data-only Mod API version");
   const declarations={registry:fileList(files.registry,"registry"),content:fileList(files.content,"content"),localization:fileList(files.localization,"localization")};
   const enabled=entry.name==="core"||enabledMods[entry.name]!==false,data={};
   for(const category of CATEGORIES)data[category]=enabled?await readCategory(dir,category,declarations[category]):{};
   if(enabled){
    for(const [file,value] of Object.entries(data.registry))if(file==="definitions.ini")data.registry[file]=normalizeRegistryIni(value,file);
    for(const [file,value] of Object.entries(data.content))data.content[file]=normalizeContentIni(value,file);
   }
   mods.push({id:meta.id,name:meta.name,version:meta.version,author:meta.author,description:typeof meta.description==="string"?meta.description:"",apiVersion:meta.api_version,enabled,data});
  }catch(error){mods.push({id:entry.name,name:entry.name,version:"—",author:"—",apiVersion:null,error:error.message});}
 }
 return mods;
}
async function loadCoreContent(root,options={}){const mods=await readModPackages(root,options),core=mods.find(m=>m.id==="core");if(!core)return{ok:false,error:"Required content package mods/core is missing",mods};if(core.error)return{ok:false,error:"Core content package is invalid: "+core.error,mods};return{ok:true,core,mods};}
module.exports={MOD_API_VERSION,MAX_MANIFEST_BYTES,MAX_INI_BYTES,CATEGORIES,isSafeModId,isSafeModFile,readModPackages,loadCoreContent};
