import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const art = path.join(root, 'apps/shuihu/art/pieces');
const checking = process.argv.includes('--check');
const digest = (text) => createHash('sha256').update(text).digest('hex');
const source = await readFile(path.join(art, 'roster.tsv'), 'utf8');
const appearanceSource = await readFile(path.join(art, 'appearance.tsv'), 'utf8');
const [appearanceHeader, ...appearanceLines] = appearanceSource.trimEnd().split(/\r?\n/);
const appearanceFields = appearanceHeader.split('\t');
if (appearanceFields.join(',') !== 'id,name,headRatio,paletteZh,paletteEnglish') throw new Error('Invalid appearance TSV header');
const appearances = appearanceLines.filter(Boolean).map((line) => {
  const cells = line.split('\t');
  if (cells.length !== appearanceFields.length) throw new Error('Invalid appearance row');
  return Object.fromEntries(appearanceFields.map((field, index) => [field, cells[index]]));
});
const appearanceById = new Map(appearances.map((item) => [item.id, item]));
if (appearances.length !== 168 || appearanceById.size !== appearances.length) throw new Error('Expected 168 unique appearance designs');
const weapons = JSON.parse(await readFile(path.join(art, 'weapons.json'), 'utf8'));
const weaponById = new Map(weapons.items.map((weapon) => [weapon.id, weapon]));
if (weaponById.size !== weapons.items.length) throw new Error('Duplicate equipment ID');
const [header, ...lines] = source.trimEnd().split(/\r?\n/);
const fields = header.split('\t');
if (fields.length !== 10) throw new Error('Expected ten TSV fields');

const style = (heads) => `Full-body Water Margin painted amber sugar collectible, ${heads} heads tall, bold head and hands, compact strong limbs. Solid face and body, crisp carving, translucent thin edges.`;
const finish = 'Complete back, hands and feet; static, no rig. No base, scene, text, loose props, extra limbs, melted candy or baby face.';
const studioPromptLimit = 1000;
const equipmentOverrides = {
  ls006: 'One spear, single sinuous head, straight sturdy pole, small tassel, blunt unbladed tail; both hands grip the shaft; no second blade',
  ls013: 'One monk spade staff, shovel blade and open crescent on opposite ends, thick pole; one joined bead necklace worn on chest, no extra loose loop',
};
const sourceBase = 'https://zh.wikisource.org/zh-hans/水滸傳_(120回本)/';
const chapterUrl = (number) => `${sourceBase}第${String(number).padStart(3, '0')}回`;
const aliases = {
  ls001: ['及时雨', '孝义黑三郎'],
  ls030: ['浪里白跳', '浪裏白條'],
  ls061: ['地默星（星号异文）'],
  ls064: ['八臂那吒'],
  ls070: ['玉旛竿'],
  ls081: ['地羁星（星号异文）'],
  wm015: ['林冲之妻（不采用影视自创姓名）'],
  wm019: ['武大（不将武植作为本版原著定名）'],
  wm033: ['卢俊义之妻'],
};
const characters = lines.filter(Boolean).map((line, index) => {
  const cells = line.split('\t');
  if (cells.length !== fields.length) throw new Error(`Invalid row ${index + 2}: ${cells.length} fields`);
  const item = Object.fromEntries(fields.map((field, cell) => [field, cells[cell]]));
  const appearance = appearanceById.get(item.id);
  if (!appearance || appearance.name !== item.name) throw new Error(`${item.name}: missing or mismatched appearance design`);
  const headRatio = Number(appearance.headRatio);
  if (!Number.isFinite(headRatio) || headRatio < 4.5 || headRatio > 5) throw new Error(`${item.name}: expected 4.5–5 head proportions`);
  if (!appearance.paletteZh || !appearance.paletteEnglish || appearance.paletteEnglish.split(',').length < 3) throw new Error(`${item.name}: incomplete color blocking`);
  const rank = item.id.startsWith('ls') ? Number(item.id.slice(2)) : null;
  const equipment = item.weaponIds.split(',').map((id) => {
    const weapon = weaponById.get(id);
    if (!weapon) throw new Error(`${item.name}: unknown equipment ${id}`);
    return weapon;
  });
  const chapters = item.chapters.split(',').map(Number);
  if (!chapters.every((chapter) => Number.isInteger(chapter) && chapter >= 1 && chapter <= 120)) throw new Error(`${item.name}: bad chapter`);
  const heightMm = Number(item.heightMm);
  if (heightMm < 50 || heightMm > 78) throw new Error(`${item.name}: bad height`);
  const equipmentPrompt = equipmentOverrides[item.id] ?? equipment.map((weapon) => weapon.description.replace(/^one /, '').replace(/^a matched pair of /, 'two ').replace(/\bChinese /g, '')).join('; ');
  const prompt = `${style(headRatio)} ${item.visual.replace(/\bChinese /g, '')}. Colors: ${appearance.paletteEnglish}. ${item.pose}. Equipment: ${equipmentPrompt}. ${finish}`;
  const bodyPrompt = `${style(headRatio)} ${item.visual.replace(/\bChinese /g, '')}. Colors: ${appearance.paletteEnglish}. Body only, no handheld props. Empty complete hands with open grips, arms clear of torso, both feet grounded; rigid equipment assembled later. ${finish}`;
  if (prompt.length > studioPromptLimit || bodyPrompt.length > studioPromptLimit) throw new Error(`${item.name}: prompt lengths ${prompt.length}/${bodyPrompt.length} exceed Studio ${studioPromptLimit}; edit the authored design rather than truncate it`);
  return {
    id: item.id, rank, collection: rank ? (rank <= 36 ? 'tiangang' : 'disha') : 'expanded',
    name: item.name, nickname: item.nickname, star: rank ? item.star : null,
    aliases: aliases[item.id] ?? [], role: item.role, heightMm, weaponIds: equipment.map((weapon) => weapon.id),
    headRatio, paletteZh: appearance.paletteZh, paletteEnglish: appearance.paletteEnglish,
    originalVisualDesign: item.visual, originalPoseDesign: item.pose,
    sources: chapters.map((chapter) => ({ chapter, url: chapterUrl(chapter), status: rank && chapter === 71 ? 'name-and-order-cross-checked' : 'reading-pointer-needs-character-level-review' })),
    sourceStatus: rank ? 'roster-checked-visual-and-equipment-original-proposal' : 'extension-candidate-chapter-pointers-need-review',
    production: { status: 'prompt-ready', studioProjectId: null, studioTaskId: null, rawFile: null, rawSha256: null, blendFile: null, reviewModel: null, battlefieldModel: null, approved: false },
    promptStyleId: 'amber-sugar-miniature-v2', recommendedProductionVariant: 'body-plus-separate-equipment',
    prompt, bodyPrompt, promptSha256: digest(prompt), bodyPromptSha256: digest(bodyPrompt),
  };
});

