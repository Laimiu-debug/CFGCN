# B2战斗混音与Windows同版本发布

## 2026-10-24后续听审与包内状态

本轮包后统一交接 `.local/qa/godot-audio-b-v2/windows-audio-handoff.json`，明确仅音频通过，ZIP／完整首段／官网仍待后续候选。结束后13份原生AVI／WAV与459份已结束缓存／QA副本逐SHA处理，H逻辑清2,344,781,516字节，C0／G0、物理簇未测；完整原生PCM归FLAC且逐解码一致，最终片、代表失败视频、原件／历史／存档保持。40,584字节必要QA存档设置日志先SHA归档G再清H副本，69,187,964字节已知渲染缓存清除，不将缓存挪G冒充清理。清单 `cleanup-packages.json`／`cleanup-package-profiles.json` 位于该QA根。盘况 `disk-after-packages.json` 与 `H:/codex/storage-guard/latest.json`；C约6.46GiB只是容量预警，本批G/H输出实际成功，无写盘失败，不中断其他任务、改分页或重启。

**同日后续：西游v12音频专项已通过。** `.local/qa/godot-audio-b-v2/packages/xiyou/v12-b21-ui21-r2/audio-acceptance.json`，SHA `492f2639ed19a9a462eb6aa43464e103cd5a057f7921ad6eaaaeb54cfa3b6cb0`，28项／4个实际EXE进程。包内37件SHA同B2.1，EXE／PCK／DLL前后不变；独立实时长录首173.420秒、再循环171.020秒，两次自然完整跨界相关最低0.999975289，完整Music／Master FLAC留G。自然唐僧96.106秒实际4击杀拾光升2级、按真实卡选技；升级暂停、旧真实七蛛预警／棍／水剑、整备转场、四总线冷恢复及Master0冷继续均过。旧80秒等待和首轮并发录音PCM校验失败保持，不修改母版或规则来造通过。

西游原声声音检查 `.local/audio/godot-b-v2/windows/xiyou-v12-b21-ui21-r2-audio-check.mp4` 为122.267秒，含升级／暂停／设置／刻意静音；不是无间断宣传片或性能数据。完整主题试听同目录 `xiyou-v12-b21-ui21-r2-theme.mp3`，来自实际母版PCM，没有追加音乐或音效。主工程／UI／官网复用这一份报告；后续新包若声音／混音／菜单字节不变，复用完整循环证明，仅补新PCK身份和受影响的新Boss、热战暂停／恢复等流程。当前乌鸡国完整章、最终ZIP、高清截图与连续原声演示仍由主工程形成，音频专项不代替它们。

用户已明确“听清是‘俺’，这句可以”，采用B2.1悟空“吃俺老孙一棒！”。补充记录 `.local/qa/godot-audio-b-v2/callout-user-acceptance.json` 绑定实际WAV／原生资源SHA；只认可该句，不代替其他台词听审。不可变delivery `f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af` 保持，原humanListeningApproval=false是冻结当时记录，后来认可由补充文件表达；此后没有新增Runway消费。

水浒 `0.0.12-preview.3` 音频专项25项／4个真实EXE进程通过，报告 `.local/qa/godot-audio-b-v2/packages/shuihu/preview012-b21-r3/audio-acceptance.json`，SHA `94626b05a197cb972b2c25d35a159849f62025dcd7d77027efa7413e2bd8b369`。实际包PCK为2,402,348,032字节／SHA `e19584f16df323a8cdd23d51683790a193873a5de5a1869467fb3f6566757aee`，23件声音匹配B2.1。首159.470秒／重复157.070秒，实时完整两次自然跨界与原PCM相关最低0.999957834；四总线保存／Master0冷继续通过。实际M01正常指令第6轮完成并归报，朱贵实际战死，宋万13血53甲／杜迁78血65甲，林冲45血返回。声音检查片段59.333秒包括暂停、设置及刻意静音，不能当成无间断宣传片。

**水浒此包仍不可发布。** 主工程／共用UI随后在同包正常热战后“归报回寨→暂停”复现原生退出0xc0000005，无MovieMaker实时也复现；音频专项通过不覆盖这个故障。主工程修回寨残留战斗抽屉／隐藏HUD，共用UI源保持29dee。下一唯一固定包交来后，按实际影响复用相同资源与循环证据，补受影响归报→暂停／恢复及包内身份，不机械重复长录音。ZIP及网站下载仍阻挡。

