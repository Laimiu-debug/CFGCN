# 西游皮影 v6：四槽手动与五人绝技

2026-10-20。独立保留 v5 紧凑体态、完整双臂、地面施法、移动上身层和玩家独立闪避；沿用八套原生 Blender / GLB，升级五个稳定招式身份的动作与事件，没有增加角色技能总数。原图未重绘，v5 源件保留。

五人仍各十二招选四，兵器技与绝技均占槽，主控全部使用 1–4 / 四图标手动施展。伙伴按作用条件自主施法，换人、暂停与换槽不返还冷却。新方案第四式展示绝技，合法旧存档继续恢复。金箍镇岳、大乘梵音、天蓬九重耙、流沙覆海、白龙破浪的接点与试用数值见 docs/xiyou-active-skills-ui.md；不是正式平衡定稿。

8 个 GLB 含 94 个完整身体、74 个上身、32 个基础片段，共 200 个。60 主角动作、18 妖怪动作；110 项设计中另有 20 被动和 12 连携，不充当已实现的演员动作。每人源文件打包原图可独立编辑；再生成使用 author.py 及只读的 shadow-actions-v1 / v2 / shadow-roster-v4 依赖。

运行接入由 scripts/prepare-shadow-combat.mjs 提取实际 GLB 的身体 / 兵器接点并复制游戏资源；动作元数据和战斗机制从本目录读取。standees.py 从实际 GLB 导出五人完整立绘，原始骨架、画稿与各人体态保留。五张专属绝技画稿、提示词和来源在相邻 shadow-ui-v6 目录；普通动作缩图仅供模型检视。

本机游戏 http://127.0.0.1:5173/?mode=skills#/world/xiyou 。serve.mjs 可在 8883 启动模型资源检视；它的顺序演练不是实战伤害录像。

制作与检查：Blender 运行 author.py、check.py、render.py、icons.py、standees.py；系统 Python 运行 skill_book.py、stamp_integration.py、prepare_preview.py、verify_source.py 和 package.py。check.py 实测足底、握杆、骨骼分层、武器幅度和原件哈希，不能代替用户审阅姿势 / 特效 / UI。

本版仅接入五人地图演武，未将完整西行、新地图战役、正式培养与平衡、怪海或实体手机标为完成。没有使用第三方皮影插件、新 Tripo 生成或积分消费；最终体态、美术与动作仍待用户审阅。