const liangshan = characters.filter((item) => item.rank !== null);
const expanded = characters.filter((item) => item.rank === null);
if (characters.length !== 168 || liangshan.length !== 108 || expanded.length !== 60) throw new Error('Expected 108 + 60 distinct characters');
if (new Set(characters.map((item) => item.id)).size !== characters.length || new Set(characters.map((item) => item.name)).size !== characters.length) throw new Error('Duplicate name or ID');
liangshan.forEach((item, index) => { if (item.rank !== index + 1) throw new Error(`Rank gap at ${item.name}`); });
if (characters.find((item) => item.name === '晁盖')?.rank !== null) throw new Error('Chao Gai must remain outside the 108 denominator');
const prototypeIds = ['ls006', 'ls013', 'ls059'];
const equipmentPrompts = weapons.items.map((weapon) => ({
  ...weapon,
  styleId: 'amber-sugar-miniature-v2',
  prompt: `Isolated Water Margin equipment: ${weapon.description}. Painted amber sugar; jade or indigo main surfaces, vermilion grips or ties, antique-gold fittings and ivory edges where present; crisp carving, subtly translucent edges. Finish all sides and usable grips. No figure, hand, base, scene, text, melted candy or floating fragments. Static unrigged prop; recolor to its owner's design in Blender.`,
}));
if (equipmentPrompts.some((weapon) => weapon.prompt.length > studioPromptLimit)) throw new Error('Equipment prompt exceeds Studio limit');
const catalogue = {
  schemaVersion: 2, date: '2026-10-20', styleId: 'amber-sugar-miniature-v2',
  confirmation: 'User approved full-body amber sugar collectibles, roughly five-head compact proportions, richer distinct garment colors, and half-body crops for portraits / cards. Detailed per-character designs, numerical budgets and final model acceptance still require sample review.',
  paletteTokens: ['--vermilion', '--accent-shuihu', '--jade', '--gold', '--gold-ink', '--ink', '--paper'],
  sourceSha256: digest(source), appearanceSha256: digest(appearanceSource), weaponsSha256: digest(JSON.stringify(weapons)),
  canonicalRosterUrl: chapterUrl(71), prototypeIds,
  counts: { liangshan: 108, tiangang: 36, disha: 72, expanded: 60, total: 168, equipment: equipmentPrompts.length },
  characters,
};
const notice = '提示词已编制，不等于模型已生成。正文服饰、体态、姿势和器物形制为原创造型建议；108 座次另核对第 71 回。各人回目是待复核阅读指针，不作为全部典故与兵器均已考据的声明。';
const characterDoc = [
  '# 水浒棋子：168 人逐人完整 Tripo 提示词', '',
  '日期：2026-10-20。提示词 v2：用户已确认全身糖塑、约五头身、体态更敦实和鲜明衣甲设色；半身裁切用于头像 / 卡面。由 `scripts/build-shuihu-prompts.mjs` 从人物、逐人比例 / 配色与兵器底册生成；编辑 `roster.tsv`、`appearance.tsv` 与兵器 JSON 后重建。', '',
  notice, '',
  '每段英文可独立复制，已带逐人比例、配色、体态、姿势、器物和共用要求，全部按当前 Studio 1000 字符上限核对。普通 `.txt` 是整装造型研究；正式可换装备资产使用 `.body.txt` 空手人体稿配独立器物，之后在 Blender 设握点和组装。空手稿保留穿戴细节，不复述持械指令。首轮三枚实际输入已另存 `source/prompts/studio-v1/`，不能用 v2 文本冒充旧模型的实际输入。', '',
  ...characters.flatMap((item) => [
    `## ${item.id} ${item.name} · ${item.nickname}`, '',
    `${item.rank ? `梁山第 ${item.rank} 位 / ${item.star}` : '扩展人物，不计入 108'}；${item.role}；不含座目标高 ${item.heightMm} mm；器物：${item.weaponIds.map((id) => weaponById.get(id).name).join('、')}。`, '',
    `收藏比例 ${item.headRatio} 头身；配色：${item.paletteZh}。`, '',
    `阅读指针：${item.sources.map((entry) => `[第 ${entry.chapter} 回](${entry.url})`).join('、')}。造型与兵器状态：原创建议 / 人物逐条考据待补。`, '',
    '```text', item.prompt, '```', '',
  ]),
].join('\n');
const equipmentDoc = [
  '# 水浒棋子：兵器与职业道具逐件提示词', '', '提示词 v2：配合已确认的鲜明设色糖塑棋子。通用器物完成后按持有人 `appearance.tsv` 配色，保留刃口 / 握柄 / 连接结构的区分。', '', notice, '',
  '长度 H 为持有人不含座身高的比例；不是历史实物尺寸或全员固定尺寸。静态握点、刀口方向与左右手在 Blender 源中另记。', '',
  ...equipmentPrompts.flatMap((weapon) => [`## ${weapon.id} · ${weapon.name}`, '', `建议最大长度 ${weapon.lengthH}H；原创结构提案，尚未生成。`, '', '```text', weapon.prompt, '```', '']),
].join('\n');
const promptDir = path.join(art, 'prompts');
const outputs = new Map([
  [path.join(art, 'roster.json'), `${JSON.stringify(catalogue, null, 2)}\n`],
  [path.join(art, 'equipment-prompts.json'), `${JSON.stringify(equipmentPrompts, null, 2)}\n`],
  [path.join(root, 'docs/shuihu-piece-prompts.md'), `${characterDoc}\n`],
  [path.join(root, 'docs/shuihu-weapon-prompts.md'), `${equipmentDoc}\n`],
]);
for (const item of characters) {
  outputs.set(path.join(promptDir, `${item.id}.txt`), `${item.prompt}\n`);
  outputs.set(path.join(promptDir, `${item.id}.body.txt`), `${item.bodyPrompt}\n`);
}
for (const weapon of equipmentPrompts) outputs.set(path.join(promptDir, `equipment-${weapon.id}.txt`), `${weapon.prompt}\n`);
for (const [filename, content] of outputs) {
  if (checking) {
    if (await readFile(filename, 'utf8') !== content) throw new Error(`Stale generated text: ${path.relative(root, filename)}`);
  } else {
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content, 'utf8');
  }
}
console.log(JSON.stringify({ mode: checking ? 'check' : 'write', styleId: catalogue.styleId, ...catalogue.counts, files: outputs.size, maxCharacterPrompt: Math.max(...characters.map((item) => item.prompt.length)), maxBodyPrompt: Math.max(...characters.map((item) => item.bodyPrompt.length)), maxEquipmentPrompt: Math.max(...equipmentPrompts.map((item) => item.prompt.length)), prototypes: characters.filter((item) => prototypeIds.includes(item.id)).map((item) => ({ id: item.id, name: item.name, headRatio: item.headRatio, palette: item.paletteZh, promptCharacters: item.prompt.length })), modelGeneration: 'not performed by this script' }, null, 2));
