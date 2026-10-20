# 黑风山寺院与洞口水墨布景

2026-10-20，地图优先阶段。五幅原创画稿沿用已认可民居的笔触、黛瓦、淡设色与木石质感：山门、正殿、钟亭、闭合石门洞口和低院墙。它们是可运行地图的平面布景，不是完整寺院室内或洞府系统，也不声称古建复原。

## 来源与工具

- 建筑形体参考为已接收 Tripo Studio 神龛 / 建筑原型，项目 `c059207d-1ab2-42d2-9b18-8cd9ade0dcd9`，Blender 投影和运行源哈希见 `../ink-landmarks/projection.json`；山石体量参考见 `../ink-world/projection-sources.json` 与 `studio-projections.png`。原型不改写，神龛玩法不恢复。
- 直接风格参考是 `../ink-hamlet/house-source-v1.png`；五张接入画稿由六次内置 imagegen 产出，保留 alpha 原件与完整提示词。院墙 v1 斜向脚线不适配，已通过工具修成水平脚线 v2，v1 仅保留为过程。没有新 Studio 生成、积分消费、充值或软件安装，不把新画稿写成 Tripo 新三维生成。
- `prepare.mjs` 仅裁透明边、缩放和打包 2048×3072 RGBA 图集，不做语义重绘或减色。每幅原画哈希、根部锚点、真实尺寸及图集哈希见 `packing.json`。院墙在 Blender 的实际高度为 1.8 米，保持低院墙用途。
- `build.py` 用 Blender 制作五个场景、一材质、一图集的 `ink_heifeng.glb`，保存可编辑 `../source/ink_heifeng.blend`。`check.py` 在新 Blender 重导入并核对五个场景、尺寸、UV、脚点与哈希。
- 地图缩图由 `../ink-settlement/prepare-map.mjs` 从同一原画生成，增至 19 个图形、512×640。缩图哈希进入前端资源 URL，防止版本更新后浏览器仍显示旧图集。

| 画稿 | 完整提示词                                                                               | 原件                                                       |
| ---- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 山门 | [temple_gate-prompt.txt](temple_gate-prompt.txt)                                         | [temple_gate-source-v1.png](temple_gate-source-v1.png)     |
| 正殿 | [temple_hall-prompt.txt](temple_hall-prompt.txt)                                         | [temple_hall-source-v1.png](temple_hall-source-v1.png)     |
| 钟亭 | [bell_pavilion-prompt.txt](bell_pavilion-prompt.txt)                                     | [bell_pavilion-source-v1.png](bell_pavilion-source-v1.png) |
| 洞口 | [sealed_cave-prompt.txt](sealed_cave-prompt.txt)                                         | [sealed_cave-source-v1.png](sealed_cave-source-v1.png)     |
| 院墙 | [court_wall-prompt.txt](court_wall-prompt.txt)、[返工提示词](court_wall-edit-prompt.txt) | [court_wall-source-v2.png](court_wall-source-v2.png)       |

本批运行包 4,643,172 字节，10 三角面 / 20 顶点 / 五场景 / 五基本图元，无骨骼和动画，SHA-256 `f0ac2d4b34338dc56fde4f1bf3ff0a4a00583c9df36904539a0b2225f8bd47b7`。当前开发版按用户要求优先画面，不依旧首屏 1.5 MB 压缩新画稿；这些文件结构记录不是性能结论。

布局 / 碰撞及真实画面见 [黑风山地图](../../../../docs/xiyou-heifeng-map.md)。画稿来源、提示词、Studio 原型与最终 Blender 源分别保留，不将图集导出通过当作用户视觉认可。
