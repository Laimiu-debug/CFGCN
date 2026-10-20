import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const art = path.join(root, 'apps/shuihu/art/pieces');
const checking = process.argv.includes('--check');
const hash = data => createHash('sha256').update(data).digest('hex');
const styleBytes = await readFile(path.join(art, 'ceramic/style.json'));
const style = JSON.parse(styleBytes);
const oldCatalogue = JSON.parse(await readFile(path.join(art, 'roster.json'), 'utf8'));
assert.equal(oldCatalogue.characters.length, 168);
const limit = 1000;
const sourceWeapons = JSON.parse(await readFile(path.join(art, 'weapons.json'), 'utf8'));
const replacements = [
  [/dark-amber/g, 'dark-brown slip-painted'], [/amber-red/g, 'iron-red slip-painted'],
  [/reddish-amber/g, 'reddish-brown'], [/dark caramel body tone/g, 'dark-brown slip-painted skin'],
  [/dark caramel face/g, 'dark-brown slip-painted face'], [/pale honey-amber/g, 'pale ivory'],
  [/pale-gold amber/g, 'warm ivory'], [/amber-pale/g, 'pale ivory'], [/pale honey face/g, 'pale ivory face'],
  [/plum-caramel/g, 'plum-brown'], [/grey-caramel/g, 'grey'], [/white-caramel/g, 'white'],
  [/yellow-amber/g, 'ochre-yellow'], [/amber hair/g, 'ivory ceramic hair'],
  [/pale amber/g, 'warm ivory'], [/amber/g, 'warm clay'], [/caramel/g, 'brown slip'],
  [/bronze-edged/g, 'ivory-edged'], [/steel-toned/g, 'grey-glazed'],
  [/; -edged armour/g, '; rimmed armour'], [/; -brown court/g, '; brown court'],
  [/tidy -cuffed/g, 'tidy broad-cuffed'], [/layered and stage/g, 'layered stage'],
  [/restrained -ceremonial/g, 'restrained ceremonial'], [/an belt/g, 'a belt'],
];
const ceramicVisual = original => replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), original).replace(/\bChinese /g, '');
const ceramicPalette = original => original.replaceAll('antique-gold', 'ivory').replaceAll('dark-caramel', 'dark-brown').replaceAll('jade', 'celadon').replaceAll('teal', 'celadon').replaceAll('vermilion', 'iron-red');
const ceramicPaletteZh = original => original.replaceAll('古金', '象牙白').replaceAll('焦糖', '深褐').replaceAll('墨绿', '青绿釉').replaceAll('浓绿', '青绿釉').replaceAll('黛绿', '青绿釉').replaceAll('水青', '青釉').replaceAll('朱红', '铁红釉');
const face = 'Crisp sculpted eyelids, separate dark painted eyebrows, white sclera and dark iris/pupils, sharp lip line and nostrils.';
const material = 'Matte slip-painted clay skin; coloured garment glaze pools in carved folds, soft reflections.';
const finish = 'Finished back, fingers and feet. No base, scene, text, rig, candy, resin, metallic gold or blank eyes.';
const variants = {
  ls006: 'Empty curled grips beside waist, elbows clear of armour; balanced instructor stance.',
  ls013: 'Empty strong curled grips, elbows clear of full belly; wide grounded stance. Clean skin, no brown stains.',
  ls059: 'Both empty hands in matching curled grips, forearms slightly outward; full waist and legs, balanced guard.',
};
const characters = oldCatalogue.characters.map(item => {
  const visual = ceramicVisual(item.originalVisualDesign);
  const headRatio = style.headRatioOverrides[item.id] ?? style.headRatioDraftMap[item.headRatio];
  assert(headRatio >= 5.6 && headRatio <= 6.3);
  const appearance = style.appearanceOverrides[item.id] ?? {
    paletteZh: ceramicPaletteZh(item.paletteZh), paletteEnglish: ceramicPalette(item.paletteEnglish),
  };
  const ownName = visual.split(',')[0];
  const identity = visual.slice(ownName.length + 2);
  const bodyPose = variants[item.id] ?? 'Empty complete hands with curled open grips, arms clear of torso, feet grounded; equipment assembled later.';
  const prompt = `${ownName}, full-body Water Margin glazed stoneware figurine, natural ${headRatio}-head anatomy. ${face} ${identity}. ${material} Colors: ${appearance.paletteEnglish}. ${bodyPose} Body only, no handheld props. ${finish}`;
  assert(prompt.length <= limit, `${item.id} exceeds ${limit}: ${prompt.length}; edit authored content, do not truncate`);
  assert(!/amber|sugar|caramel/i.test(prompt), `${item.id} retains an obsolete material reference`);
  return { ...item, headRatio, ...appearance, promptStyleId: style.styleId,
    originalVisualDesign: visual, historicalSugarVisualDesign: item.originalVisualDesign,
    originalPoseDesign: item.originalPoseDesign, generationPose: bodyPose,
    prompt, bodyPrompt: prompt, promptSha256: hash(prompt), bodyPromptSha256: hash(prompt),
    sourceStatus: item.sourceStatus,
    production: {status: 'queued-unsubmitted', studioProjectId: null, studioTaskId: null, rawFile: null, rawSha256: null,
      blendFile: null, reviewModel: null, battlefieldModel: null, approved: false} };
});
const equipment = sourceWeapons.items.map(item => {
  const description = item.description.replaceAll('Chinese ', '').replaceAll('steel ', '').replaceAll('metal ', '').replaceAll('wooden ', '').replaceAll('hardwood ', '');
  const prompt = `Isolated Water Margin glazed stoneware prop: ${description}. Entire object is sculpted fired clay, zero metallic surfaces. Ivory ceramic blade/edges, dark-brown shaft/grips, celadon or iron-red glaze accents, pooling in relief. Clear usable grips, thick continuous shapes, finished all sides. No figure, hands, base, scene, text, gold metal, candy, resin or floating fragments. Static unrigged; separate equipment assembled with its owner in Blender.`;
  assert(prompt.length <= limit, item.id + ' too long');
  return {...item, description, styleId: style.styleId, prompt, promptSha256: hash(prompt), status:'queued-unsubmitted'};
});
assert.equal(characters.filter(c=>c.collection!=='expanded').length,108);
assert.equal(characters.filter(c=>c.collection==='expanded').length,60);
assert.equal(equipment.length,54);
assert.equal(new Set(characters.map(c=>c.id)).size,168);
const equipmentById = new Map(equipment.map(e=>[e.id,e]));
characters.forEach(c=>c.weaponIds.forEach(id=>assert(equipmentById.has(id),id)));
const catalogue = {schemaVersion:3,date:'2026-10-20',styleId:style.styleId,confirmation:style.approval,
  counts:oldCatalogue.counts, canonicalRosterUrl:oldCatalogue.canonicalRosterUrl,
  sourceCharacterCatalogueSha256:hash(await readFile(path.join(art,'roster.json'))),styleSha256:hash(styleBytes),
  faceAcceptance:style.faceAcceptance, productionVariant:style.productionVariant, characters};
