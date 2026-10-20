# 悟空三维生成参考

`wukong-tripo-v01.png` 由内置 imagegen 原创生成，2026-10-19。原始文件保留在本机生成目录；此副本作为后续 Tripo 图生三维的输入，未加载进游戏，也未被当成已完成的三维资产。

SHA-256：`8E71113868BC51C76189E35506497AE9920BEAE8717A217A90AEB7C8EB01E851`。

造型要求：金丝猴面部与心形浅色面纹、金箍、赭黄色短打、青绿色衣领与裤装、虎皮围裙、朱红腰带、云头布靴；全身 A 姿，手脚和尾巴分离，背景简洁，武器另做。图片为生成输入候选；衣摆、毛发和小装饰能否转成可用网格，需生成后实际检查。

最初的 API 报价候选为 H3.1、10,000 面、默认材质、标准贴图、自动尺寸，30 API 积分；API 余额为 0，因此没有提交 API 任务。用户随后明确改用现有 Studio 会员，已于 2026-10-19 使用本图生成真实 P2.0 网格，使用一次免费试用和 10 个 Studio 积分完成 2K 贴图。

Studio 项目：`cbd1b578-ebb4-4a94-9586-55bd927b7d8a`。原始输出保留于 `../source/raw/wukong-studio-p2-source.glb`，SHA-256 `682e7b7eb3afb530bea5f3cc9a92a4fd4c5193f63ddf85e693078bb6b451e774`。原始图和模型未引入第三方游戏的角色或贴图。

已完成 Blender 修整、32 骨骼绑定与 Idle / Walk / Strike 动画，可编辑源为 `../source/wukong.blend`。运行版 `apps/website/public/games/xiyou/assets/wukong.glb` 为 878,232 字节、5,966 三角面、1K 贴图，已通过模型预算、实际动画回读和真实游戏显示/操作核验。完整复现和验收边界见 `docs/xiyou-prototype.md`。
