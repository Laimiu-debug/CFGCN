# 水浒收藏棋子制作底册

2026-10-20 最新确认：用户认可陶塑版，要求眉眼至少清晰，授权按此方向生成每个棋子的资产。当前正式输入在 `ceramic/`，人物本体 168、独立器物 54，静态无骨骼；逐件质量 / 尺寸 / 导出 / 网页仍须验收。以下糖塑 v1 / v2 和陶塑首轮是保留的制作历史，不是最新全员生产输入。

- 当前陶塑标准：`ceramic/style.json`；[生产要求](../../../../docs/shuihu-ceramic-production.md)。
- 当前 168 人本体：`ceramic/roster.json`、`ceramic/prompts/<id>.body.txt`；[完整陶塑人物提示词](../../../../docs/shuihu-ceramic-prompts.md)。
- 当前 54 类器物：`ceramic/equipment-prompts.json`、`ceramic/prompts/equipment-<id>.txt`；[完整陶塑器物提示词](../../../../docs/shuihu-ceramic-weapon-prompts.md)。
- 当前资产队列：`ceramic/asset-queue.json`，只有实际观察到的项目才记入 `production-manifest.json`；排队不等于生成。
- 重建 / 核对当前陶塑：`node scripts/build-shuihu-ceramic-assets.mjs` / `--check`。保留已有队列状态、拒绝在同一版本下改写已有来源；旧糖塑生成器继续单独核对历史文本。

- 总体规格：[docs/shuihu-piece-production.md](../../../../docs/shuihu-piece-production.md)。
- 人物源：`roster.tsv`；可编辑十列包含稳定 ID、姓名 / 绰号 / 星号、单独身高、器物引用、职能、原创造型、原创姿态与阅读回目。`roster.json` 由脚本生成，不在生成文件中手改生产状态。
- 比例 / 配色源：`appearance.tsv`；168 人逐人填写 4.5–5 头身与中英文衣甲配色，姓名与稳定 ID 和人物源相互核对。已按用户确认方向更新提示词 v2。
- 兵器源：`weapons.json`；54 类兵器 / 职业道具，原著关联与原创结构分开判断。
- 完整提示词：[人物](../../../../docs/shuihu-piece-prompts.md)、[器物](../../../../docs/shuihu-weapon-prompts.md)与 `prompts/` 独立文件。人体分离稿为 `.body.txt`，带兵器整体试制稿为普通 `.txt`。
- 重建：`node scripts/build-shuihu-prompts.mjs`；核对文本 / ID / 名单数量 / 引用 / 哈希：`node scripts/build-shuihu-prompts.mjs --check`。脚本不连接 Tripo、不生成模型、不消费积分、不覆盖 GLB 或 Blender 源。
- 已核对 108 座次，36 天罡 / 72 地煞；另列 60 名扩展候选，不混入收集分母。第 71 回名单不能证明全部服饰 / 兵器已考据，各人物回目是待复核阅读指针。绰号异文保留；林娘子等不添加影视自创姓名。

## 三枚样板

| ID | 人物 | 不含座目标高 | 验证重点 |
| --- | --- | --- | --- |
| ls006 | 林冲 | 69 mm | 修长体态、长枪直线、脸 / 手 / 枪分离 |
| ls013 | 鲁智深 | 72 mm | 厚肩 / 腰腹 / 强壮四肢、禅杖与念珠 |
| ls059 | 扈三娘 | 66 mm | 挺拔女性体态、完整腰胯、双刀 / 手分离 |

当前先保留整体雕像生成稿，正式进入 Blender 后检查并拆分手与武器，整理刚性节点，不绑骨。底座由 Blender 共用制作，Tripo 不生成底座。

2026-10-20 审阅后用户已确认保留全身收藏棋、约五头身、体态更敦实与鲜明衣甲设色，半身裁切用于头像 / 队伍栏 / 卡面。v2 三枚制作稿为林冲 5 头身、靛蓝 / 朱红 / 古金；鲁智深 4.6 头身、赭金 / 墨绿 / 焦糖；扈三娘 5 头身、朱红 / 水青 / 古金。具体色稿和模型仍待再审阅。检视要求放大 / 缩小、平移定位和各部位近看。正式兵器独立于完整手掌，独立物体变换不代表手臂已有挥砍动作；当前整体雕像不能作为已可换装或攻击的资产。

v2 的 168 份整装稿、168 份空手人体稿和 54 份独立器物稿均低于 Studio 当前 1000 字符上限，单份可复制使用。正式分离生产采用 `.body.txt` 与独立器物，整装稿用于造型对照。首轮三枚实际输入另存 `source/prompts/studio-v1/`，不能把重建后的 v2 文本写成旧模型的来源。

## 最新陶塑试制（2026-10-20，待审阅）

