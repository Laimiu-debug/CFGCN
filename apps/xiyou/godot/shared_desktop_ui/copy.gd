extends RefCounted

const TEXT = {
	"zh-CN": {
		"import": "导入存档文件", "continue": "继续游戏", "new_game": "开始新旅", "load": "读取存档", "settings": "系统设置",
		"credits": "制作信息", "quit": "退出游戏", "resume": "继续旅程", "save": "保存进度",
		"main_menu": "返回主菜单", "pause": "稍作歇息", "loading": "山河将启",
		"preparing":"资源已载入，正在准备场景", "loading_detail": "正在准备旅程", "loaded": "准备就绪", "retry": "重试", "back": "返回",
		"display": "画面", "audio": "声音", "controls": "操作", "interface": "界面",
		"window_mode": "显示模式", "windowed": "窗口", "borderless": "无边框全屏", "fullscreen": "独占全屏",
		"resolution": "窗口分辨率", "vsync": "垂直同步", "fps": "帧率上限", "unlimited": "不限",
		"master": "总音量", "music": "音乐", "effects": "音效", "voice": "配音",
		"locale": "界面语言", "ui_scale": "界面字号", "reduced_motion": "减少动态效果",
		"apply": "应用并保存", "cancel": "取消更改", "defaults": "恢复默认", "pending": "有尚未保存的更改",
		"saved": "设置已保存", "save_ok": "进度已保存", "settings_recovery": "原设置暂无法读取，已保留原文件；当前使用可用设置。",
		"save_failed": "保存失败，原有数据仍保留", "loading_failed": "这段旅程暂未展开，请重试或返回主菜单",
		"no_save": "尚无可继续的进度", "choose_save": "选择存档", "save_empty": "尚无可读取的存档",
		"new_confirm": "开启新的旅程？", "new_warning": "已有进度将由游戏按存档规则另存或替换。请先保留需要的进度。",
		"start": "启程", "keep_display": "显示效果是否正常？", "keep": "保持设置", "revert": "还原显示",
		"revert_countdown": "%d 秒后自动还原", "press_key": "按下新的按键，Esc 取消",
		"key_conflict": "此按键已有用途，请换一个", "key_reserved": "请使用单个普通键，Esc 与 Tab 保留给菜单",
		"move_up": "向前 / 向上", "move_down": "向后 / 向下", "move_left": "向左", "move_right": "向右",
		"interact": "交互", "dodge": "闪避", "party_next": "切换角色", "skill_1": "技能一", "skill_2": "技能二",
		"skill_3": "技能三", "skill_4": "技能四", "end_turn": "结束回合", "quick_save": "快速保存", "quick_load": "快速读取",
		"menu_hint": "Esc 返回 · 方向键选择 · Enter 确认", "game_hint": "Esc 菜单",
		"paused_other": "当前游戏仍需完成原有选择，返回后继续处理",
		"credits_text": "四大名著 · 东方绘本\n原有水墨、皮影、陶塑、音乐与制作来源继续保留。\nMa Shan Zheng 字体使用 SIL Open Font License。",
		"local_save": "本机进度", "unavailable": "当前进度暂不支持此操作", "unsaved_back": "当前进度无法保存。仍要离开吗？尚未保存的变化将丢失。"
	},
	"zh-TW": {
		"import":"匯入存檔檔案","continue":"繼續遊戲","new_game":"開始新旅","load":"讀取存檔","settings":"系統設定","credits":"製作資訊",
		"quit":"離開遊戲","resume":"繼續旅程","save":"儲存進度","main_menu":"返回主選單","pause":"稍作歇息",
		"preparing":"資源已載入，正在準備場景","loading":"山河將啟","loading_detail":"正在準備旅程","loaded":"準備就緒","retry":"重試","back":"返回",
		"display":"畫面","audio":"聲音","controls":"操作","interface":"介面","window_mode":"顯示模式",
		"windowed":"視窗","borderless":"無邊框全螢幕","fullscreen":"獨佔全螢幕","resolution":"視窗解析度",
		"vsync":"垂直同步","fps":"幀率上限","unlimited":"不限","master":"總音量","music":"音樂","effects":"音效","voice":"配音",
		"locale":"介面語言","ui_scale":"介面字級","reduced_motion":"減少動態效果","apply":"套用並儲存",
		"cancel":"取消變更","defaults":"恢復預設","pending":"有尚未儲存的變更","saved":"設定已儲存","save_ok":"進度已儲存",
		"no_save":"尚無可繼續的進度","choose_save":"選擇存檔","save_empty":"尚無可讀取的存檔",
		"start":"啟程","new_confirm":"開啟新的旅程？","new_warning":"既有進度將由遊戲依存檔規則另存或取代，請先保留需要的進度。",
		"keep_display":"顯示效果是否正常？","keep":"保留設定","revert":"還原顯示","revert_countdown":"%d 秒後自動還原",
		"press_key":"按下新的按鍵，Esc 取消","key_conflict":"此按鍵已有用途，請換一個",
		"key_reserved":"請使用單一普通鍵，Esc 與 Tab 保留給選單",
		"move_up":"向前 / 向上","move_down":"向後 / 向下","move_left":"向左","move_right":"向右","interact":"互動",
		"dodge":"閃避","party_next":"切換角色","skill_1":"技能一","skill_2":"技能二","skill_3":"技能三","skill_4":"技能四",
		"end_turn":"結束回合","quick_save":"快速儲存","quick_load":"快速讀取","menu_hint":"Esc 返回 · 方向鍵選擇 · Enter 確認",
		"game_hint":"Esc 選單","local_save":"本機進度","unavailable":"目前進度暫不支援此操作",
		"loading_failed":"這段旅程暫未展開，請重試或返回主選單","save_failed":"儲存失敗，原有資料仍保留",
		"settings_recovery":"原設定暫無法讀取，已保留原檔；目前使用可用設定。",
		"paused_other":"遊戲仍需完成既有選擇，返回後繼續處理","unsaved_back":"目前進度無法儲存。仍要離開嗎？尚未儲存的變更將遺失。",
		"credits_text":"四大名著 · 東方繪本\n既有水墨、皮影、陶塑、音樂與製作來源持續保留。\nMa Shan Zheng 字體使用 SIL Open Font License。"
	},
	"en": {
		"import":"Import save file","continue":"Continue","new_game":"New journey","load":"Load game","settings":"Settings","credits":"Credits","quit":"Quit game",
		"resume":"Resume","save":"Save progress","main_menu":"Main menu","pause":"Paused","loading":"The journey awaits",
		"preparing":"Resources loaded. Preparing the scene.","loading_detail":"Preparing your journey","loaded":"Ready","retry":"Try again","back":"Back",
		"display":"Display","audio":"Audio","controls":"Controls","interface":"Interface","window_mode":"Display mode",
		"windowed":"Windowed","borderless":"Borderless fullscreen","fullscreen":"Exclusive fullscreen","resolution":"Window resolution",
		"vsync":"VSync","fps":"Frame limit","unlimited":"Unlimited","master":"Master volume","music":"Music","effects":"Sound effects","voice":"Voice",
		"locale":"Language","ui_scale":"Interface text size","reduced_motion":"Reduce motion","apply":"Apply & save",
		"cancel":"Discard changes","defaults":"Restore defaults","pending":"Changes have not been saved","saved":"Settings saved","save_ok":"Progress saved",
		"settings_recovery":"The original settings were retained. Using the last readable settings.",
		"save_failed":"Could not save. Previous data was retained.","loading_failed":"The journey could not be opened. Retry or return to the menu.",
		"no_save":"No progress to continue yet","choose_save":"Choose a save","save_empty":"No readable saves yet",
		"new_confirm":"Begin a new journey?","new_warning":"The game will archive or replace existing progress according to its save rules. Keep a backup if needed.",
		"start":"Begin","keep_display":"Is the display working correctly?","keep":"Keep settings","revert":"Revert display",
		"revert_countdown":"Reverting in %d seconds","press_key":"Press a new key; Esc cancels","key_conflict":"That key is already assigned",
		"key_reserved":"Use a single key. Esc and Tab are reserved for menus.",
		"move_up":"Move forward / up","move_down":"Move backward / down","move_left":"Move left","move_right":"Move right",
		"interact":"Interact","dodge":"Dodge","party_next":"Next companion","skill_1":"Skill 1","skill_2":"Skill 2",
		"skill_3":"Skill 3","skill_4":"Skill 4","end_turn":"End turn","quick_save":"Quick save","quick_load":"Quick load",
		"menu_hint":"Esc back · Arrow keys select · Enter confirm","game_hint":"Esc Menu","local_save":"Local progress",
		"unavailable":"This action is not available for the current state","paused_other":"Complete the game's pending choice after returning.",
		"unsaved_back":"Progress cannot be saved right now. Leave and lose unsaved changes?",
		"credits_text":"Four Classics · Illustrated Worlds\nExisting ink paintings, shadow puppets, ceramic art, music and sources are retained.\nMa Shan Zheng is licensed under the SIL Open Font License."
	}
}

