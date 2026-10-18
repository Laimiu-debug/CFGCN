# 原创场景素材与生成提示词

生成日期：2026-10-18（Asia/Taipei）。使用内置 imagegen，非 CLI/API 回退。四幅图各自一次生成，无参考站图像输入，非透明背景。

生成结果均为 1672 × 941 PNG，原文件保留于本机生成目录，并复制到被忽略的 `.local/art-originals/`。项目使用 WebP，`scripts/prepare-art.mjs` 只进行编码压缩与卡片尺寸转换，不改变画面内容。

## 项目素材

| 世界 | 场景图                                 | 卡片图              | 场景图大小  | 卡片图大小  |
| ---- | -------------------------------------- | ------------------- | ----------- | ----------- |
| 西游 | `apps/website/public/art/xiyou.webp`   | `xiyou-card.webp`   | 309132 字节 | 79998 字节  |
| 水浒 | `apps/website/public/art/shuihu.webp`  | `shuihu-card.webp`  | 278368 字节 | 74302 字节  |
| 三国 | `apps/website/public/art/sanguo.webp`  | `sanguo-card.webp`  | 339498 字节 | 87128 字节  |
| 红楼 | `apps/website/public/art/honglou.webp` | `honglou-card.webp` | 364916 字节 | 101326 字节 |

卡片图宽 800 像素。插画用于当前视觉样板，不代表游戏内 3D 模型或实际运行截图。

## 完整提示词组合

每次调用使用以下公共提示词，再以换行拼接 `Scene: ` 与对应场景文本。

### 公共提示词

```text
Use case: stylized-concept. Asset type: original illustrated environment for a polished Chinese Four Great Classical Novels browser-game portal. Wide landscape composition, cinematic 16:9. Art direction: elegant Eastern storybook painting blended with tactile, softly sculpted miniature 3D environments; painterly foliage, layered atmospheric depth, tiny architectural details, a real sense of a world to explore. Restrained, harmonious natural color, subtle fine grain, gentle light, sophisticated composition. No interface, no frames, no letters, no text, no watermark. No assets or characters from existing modern games. Keep the left third quiet, airy and softly misty so live website typography can be overlaid. Main environmental landmarks on the right and in the lower half. A full scene that reaches all four edges.
```

### xiyou

```text
Journey to the West: tranquil jade-green mountains floating above a sea of pale clouds, weathered stone steps winding up from a river toward a tiny ancient Chinese temple, a sunlit gnarled pine on a rocky peak, warm pale golden sunrise. An almost imperceptible tiny lone traveler in vermilion at the far end of the path, seen from very far away; emphasize the majestic landscape and inviting adventure, no large characters.
```

### shuihu

```text
Water Margin: a quiet blue-green Liangshan lake at dawn with soft reeds in the foreground, rugged pine islands and an ancient timber mountain stronghold on the right cliff, a small traditional wooden boat on still water, distant blue mountains fading in mist. Deep teal and desaturated green balanced with warm ivory dawn sky. A welcoming heroic world, no people in close-up.
```

### sanguo

```text
Romance of the Three Kingdoms: panoramic ancient Chinese river valley, an imposing but elegant walled fortress and gatehouse on right of frame, weathered banners catching the wind, golden late-autumn trees, layered ochre mountains, an immense calm river winding into luminous atmospheric haze. Quiet grandeur, strategy and history, no war, no violence, no large characters.
```

### honglou

```text
Dream of the Red Chamber: a poetic classical Chinese garden at morning, pink magnolia and delicate peach blossom over a moon gate, an elegant red-walled pavilion on the right reflected in a small jade pond, willow foliage, stepping stones, petals, distant garden rooflines. Muted dusty rose, sage green, warm ivory. Intimate and literary with tactile miniature architecture, no large characters.
```

## 字体

Noto Serif SC Variable 与 Noto Sans SC Variable 通过 Fontsource 自托管，使用 SIL Open Font License。许可证副本在 `apps/website/public/licenses/`，随静态构建分发。参考网站的图片、角色、模型和代码未随产品发布。
