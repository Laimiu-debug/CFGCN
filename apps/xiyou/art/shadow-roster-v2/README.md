# 西游原创皮影资源：腰腹结构返工版

2026-10-20 后续反馈：用户指出八个角色的身体比例仍然相同。v2 保留为腰腹修正历史，不作为当前造型合格候选；独立头身、肩腰胯、四肢与步态返工转到 [v3](../shadow-roster-v3/README.md)。以下检查只证明当时文件与功能状态，不代表体态通过用户审阅。

2026-10-20（Asia/Hong_Kong）。包含唐僧、孙悟空、猪八戒、沙悟净、小白龙人形、狼妖、虎妖和白骨夫人，共八套资源候选。原始 v1 被用户指出“没有肚子直接就是腿”，现以 v2 补全胸、腰腹和胯部；画稿、比例、文化细节与自然步态仍待用户审阅，不将文件检查通过视作最终美术认可。

## 交付内容

每个角色的独立文件夹包含：

- `parts-source.png`：1254×1254 的原创透明分件画稿，保留原始 alpha。
- `prompt.txt`：本次修正的完整提示词；`prompt-initial.txt` / `origin-parts-source.png` 保存原始生成输入。统一风格参照另存根目录 `style-reference-wukong.png`，不覆盖旧版。
- `parts/`：16 张用于装配的分件纹理，机械裁切原画，没有程序代画。
- `woop.json` 与 `<id>.woop`：带装配矩阵、关节枢轴和层次的分件包，已实际由官方 WooooShadow 0.8.13 导入。
- `<id>.blend`：16 个可独立编辑的平面部件、16 根骨骼，图像已内嵌；保留官方材质预设作为可编辑备选，并使用保留原画 alpha 的平面预览材质。
- `<id>.glb`：一个蒙皮网格、一个材质、32 三角面、16 关节，1024×1024 运行图集。
- `preview-idle.png` / `preview-walk.png`：实际 Blender 装配后的整个人物预览。
- `manifest.json`：原画与 GLB 哈希、字节、来源、制作工具和状态。

角色索引：`tangseng` 唐僧；`wukong` 孙悟空；`bajie` 猪八戒；`shaseng` 沙悟净；`xiaobailong` 小白龙人形原创设计；`wolf` 狼妖；`tiger` 虎妖；`baigufuren` 白骨夫人原创设计。小白龙马形未在本批制作。

## 本次结构修正

人物使用 `pelvis → abdomen → body → head / arms` 的层级，大腿从胯部挂接，避免胸衣直接挂腿。腰腹分件提供完整腹部轮廓，胯部连接两侧大腿，长袍人物补足下摆。装配纹理裁去下衣重复的上腰带，叠放时由腹部承担主要腰带，防止多个腰带悬空叠在一起。部分关节枢轴位于可见分件范围之外，用重叠区隐藏连接。

动作包括 `Idle`、`Walk` 与静姿兼容用 `RestPose`。当前只有右侧与整幅镜像的左侧，不包含正面 / 背面、连续立体转身、攻击 / 受击或完整角色技能。镜像会交换持械侧与不对称衣饰；最终方向设计继续待定。

## 制作来源与运行范围

采用内置 imagegen 工具生成、修正原创画稿，以既有原创悟空为统一风格参照。实际使用作者官方 WooooShadow 0.8.13 导入器在独立 Blender 5.2.2 进程中装配，未修改全局偏好。第三方插件留在本机被 Git 忽略的 `.local/tools/wooo-shadow-0.8.13/`，本资源包不包含该插件代码、灯箱素材或作者角色库。官方来源：[工具站](https://piying.woooostudio.com/)。没有使用 Tripo 生成或消费其积分。

运行材质另用 glTF 可识别节点导出，明确编码双面、无照明颜色与 alpha 遮罩，避免把 Blender 合成效果当作已随 GLB 携带。此次资源只进入独立检视页，当前游戏地图的默认人物与存档未替换。

## 重建与验证

在仓库根目录使用现有 Blender，并把官方导入器放到上述本机路径：

```powershell
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v2/prepare.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v2/build.py
& 'F:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python apps/xiyou/art/shadow-roster-v2/check.py
```

八个 WOOP 的图像 / 关节完整性、八个 blend 的重新打开与内嵌图像、八个 GLB 的重导入、胸腹胯层级、刚性权重、32 面 / 16 骨骼、透明和动作均已检查。每个运行文件 1,039,092–1,249,600 字节，八个合计 9,013,868 字节；这是整批资源量，不是单局必须同时下载量，也不作为地图首屏预算放宽。

61 帧步行采样核查承重脚、关节变化和透明边缘；源图边框留白带来约厘米级的足底边框偏移，检查阈值 2 厘米，该测试不等同于自然步态审阅。Edge 检视页九项检查通过：八个实际 GLB 的纹理 / 骨骼 / 材质、动作播放改变实际画面、暂停冻结渲染、左右镜像、390 宽布局、减少动态默认停播及控制台无错误。该页是资源检视，不是游戏地图 / 真实手机 / 怪海性能验收。

本机检视页：<http://127.0.0.1:8875>。辅助页面与脚本留在 `.local/qa/shadow-roster-v2/`；完整证据为 `assets.json`、`browser.json`、`contact-sheet.png`、`walking-right.png`、`walking-left.png` 与 `roster-walk-turn.webm`，不会提交本机 QA 资料。

## 待审阅

用户仍需看完整站姿和行走确认躯干、体态、腰腹 / 衣摆衔接、关节圈、持械与人物气质。布料柔性、细部兵器形制、多方向、正式战斗动作与游戏接入继续分项制作；不能把本批八种资源称为全部西行角色完成，也不能沿用 v1 的结构作为最终标准。本轮没有提交、推送或部署。