西游v12／0.1.11.0已收到，EXE `c45e1c8cb13da66b1dbf4b7ca61cedd47ab8ea192e3e09d056cacb2e25b1a466`、PCK `44bb3cf91bb528627f7f8096f621efa73301b20651028e66b2f184de41daff9f`、DLL `c28606a2fbca755a4e576e57b70d8ffd2352e0f35d452bb5eeae17211d9628b0`，共用UI另有68项专项通过。音频第一轮旧80秒等待自然升2级不足，未改XP或敌潮造通过；观察正常新局40秒仅1次实际击杀，调整外部检查等待上限至240秒，并记录真实等级／XP／击杀／时钟。首轮菜单播放器确有两次完整跨界，但实时PCM长度／接缝校对未通过，故保留失败并独立重录，不提前宣称音频完整验收。早期initialprobe观察正常新局完成，但探针提前释放音频后退出原生崩溃，不能据此认定玩家默认流程崩溃。

当前事件覆盖与未接细项见 `docs/godot-audio-events-first-route.md`；新乌鸡国Boss声音以主工程真实事件交接为准。下文各源批／旧候选记录按历史保留。

2026-10-24。用户已采用B版音乐和音效，进一步授权纳入西游／水浒下一版Windows包，包后核循环、切换与音量；验收后官网截图、音乐试听、原声演示和下载同步更新，标清版本及真实完成范围。技能音效／人物配音继续优化，用户明确选择“战斗辨识与混音（优先）”。

## 本批声音范围

保留两首B主题与完整循环，不重新作曲。先复用现有源，对西游10条人物技能短句、经声／耙／铲3条声音做克制高低切、固定电平与边缘淡变，保留原MP3、音色身份、时长和音高。用户随后指出“砍棍”出戏，核实原稿是“看棍！”，界面实际叫“如意棍法”；仅追加重做悟空“吃俺老孙一棒！”（原Billy声线、2.16秒），新增Runway 1调用／1积分，不整批重做。活跃区RMS目标约-19dBFS，八戒普通句受-3dBFS峰值余量限制约-20.8dBFS；不将RMS称为LUFS或主观终审。水浒本次仍没有角色对白资产，不伪称补齐人物配音。

按真实 `XiyouCore.skills_json()` 核10条台词的招式绑定：悟空攻击句仅给0／3／4／9实际棍击，移除6闪身、8架棍、11护身；八戒旧大招短句误绑普通RakeVault索引8，改按真实RakePin大招索引11，普通句不再占用大招。其他角色大招标志也逐条与原生定义一致；技能ID、UI技能名称、伤害、成长和存档均不改。命名与喊招原则为对应人物／兵器／真实动作、口语自然、发音清楚、稀疏重复；来源与具体绑定见 `source/audio/godot-b-v2/callout-review.json`。新词技术接通不等于用户听审认可。

西游同一真实cast token只触发一次开招音，后续多段伤害仍按真实HP接触反馈；主控技能／受伤突出，同伴随实际距离收低，脚步降至陪衬。语音全局间隔6秒、单人10秒、同句20秒，仍最多1人同时说话。水浒出手、接触与未中继续分开，主队／敌队层次和步声更克制，材质由实际装备判定。危险、主控受伤与大招优先保留，其他技能／接触设密度预算，语音和重要提示发生时音乐及背景技能短暂让位。四个用户总线和静音偏好、暂停冻结、UI单调时间限频及退出清理保留。

音频唯一源 `packages/godot-game-audio/`。B1先冻结到 `source/audio/godot-b-v2/baseline-package/`，原B1资源和验收历史不改。B2制备输入、处理参数及新PCM／原生资源在 `source/audio/godot-b-v2/`，新资源采用带SHA文件名入库，不写原硬链接；25件未改变的原生资源核SHA后共用不可变内容。`scripts/audio-desktop-adopt/sync.py --source source/audio/godot-b-v2 --qa .local/qa/godot-audio-b-v2` 只同步音频目录、原兼容桥与autoload；不改两作主玩法、主场景或共用UI。

