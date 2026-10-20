# 低草、野花与蕨丛

2026-10-20，沿用获认可的水墨房屋 / 林木笔触。本批为三个原创低矮平面布景，不是新生成的 Tripo 三维植物，也不声称精确物种或原著地域复原。

复用已接收 Tripo Studio 松树 / 山灌木类别原型（来源及原件哈希在 `../ink-world/manifest.json`），以已认可 `ink-world/scenery-source-v2.png` 与 `ink-river/reeds-source-v1.png` 为直接笔触 / 设色参考。三次内置 imagegen 生成后保留原始 RGBA，完整提示词分别在 `grass-prompt.txt`、`flowers-prompt.txt` 与 `fern-prompt.txt`；没有新 Studio 提交、积分消费、安装软件或覆盖旧原型。

`prepare.mjs` 只裁透明余量、按原比例打包，不重绘原件；`packing.json` 保留各原图哈希、宽度、UV 与基底锚点。`build.py` 使用已有 Blender 制作三个场景 / 一材质 / 一张 2048² 图集，保留 `../source/ink_flora.blend` 与 `ink_flora.glb`。`check.py` 在新开 Blender 中重导入，核对尺寸、脚点、UV、原件 / 运行 / Studio 原件与直接参考哈希，生成 `validation.json`。

运行采用相同图集 `ink-flora.png` 与 Blender 测定尺寸，Rust 将每个地块的低矮植物合并成一个可释放网格；不为每丛建立独立场景，运行不重复加载 GLB 内的同一图集。每丛保留世界坐标、类别和尺度供探索地图使用。群落在林下 / 空地成片分布，避开田畦、水面、庭院与实体脚部；均可穿行。

地图头像 `ink-map-wukong.png` 直接裁自当前地图实际人物 `../shadow-wukong/parts-source.png` 的头部分件，原图 / 裁剪范围 / 哈希在 `map-portrait.json` 与清单中；没有用旧三维悟空肖像冒充当前皮影。

结构与来源通过不等于美术认可。实际场景、地图交互、横竖屏和剩余差距统一见 [地图标记与植被](../../../../docs/xiyou-map-marks-and-flora.md)。