const queued = [
  ...characters.map(c=>({assetId:`${c.id}-ceramic-body-v1`,id:c.id,name:c.name,kind:'character-body',promptFile:`ceramic/prompts/${c.id}.body.txt`,promptSha256:c.promptSha256,equipmentIds:c.weaponIds})),
  ...equipment.map(e=>({assetId:`equipment-${e.id}-ceramic-v1`,id:e.id,name:e.name,kind:'equipment',promptFile:`ceramic/prompts/equipment-${e.id}.txt`,promptSha256:e.promptSha256})),
];
const queueFile=path.join(art,'ceramic/asset-queue.json');
let oldQueue;
try {oldQueue=JSON.parse(await readFile(queueFile,'utf8'));} catch(error){if(error.code!=='ENOENT')throw error;}
const entries=queued.map(item=>{
  const previous=oldQueue?.assets.find(a=>a.assetId===item.assetId);
  if(previous){assert.equal(previous.promptSha256,item.promptSha256,'Submitted queue source changed; version the asset');return previous;}
  return {...item,status:'queued-unsubmitted',studioProjectId:null,studioUrl:null,quotedStudioCredits:null,
    sourceRaw:null,blendFile:null,inspectorModel:null,battlefieldModel:null,faceReview:'pending',approved:false};
});
const queue={schemaVersion:1,date:'2026-10-20',styleId:style.styleId,userAuthorizedProduction:true,
  counts:{characters:168,equipment:54,total:222},
  creditEstimate:{unitCreditsFromLastVisibleStudioQuote:50,estimatedTotal:11100,notAnActualCharge:true,newPurchaseAuthorized:false},
  sourcePolicy:'Only observed Studio tasks enter production-manifest.json. Queue entries are not generated assets.',assets:entries};