## 来源与实机证据

目前两作实际主工程流程分别20／17项通过，旧Lv38五人13秒原生音频回归8项通过。源工程检查与Windows包验收分开，尚不能据此将新包或官网标为已发布。

另用同一个真实Lv38五人规则实例、相同连续移动／自动出招，原B1只读导演和混音器旁路录音，与实际B2同时录制15秒。B1／B2实际开招声22／15次，B2同token重复开招0，15次完整规则状态前后只读一致，原存档SHA保持；4次普通技能密度让位单列，不作规则伤害减少或全技能覆盖。B1参考只改总线路由，原混音／导演源留存；两条原生录音保留，成对试听用同一画面和同一个Master增益，不后补音效。

第一轮旧断言要求暂停后Master全静音，与共用UI v2允许确认／取消声冲突，已保存失败证据；最终检查分别核规则、音乐、语音和非UI音效冻结，同时允许真实菜单反馈，不静掉菜单声来满足旧断言。

## 不可变交接与分工

最终 `source/audio/godot-b-v2/delivery.json` 的 `passed=true` 只代表该音频源批已经通过所列源工程／音频检查，可供两位主工程安全冻结；不代表两款游戏全部完成、独立Windows包通过或官网已发布。冻结源、每作library／资源、兼容桥、autoload及SHA必须一起读取，不能包变化中的半批目录；旧在导出v8候选保留身份，B2纳入下一明确候选。

本批交接已签成，SHA256 `db0df9c93af440a0a08d3ed52ccf3d2da03c64a95b155b7279fdf7badd215673`。冻结运行树在 `source/audio/godot-b-v2/runtime-package/{common,xiyou,shuihu}/`，delivery各作runtimeFiles给出完整路径／SHA；西游有效37件34,039,022字节、水浒23件29,109,368字节。`packages/godot-game-audio/current.json` 已指向此批，默认sync不会退回B1。两位主工程与官网原负责人已收到最终交接及当前用户发布授权。

### 本批发行采用B2.1读音修订

用户随后再次明确“吃俺老孙一棒……不是我”。原B2交接和资源保持不可变；另做独立 `source/audio/godot-b-v2-r1/delivery.json`，SHA256 `f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af`，版本B2.1。只重做悟空一条（同Billy、中文、不加excited标签、请求speed 0.95，实际1.52秒），文字严格“吃俺老孙一棒！”，不把“俺”改成“我”；本次追加1积分，B2两稿累计2积分。其余37件全局资源、B主题、混音／host／导演／桥代码均与B2同SHA，水浒声音资源全部同SHA。对应新版运行冻结树在 `source/audio/godot-b-v2-r1/runtime-package/`，`current.json` 现指B2.1，原B2仍留存作历史。

本批发行应使用B2.1；两位主工程与官网已收到新SHA，不覆盖已在制包身份。新句 `.local/qa/godot-audio-b-v2/xiyou/callout-pronunciation-r1/` 真实正常手动出棍20秒再验证5项通过、实际播1次；解码／原生触发／文字无误不冒充人耳对“俺”咬字和演绎的最终认可，delivery明确humanListeningApproval=false。试听页新增独立该稿并标候选，听样与实际包按SHA绑定。

按最新唯一分工，主工程各自负责导出及正常玩法／存档、截图和原声流程，音频负责人对其同一EXE/PCK集中跑一次完整自然循环／真实切换／四总线冷恢复，报告供共用UI与官网复用；不让三方重复录制同一声音检查。接收方须回执实际纳入包版本和SHA，不能只写已收到。后续Godot Web沿同一源另核浏览器首次播放、切回与暂停、声道音量偏好和循环／事件，当前未做Web音频验收，也不为此重开旧网页引擎流水线。

新词最终5项检查：原Lv38五人档、正常选择悟空、正常第1槽手动出棍（第30／180／330帧）、20秒内新句实际播1次、Voice原生PCM非零、原档SHA保持；不注入HP／XP／冷却。纯自动20秒先两次未覆盖普通棍击，只用定身／分身及大招，不冒称新句已触发；其轨迹保留。首轮QA脚本误用PackedByteArray.any造成脚本错误并到时退出，也保留，不算通过。最终 `.local/qa/godot-audio-b-v2/xiyou/callout-manual/` 通过。最终B1／B2同规则旁录重新跑15秒仍22／15次开招，同画面、同Master增益，无后补声音。

