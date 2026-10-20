# 高老庄外景画稿

2026-10-20。统一水墨场景与平面皮影人物方向下的原创庄门、竹篱和杏树；它们是承载在真实地形上的平面布景，不是新生成的 Tripo 三维模型，也不声称古建 / 植物或原著地理的完整复原。

## 来源与完整提示词

复用已接收 Tripo Studio 建筑 `village`（`c1197061-13d8-4b1f-ae6b-5caaec529fc7`）与植被类别 `riverbank`（`42ff52bc-d6fa-4557-8d3c-afd9b8d0b62c`）原型；原始 GLB / Blender 投影和来源哈希沿用 `../ink-hamlet/projection.json`。庄门以已认可的民居画稿及 Studio 民居投影为参考，篱笆以民居画稿为笔触 / 材料参考，杏树以已认可阔叶树为直接形体 / 笔触参考。三次内置 imagegen 原创扩绘，无新 Studio 任务、积分消费、软件安装或原型覆盖。

| 资产     | 内置 imagegen 完整输入                             | 原画                                                     |
| -------- | -------------------------------------------------- | -------------------------------------------------------- |
| 高宅庄门 | [estate_gate-prompt.txt](estate_gate-prompt.txt)   | [estate_gate-source-v1.png](estate_gate-source-v1.png)   |
| 竹篱     | [bamboo_fence-prompt.txt](bamboo_fence-prompt.txt) | [bamboo_fence-source-v1.png](bamboo_fence-source-v1.png) |
| 杏树     | [apricot-prompt.txt](apricot-prompt.txt)           | [apricot-source-v1.png](apricot-source-v1.png)           |

`prepare.mjs` 仅裁去透明余量、按原比例缩放与打包，不重绘原画；树根按底部不透明像素求锚点。`packing.json` 保留各原画 SHA-256、尺寸和锚点，2048×2048 RGBA 图集保留当前开发版画质。`build.py` 经 Blender 建立三个场景，共一材质 / 一图集，输出 `../source/ink_gaolao.blend` 和运行 `ink_gaolao.glb`；每个节点保留画稿来源。

新开 Blender 的 `check.py` 核对重导入、尺寸、UV、脚下原点、原画 / 运行哈希、两份 Studio 原件与两份直接参考画稿哈希。可编辑源与原始文件保持独立，运行重建不修改 Studio 原件。

当前运行包 3,431,368 字节 / 6 三角面 / 12 顶点 / 三场景，SHA-256 `eb74c9cc61f7fcb4fb08aa7222fbf2f53343bf24f76288d16d2de12b006e55ea`。这些是文件结构，不是下载时间或怪海性能成绩。布局与真实通行 / 画面验收见 [高老庄地图记录](../../../../docs/xiyou-gaolao-map.md)，最终画稿仍需游戏镜头审阅。
