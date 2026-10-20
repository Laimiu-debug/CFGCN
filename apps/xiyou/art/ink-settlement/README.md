# 村居与林木扩充

2026-10-20，沿用用户认可的民居 / 柳树画风，制作三种房屋、两种树木变体。它们是游戏内平面水墨布景，真实地形、墙脚 / 树根和遮挡仍在世界坐标中运行；不声称古建或植物学复原。

## 来源与重建

- 代表类别来源沿用已接收 Tripo Studio `village`（`c1197061-13d8-4b1f-ae6b-5caaec529fc7`）与 `riverbank`（`42ff52bc-d6fa-4557-8d3c-afd9b8d0b62c`），原始 GLB、Blender 投影和来源哈希仍在 `../ink-hamlet/projection.json`。新图的直接风格参考是已接收的 `house-source-v1.png` / `willow-source-v1.png`；没有再次提交 Studio 生成、消费积分、安装软件或改写原模型。
- `cottage`、`mountain_house`、`riverside_house`、`elm`、`bamboo` 各有独立的 `*-source-v1.png` 和 `*-prompt.txt`。原件来自五次内置 imagegen 透明图生成，保留原始像素；不是 Tripo 直接输出了新的茅舍、榆树或竹林三维模型。
- `prepare.mjs` 只裁透明边、缩放与打包，保留每张原画 SHA-256、根部锚点、真实尺寸和图集哈希。当前开发版按用户要求不为旧启动预算减色 / 压缩画质：2048×3072 RGBA 图集，没有索引色量化。
- `build.py` 在 Blender 建立五个场景，共一张图集和一个材质，保存 `../source/ink_settlement.blend` 与运行 `ink_settlement.glb`。`check.py` 用新开的 Blender 重导入核对五个场景、尺寸、UV、透明模式、根部和原画 / 运行哈希。
- `prepare-map.mjs` 从真实场景画稿生成 `ink-map-symbols.png`，包含树石、房屋和四处地标；地图使用这些插画，避免用单字或抽象路线替代实际物件。裁切来源记录在 `map-symbols.json`。

当前运行包：8,179,820 字节，10 三角面，20 顶点，五场景 / 五基本图元 / 一材质 / 一图集，SHA-256 `e5ceb258283bb684a35ca683b60d0c8e2bc7c281588b562fbcb1a2f2cb0b3f2e`。这仅是文件结构记录，不是怪海或手机性能结论。完整提示词为本目录五份文本；内置 imagegen 是画稿工具，Blender 是可编辑布景与导出工具。

| 画稿     | 完整提示词                                               | 保存原件                                                       |
| -------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 茅舍     | [cottage-prompt.txt](cottage-prompt.txt)                 | [cottage-source-v1.png](cottage-source-v1.png)                 |
| 双层木楼 | [mountain_house-prompt.txt](mountain_house-prompt.txt)   | [mountain_house-source-v1.png](mountain_house-source-v1.png)   |
| 错落瓦舍 | [riverside_house-prompt.txt](riverside_house-prompt.txt) | [riverside_house-source-v1.png](riverside_house-source-v1.png) |
| 阔叶树   | [elm-prompt.txt](elm-prompt.txt)                         | [elm-source-v1.png](elm-source-v1.png)                         |
| 竹丛     | [bamboo-prompt.txt](bamboo-prompt.txt)                   | [bamboo-source-v1.png](bamboo-source-v1.png)                   |

布局见 `packages/game-core/data/xiyou-map-layout.json`。新增 27 栋房屋，连同原两舍共 29 栋，分布于首四区；五种林木形体通过手工林群与确定性群落复用。原屋、柳树和 Studio 原件保持不变。没有新增室内、居民、互动种植或建筑经营功能。实现、测试与实际截图归入 [自由探索地图](../../../../docs/xiyou-exploration-map.md)。