两首B2源工程菜单各两次完整自然跨界，四处相关最低0.9999578；全Music与Master录音无损FLAC逐PCM核对，新对照位于 `.local/audio/godot-b-v2/`。源工程整段转场／冷音量检查先于这次台词绑定修改；最终库另经原生技能表、重新五人旁录和真实手动出棍验证，混音器／host／导演代码保持同SHA。包内仍需独立完整循环和转场／音量验收。

两位主工程各自负责实际已完成范围的Windows预览包、原玩法／成长／存档兼容与代表流程，不等待全库或全部关卡制作完才提供预览，也不把预览标为正式完整游戏。官网负责人沿 `docs/website-desktop-showcase-quality.md` 接同一构建身份的四类材料，再做本地与公网验核后发布。音频本聊天核交接与包内证据，继续承担技能／人物声音改进。三方已依用户及既有项目协作授权通知，通知不算交付／发布完成。

## 独立Windows包音频检查接口

用该包自己的EXE及同名相邻PCK，经真实默认 `desktop_boot.tscn` 已有的 `--desktop-qa=` 用户参数加载外部 `scripts/audio-desktop-adopt/package_entry.gd`（Node）。不替换默认入口／PCK，也不把QA脚本打进玩家ZIP。给环境变量 `CFGCN_AUDIO_DRIVER_SCRIPT` 指向本机冻结的 `loop.gd`／`cold.gd`／`integration.gd` 等；wrapper先逐项核PCK实际23／37音频资源SHA和B2.1库，再运行专项。QA源码需要的政策脚本来自同一冻结PCK或明确外部QA源，不擅改正式包。

CLI形态：`<实际EXE> --log-file <G日志> --write-movie <H临时目录/native.avi> --fixed-fps 30 -- --desktop-qa=<package_entry.gd绝对路径>`，cwd为该发行包目录。使用 `scripts/audio-desktop-adopt/package_run.py`，始终隔离H盘的APPDATA／LOCALAPPDATA／TEMP、CFGCN_DESKTOP_PROFILE_DIR、CFGCN_SHUIHU_USER_DIR等，并记录EXE/PCK/ZIP运行前后SHA。正式release模板禁用了`--path`覆盖；第一轮v7工具可行性探测已明确复现此错误，旧建议的`--path --script`形态作废，不能据此换编辑器冒充EXE。改用默认壳原有hook后v7实际EXE/PCK的外部Node／Movie Maker三帧探测成功，EXE/PCK SHA保持；此探测只确认入口能力，不作B2包验收。原启动器无QA参数的默认菜单／继续／操作仍由主工程另验，外部脚本不代替玩家正常启动。

`loop.gd` 从真实菜单持续跑到两次自然完整跨界，不seek／改音高；音乐首次173.420／159.470秒、循环171.020／157.070秒，源PCM与B1相同。记录独立EXE帧／音频位置、原生Music录音、非零PCM及接缝。使用原生MovieMaker须GPU，固定FPS电影不作实时FPS或长时内存证明。`cold.gd` 两进程依次验证0.73／0.28／0.61／0.37保存、Master0冷启动继续和恢复；`ui.gd` 验证暂停菜单连续确认及四总线。普通／Boss或任务战、实际战后／整备的1.6秒转场需有真实事件／原声录像。

每作至少交版本／渠道／文件名／大小／SHA、启动器与EXE实跑、存档兼容、已完成范围／未完成项，以及同版本真实截图、原声演示与试听来源。官网播放与主站背景音乐互斥，媒体Range、实际公网下载大小／SHA和网页版本一致性通过才标已上线。既有网站／其他游戏／GongPro／VPN／计量保护状态由官网原流程核查，未验收的最新地图／Boss／人物不混入已完成描述。

正式源／构建／必要QA实际G，通用暂存和缓存H，20／10GiB仅预警。保留唯一原件、历史、数据库、未知下载及他人作业；本批结束逐SHA清自己的过程文件。固定盘况 `H:/codex/storage-guard/latest.json`。