林冲 `f0ae7ab1-539b-4cae-b853-846f9d502ccf`、鲁智深 `fead171e-e1d9-40f2-81da-acebcb279395`、扈三娘 `76c1254a-f4e1-44ed-a7cb-217e2ba88396` 均已生成。Studio v3.1 高精度 / 几何与贴图，分件与 8K 关闭，无绑骨；每枚 50，本批 150 积分，余额 23,955 → 23,805，无充值或升级。

实验源为 `experiments/ceramic-v1.json`，实际输入快照在 `source/prompts/studio-ceramic-v1/`，三份 830 / 854 / 860 字符；各自输入、截图哈希、项目 URL、面数与差距见 `production-manifest.json`。完整截图在 `.local/qa/shuihu-pieces/ceramic/studio-{linchong,luzhishen,husanniang}.jpg`，是实际工作台 1280×612 预览，各人缩放取景非尺度测量。鲁智深皮肤褐斑 / 金色禅杖、扈三娘缺一刀需返工，新三枚本机 GLB 尚未取得。

另有首版林冲真实材质对照：`source/ceramic_study.py` → `source/ceramic/ls006-first-source-glaze-study.blend` / 同名 JSON。复用既有 Tripo GLB、原件 SHA-256 未变；真实不透明釉面与素胎材质、正背实渲已保存，非新生成、不改几何、不加积分。程序遮罩和旧枪形待修，未烘焙 / 导出或网页验证。两类生产在 manifest 分开记录，当前共九个 Studio 项目加一个旧件材质研究，不等于九位成品人物。详见 [陶塑试制](../../../../docs/shuihu-ceramic-trial.md)。

## 来源与实际状态

实际访问：`studio.tripo3d.ai` 与国际官网在本轮多次超时；用户打开的 `studio.tripo3d.com` 可用，已通过同域工作台读到既有 Studio 资产和登录态。后续使用可用工作台，不因域名差异购买 API 或重复注册。连接元数据不包含任何凭据。

原件放入 `source/raw/<id>.glb`，可编辑源放 `source/<id>.blend`，图鉴件与战场件分别输出。实际任务、报价、原件哈希和验收状态单独写 `production-manifest.json`，文本重建不能覆盖它。当前三枚 v1 均已在 Studio 生成，林冲原始 GLB 已保存并校验 SHA-256，鲁智深 / 扈三娘本地导出尚待完成；尚无通过审阅的图鉴 / 战场成品。未生成的人物保持模型路径 / 哈希为空，不能把 `prompt-ready` 当作模型完成。

Studio 的临时签名下载链接只在本机临时传递，不进仓库 / Notion；第三方参考图片、浏览器运行资料与验收截图放 `.local/`。此前 v2 提示词更新轮次没有新的 Studio 生成或积分消费，随后用户明确要求“生成几个模型看看”，已进行下列三枚新试制；游戏功能尚未接入。

## v2 三枚试制结果（2026-10-20，待用户审阅）

沿用 Studio v3.1 高精度、几何与贴图，分件 / 8K 关闭，无绑骨任务。现有余额由 24,105 变为 23,955，本批三次各 50、共 150 积分；没有充值、升级或 API 消费。首轮三枚和原件保留，当前 manifest 共六条试制记录，按 styleId / 项目 ID 区分，不覆盖旧来源。

| 人物 | v2 Studio 项目 | Studio 三角面 | 实际预览与差距 |
| --- | --- | --- | --- |
| 林冲 | `95c59920-f66f-4030-b7e5-a4d159f49fe3` | 1,923,217 | 靛蓝 / 朱红 / 古金、紧凑身形可见；枪尾仍多出第二刃，需修掉 |
| 鲁智深 | `c6e21772-d96e-44a7-9d2c-1e2531cd1bc0` | 1,936,464 | 宽肩厚腹、贴胸念珠和墨绿腰带可见；单手直立持杖，未遵循双手斜持姿势 |
| 扈三娘 | `55405a61-ade8-40c9-8a11-21c5478cee3e` | 1,881,702 | 朱红上衣 / 水青下摆 / 金甲与双刀可见；手 / 刀柄分离、背面及糖质仍待精查 |

三枚实际输入保存在 `source/prompts/studio-v2/`，输入 / 文件 SHA-256 与三张完整 Studio 截图哈希已核对；截图在 `.local/qa/shuihu-pieces/studio-v2-{linchong,luzhishen,husanniang}.jpg`，是原始截图字节，未修图。默认相机分别适配人物，不作为同地线、毫米比例或背面验收证据。截图保留了工作台上下文。

三个模型均在 Studio 项目中可打开，地址见 manifest。当前本机尚未取得三枚 v2 GLB：林冲和鲁智深已操作导出，但未取得对应本地文件，不能标为原件归档完成；不重复生成模型来解决下载问题。没有 Blender 精修、兵器刚性分件、网页 LOD / 糖质验证、图鉴接入或最终美术验收。下一步先据本轮画面确认比例 / 设色，随后完成原件导出与修整。