const docs=[ '# 水浒陶塑棋子：168 人正式本体提示词','',
  '2026-10-20。用户确认陶塑风格并要求眉眼清晰，授权逐人资产生成。人物本体与兵器独立制作，静态无骨骼；毫米尺寸和头身参数是制作目标，须实际测量。旧糖塑提示词与三轮实际输入保留。','',
  '脸部验收：眉毛与上眼睑分开，眼白 / 虹膜 / 瞳孔清楚，鼻口及须发边缘可辨；前面和两侧四分之三近看。Tripo 提示词不能替代 Blender 精修 / 贴图补绘与网页检视。','',
  ...characters.flatMap(c=>[`## ${c.id} ${c.name} · ${c.nickname}`,'',`${c.rank?`梁山第 ${c.rank} 位 / ${c.star}`:'扩展人物，不计入 108'}；${c.role}。不含座目标高 ${c.heightMm} mm，比例草稿 ${c.headRatio} 头身；${c.paletteZh}。`,'',`独立器物：${c.weaponIds.map(id=>equipmentById.get(id).name).join('、')}。既有原著回目为阅读指针，服饰 / 兵器造型是原创制作稿。`,'','```text',c.prompt,'```','']),
].join('\n');
const weaponDocs=['# 水浒陶塑兵器与身份道具：54 件独立提示词','',
  '2026-10-20。釉彩陶塑正式制作稿；形制、长度相对人物身高 H 的比例和握点仍须在 Blender 按持有人逐件调整。文本齐备不代表模型生成。','',
  ...equipment.flatMap(e=>[`## ${e.id} · ${e.name}`,'',`目标最大长度 ${e.lengthH}H，实际握点 / 左右手 / 形制另验收。`,'','```text',e.prompt,'```','']),
].join('\n');
const outputs=new Map([
  [path.join(art,'ceramic/roster.json'),JSON.stringify(catalogue,null,2)+'\n'],
  [path.join(art,'ceramic/equipment-prompts.json'),JSON.stringify(equipment,null,2)+'\n'],
  [queueFile,JSON.stringify(queue,null,2)+'\n'],
  [path.join(root,'docs/shuihu-ceramic-prompts.md'),docs+'\n'],
  [path.join(root,'docs/shuihu-ceramic-weapon-prompts.md'),weaponDocs+'\n'],
]);
for(const c of characters)outputs.set(path.join(art,`ceramic/prompts/${c.id}.body.txt`),c.prompt+'\n');
for(const e of equipment)outputs.set(path.join(art,`ceramic/prompts/equipment-${e.id}.txt`),e.prompt+'\n');
for(const [file,content]of outputs){
  if(checking)assert.equal(await readFile(file,'utf8'),content,'Stale ceramic text '+path.relative(root,file));
  else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content);}
}
console.log(JSON.stringify({mode:checking?'check':'write',styleId:style.styleId,characters:characters.length,equipment:equipment.length,
  outputs:outputs.size,bodyPromptMax:Math.max(...characters.map(c=>c.prompt.length)),equipmentPromptMax:Math.max(...equipment.map(e=>e.prompt.length)),
  actualGenerationPerformed:false,queueStates:entries.reduce((counts,a)=>(counts[a.status]=(counts[a.status]??0)+1,counts),{}),
  firstCharacter:characters[0],facePriorityExample:characters.find(c=>c.id==='ls006')},null,2));
