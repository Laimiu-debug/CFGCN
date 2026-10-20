import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Map();
for (let i=2;i<process.argv.length;i+=2) args.set(process.argv[i],process.argv[i+1]);
const required = key => {assert(args.get(key),'Missing '+key);return args.get(key);};
const assetId=required('--asset');
const project=required('--project');
const url=required('--url');
const status=required('--status');
assert(['generating','generated','generation-failed'].includes(status));
assert.match(project,/^[0-9a-f-]{36}$/);
assert(url.startsWith('https://studio.tripo3d.com/workspace/generate/')&&url.endsWith(project));
const root=fileURLToPath(new URL('../',import.meta.url));
const art=path.join(root,'apps/shuihu/art/pieces');
const hash=b=>createHash('sha256').update(b).digest('hex');
const queueFile=path.join(art,'ceramic/asset-queue.json');
const manifestFile=path.join(art,'production-manifest.json');
const queue=JSON.parse(await readFile(queueFile,'utf8'));
const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
const item=queue.assets.find(x=>x.assetId===assetId);
assert(item,'Unknown asset');
const input=await readFile(path.join(art,item.promptFile));
assert.equal(hash(input.toString().trimEnd()),item.promptSha256);
const snapshot=`source/prompts/studio-ceramic-production-v1/${item.kind==='equipment'?'equipment-':''}${item.id}${item.kind==='character-body'?'.body':''}.txt`;
await mkdir(path.dirname(path.join(art,snapshot)),{recursive:true});
let oldSnapshot;
try{oldSnapshot=await readFile(path.join(art,snapshot));}catch(e){if(e.code!=='ENOENT')throw e;}
if(oldSnapshot)assert.equal(hash(oldSnapshot),hash(input),'Never replace a different submitted prompt');
else await writeFile(path.join(art,snapshot),input);
const existing=manifest.models.find(m=>m.studioProjectId===project);
assert(!item.studioProjectId||item.studioProjectId===project,'Different task already owns this asset; version retry separately');
if(existing)assert.equal(existing.assetId,assetId);
const model=existing??{id:item.id,assetId,name:item.name,kind:item.kind,styleId:queue.styleId,
  studioProjectId:project,studioUrl:url,generatedOn:'2026-10-20',studioVersion:'v3.1',
  mode:'high-quality-geometry-and-texture',segmentation:false,texture8k:false,quotedStudioCredits:50,
  submittedPromptVariant:item.kind==='character-body'?'clothed-body-clear-eyes':'separate-ceramic-equipment',
  submittedPromptFile:snapshot,submittedPromptSha256:item.promptSha256,promptFileSha256:hash(input),
  raw:null,localExportStatus:'pending',blendFile:null,finalInspectorModel:null,finalBattlefieldModel:null,
  approved:false,faceReview:item.kind==='character-body'?'pending-closeup':'not-applicable',review:[]};
assert.equal(model.submittedPromptSha256,item.promptSha256);
model.generationStatus=status==='generated'?'generated-awaiting-closeup-and-blender':status;
if(args.has('--triangles'))model.studioTriangles=Number(args.get('--triangles'));
if(args.has('--vertices'))model.studioVertices=Number(args.get('--vertices'));
if(!existing)manifest.models.push(model);
Object.assign(item,{status,studioProjectId:project,studioUrl:url,quotedStudioCredits:50});
let batch=manifest.batches.find(b=>b.id==='studio-ceramic-production-v1');
if(!batch){batch={id:'studio-ceramic-production-v1',date:'2026-10-20',models:[],existingCreditBalanceBefore:23805,
  existingCreditBalanceAfter:null,creditsConsumed:0,newSubscriptionOrPurchase:false,directionApprovedByUser:true,finalIndividualAssetsApproved:false};manifest.batches.push(batch);}
batch.models=manifest.models.filter(m=>m.styleId===queue.styleId).map(m=>m.studioProjectId);
batch.creditsConsumed=manifest.models.filter(m=>m.styleId===queue.styleId).reduce((n,m)=>n+m.quotedStudioCredits,0);
if(args.has('--balance'))batch.existingCreditBalanceAfter=Number(args.get('--balance'));
manifest.quotedStudioCreditsTotal=manifest.models.reduce((n,m)=>n+m.quotedStudioCredits,0);
manifest.currentProductionStyleId=queue.styleId;
await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
await writeFile(queueFile,JSON.stringify(queue,null,2)+'\n');
console.log(JSON.stringify({recorded:assetId,studioProjectId:project,status,actualTasks:batch.models.length,
  actualQuotedCredits:batch.creditsConsumed,queueStates:queue.assets.reduce((a,x)=>(a[x.status]=(a[x.status]??0)+1,a),{})}));