const DETAIL = {
	"zh-CN": {"settings_intro":"照你的习惯，安排行旅。", "display_help":"设置窗口、同步与帧率上限。", "audio_help":"各类声音分别调节，随时预览。", "controls_help":"选择按键后重新绑定；Esc 取消，Tab 切换。", "interface_help":"调整语言与文字大小，也可减少动态效果。", "on":"已开启", "off":"已关闭", "load_assets":"01  载入资源", "load_prepare":"02  准备场景", "save_empty_hint":"保存进度后，可在这里继续旅程。"},
	"zh-TW": {"settings_intro":"照你的習慣，安排行旅。", "display_help":"設定視窗、同步與幀率上限。", "audio_help":"各類聲音分別調整，隨時預覽。", "controls_help":"選擇按鍵後重新綁定；Esc 取消，Tab 切換。", "interface_help":"調整語言與文字大小，也可減少動態效果。", "on":"已開啟", "off":"已關閉", "load_assets":"01  載入資源", "load_prepare":"02  準備場景", "save_empty_hint":"儲存進度後，可在這裡繼續旅程。"},
	"en": {"settings_intro":"Make the journey your own.", "display_help":"Choose your window, sync and frame limit.", "audio_help":"Balance each sound with a live preview.", "controls_help":"Select a binding to change it. Esc cancels; Tab moves focus.", "interface_help":"Choose language, text size and reduced motion.", "on":"On", "off":"Off", "load_assets":"01  Loading resources", "load_prepare":"02  Preparing scene", "save_empty_hint":"Save your progress to continue it here."}
}

static func text(key: String, locale: String) -> String:
	if key == "unsaved_journey": return {"zh-CN":"当前旅程尚未保存", "zh-TW":"目前旅程尚未儲存", "en":"This journey has not been saved yet."}.get(locale, "当前旅程尚未保存")
	if DETAIL.get(locale, DETAIL["zh-CN"]).has(key): return str(DETAIL.get(locale, DETAIL["zh-CN"])[key])
	return str(TEXT.get(locale, TEXT["zh-CN"]).get(key, TEXT["zh-CN"].get(key, key)))