## 首份水浒Windows候选的实际拒收证据

收到0.0.12-preview.1，目录 `.local/builds/shuihu-godot-preview-012-b21/`；EXE SHA `d34d36f3be1a6c49c56525ae86469b92e4f417ddf0b43cf00dd80c385c4b0562`，PCK 1,205,511,324字节／SHA `525293e600d90959c45188190c2288607f2f858923f8a35f584823ab772a83e0`。实际EXE默认壳及PCK读取23件音频SHA全部同B2.1，菜单与初段四音量检查通过；正常新局虽可进寨中，M01不可出征。

两次正常新局、实际missions画面及只读assetprobe证实：mission_ready=false，地图未接纳；7张地图及3个初始人物的raw GLB均ResourceLoader.exists=true，但FileAccess.file_exists=false、SHA空。导出有转换资源而未保留运行期SHA验证需要的原字节，原案页退回“战场仍在接入”。音频批未跳过来源门槛或篡改任务，已交主工程修正式导出；旧.1标拒收。详见 `.local/qa/godot-audio-b-v2/packages/shuihu/preview012-b21/acceptance.json`、campnav／assetprobe及missions.png。主工程已报告独立.2修订，另共用UI v2.1修英文130%暂停标题；等待两项收口后的最终固定候选再统一验收。

旧.1离线Movie Maker循环在361秒墙钟仅形成47.86秒影片，工具超时，未得完整循环通过；不把捕获速度问题说成音乐循环故障。最终完整自然回环采用实际EXE实时AudioEffectRecord，Music和Master整段录两次自然跨界；真实战斗转场另录原声。各段时长、包身份和是否固定FPS明确记录，三方复用一次报告，不为中间候选反复录长循环。

源批30份已知H盘原生影片／WAV过程文件逐SHA确认，声音全部转FLAC且逐解码PCM一致、最终实机视频／原件／历史／报告／截图／存档保持后，清4,798,399,220逻辑字节（C0/G0/H4,798,399,220；物理簇未测）。清单 `.local/qa/godot-audio-b-v2/cleanup.json`；当前Windows专项临时根 `H:/codex/tmp/cfgcn-audio-packages`未纳入该次清理。盘况已更新固定入口。


## GitHub源码白名单（2026-10-24）

音频源码提交范围逐文件列于 `docs/manifests/godot-audio-b21-github.json`，每项记录原始工作区字节SHA256和大小。公共5份运行源及两作清单内71份运行文件本次只读核SHA仍与B2.1冻结一致；当前文档、生成器／专项QA和试听页源码另按本次快照钉住，不冒称它们都在原delivery哈希内。短声音只收36份去重原生资源（4,013,013字节），两首音乐原生资源30,039,055／27,713,451字节及原母版、录像、Windows包、.local、玩家档、缓存和凭据不纳入。主工程／共用UI／官网代码仍由各自负责人交白名单，生成的两作运行副本和旧声音残留不整目录提交。

该范围用于源码追溯，不是完整可克隆运行的游戏包。运行需Godot 4.7.2及两作主工程／规则桥；Python专项本机使用3.13.15、NumPy和imageio-ffmpeg／FFmpeg，工具中的H盘Godot路径、.local工具路径及历史QA夹具需另配。试听页沿现有React／Vite 8.3.4工作区、@cfgcn/ui和Noto字体，Node要求沿根package.json的>=22.12.0。现有sync.py仍需要被排除的.local/qa前置快照和未纳Git的完整声音来源，不能在干净克隆直接当CI或自动再生成，也不能把玩家存档补进Git来满足测试。复用已完成的西游28／水浒25项实际候选音频检查，本次不重跑整套验收、不导包、不再生成、不执行提交或推送；新Boss事件及修订包受影响流程继续按原分工补验。

本轮另查明根级text=auto/eol=lf会改变20项列举文本，包括冻结delivery.json和部分mixer／library。新增五个局部.gitattributes：公共音频、两套音频工具、B2.1冻结源目录保持原字节，docs仅点名三份音频文档和本白名单；不改变根规则或其他业务文件。提交时这五项配置必须和白名单同批进入，避免克隆后冻结SHA失配。运行代码／音乐／音效／旧delivery没有修改。
