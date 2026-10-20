# 水浒棋子：釉彩陶塑试制

2026-10-20。用户认为 v2 不如第一版，且无法辨认糖塑，明确要求“试试陶瓷风格”。本轮授权的是陶瓷样板，最终统一材质与批量提示词仍待实际画面；保留糖塑 v1 / v2、所有输入与项目，不覆盖 168 人现有底册。

本轮仍选林冲、鲁智深、扈三娘，以便对照。试制向第一版自然成人体态靠拢，约六头身只是本轮制作参数；不再在提示词里强调巨大的头手或短粗四肢。林冲清瘦且肩背有力，鲁智深宽腰厚臂、有成年面容和短须，扈三娘保持完整腰胯与利落持刀姿势。

材质目标是釉彩陶塑：脸和手为温润素胎，衣袍 / 甲纹有厚釉、衣褶积釉与柔和反射，足底局部露胎；兵器也表现为陶塑造型，避免金属金甲盖过陶瓷质感。林冲靛蓝 / 青釉 / 少量铁红，鲁智深赭褐袍 / 青绿束带，扈三娘铁红上衣 / 青绿下摆 / 象牙白甲纹。具体三份英文实际输入位于 `apps/shuihu/art/pieces/experiments/ceramic-v1.json` 与 `source/prompts/studio-ceramic-v1/`，均需通过当前 Studio 1000 字符上限。

造型与素胎 / 釉面的对照借鉴[国立历史博物馆石湾陶人物馆藏说明](https://tcmb.culture.tw/zh-tw/detail?id=14000076824&indexCode=MOCCOLLECTIONS)和 [V&A 陶瓷材料介绍](https://www.vam.ac.uk/articles/a-z-of-ceramics)。这是原创文学游戏改编，不复制馆藏具体人物，也不宣称宋代陶塑历史复原。

使用既有 Tripo Studio，不绑骨，沿用可见报价；实际任务、积分与来源哈希独立记录。生成贴图未必形成真正的釉面材质，仍须看实际模型；必要时用已接收的 Tripo 原件在 Blender 做真实陶瓷材质对照，明确标出来源 / 新生成与材质改制的区别。原始模型、可编辑 Blender 源、预览图与导出状态按实况保存。

## 三枚实际生成与审阅记录

三枚均已在 Studio 生成，v3.1 高精度 / 几何与贴图 / 分件和 8K 关闭，无绑骨。每枚 50 个现有积分，本批 150，余额 23,955 → 23,805；没有充值、升级或 API 消费。前两轮各三枚与本轮三枚共九条生产记录分别保留，三轮累计报价 450 积分。

| 人物 | 实际项目 | 三角面 / 顶点 | 正面可见结果与返工点 |
| --- | --- | --- | --- |
| 林冲 | [打开 Studio](https://studio.tripo3d.com/workspace/generate/one-full-body-water-margin-glazed-stoneware-figurine-natural-six-head-f0ae7ab1-539b-4cae-b853-846f9d502ccf) | 1,916,959 / 982,536 | 靛蓝 / 青釉衣与象牙白脸、甲纹有对比；正面只见上端枪尖、下端圆钝，无旧版多余尾刃。背面与正式兵器分离仍待检查。 |
| 鲁智深 | [打开 Studio](https://studio.tripo3d.com/workspace/generate/one-full-body-water-margin-glazed-stoneware-figurine-natural-adult-an-fead171e-e1d9-40f2-81da-acebcb279395) | 1,937,852 / 998,509 | 成年怒目、赭褐釉袍与青绿束带可见；皮肤褐斑过重，禅杖仍显金属金色，单手竖持未遵循双手姿势，杖下端未验收。 |
| 扈三娘 | [打开 Studio](https://studio.tripo3d.com/workspace/generate/one-full-body-water-margin-glazed-stoneware-figurine-natural-six-head-76c1254a-f4e1-44ed-a7cb-217e2ba88396) | 1,976,414 / 1,013,805 | 红釉袖、青釉下摆、素胎脸和浅色甲纹可见；实际只有一把刀，另一手空着，双刀与面部设色需修。 |

三份实际输入分别为 830 / 854 / 860 字符，快照与 SHA-256 已记录在 `production-manifest.json`。完整原生工作台截图在 `.local/qa/shuihu-pieces/ceramic/studio-{linchong,luzhishen,husanniang}.jpg`，各 1280×612；根据人物分别缩放取景，不能充当同相机 / 同地线 / 毫米测量。新三枚保存在 Studio，尚未取得本机原始 GLB，不虚填文件哈希。正面看得到釉彩与素胎对照，但真实 PBR 釉面参数、背面、尺寸、分件和网页效果尚未验收；不把提示词中的六头身当作实测值。

## 复用第一版林冲的真实材质对照

另用已下载的第一版林冲原始 GLB 做 Blender 釉面材质实验，不改变原件几何、不是第四枚新生成、额外积分为零。原件项目 `39920c45-8dbb-4414-975d-ee9d071d604f`，SHA-256 `286661d55f3cecbcc84b0e3a89fcb239338fba7d6d16ce7e8b6f0893c6d3f73b`，再次核对未变。

`apps/shuihu/art/pieces/source/ceramic_study.py` 为可重建脚本，`source/ceramic/ls006-first-source-glaze-study.blend` 为实际可编辑源，旁置 JSON 记录源件与实验边界。两种真实 Principled 材质分别表现不透明釉面与哑光素胎：金属度为零、无透射，釉面折射率 1.5、粗糙度约 0.25–0.33，保留原 UV 并试做衣褶深色。第一轮反射过强，已提高粗糙度并重渲染；程序素胎区域仍需手工修遮罩。正 / 背实渲图位于 `.local/qa/shuihu-pieces/ceramic/ls006-first-source-glaze-{front,back}.png`。

该对照保留第一版瘦长体态和旧枪形，不能称已修形；全装备包围盒仅归一至 100 mm 供检视，不是正式身体尺寸。Blender 5.2.2 全新后台进程重开可编辑源通过，文件 74,216,573 字节、实际场景与材质节点存在。材质未烘焙 / 导出 GLB，未在网页验证。该实验与新三枚 Studio 生成分开记账、分开归档。

当前交付为三枚陶塑造型试稿、实际预览及一份旧件釉面材质实验，最终风格仍待用户审阅。168 人糖塑底册 / 提示词、原版与 v2 模型均保留；未开始全员转陶瓷、正式兵器分件、图鉴或战棋接入，没有提交、推送或部署。
