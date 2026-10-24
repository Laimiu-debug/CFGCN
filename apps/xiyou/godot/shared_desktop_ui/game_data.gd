extends RefCounted

const CONFIG = {
	"id": "xiyou",
	"series": "01 / JOURNEY TO THE WEST",
	"title": "西游记",
	"title_i18n": {
		"zh-CN": "西游记",
		"zh-TW": "西遊記",
		"en": "Journey to the West"
	},
	"tagline_i18n": {
		"zh-CN": "一念起，万水千山。",
		"zh-TW": "一念起，萬水千山。",
		"en": "Every journey begins with a single step."
	},
	"background": "res://shared_desktop_ui/assets/xiyou-background.webp",
	"figure": "res://shared_desktop_ui/assets/xiyou-figure.png",
	"gameplay_scene": "res://scenes/main.tscn",
	"probe_script": "res://scripts/main.gd",
	"actions": [
		"cfg_move_up",
		"cfg_move_down",
		"cfg_move_left",
		"cfg_move_right",
		"cfg_interact",
		"cfg_dodge",
		"cfg_party_next",
		"cfg_skill_1",
		"cfg_skill_2",
		"cfg_skill_3",
		"cfg_skill_4",
		"cfg_quick_save",
		"cfg_quick_load"
	]
}

const PALETTE = {
	"paper": "#f7f4ec",
	"paper_raised": "#f5edda",
	"ink": "#263c34",
	"muted": "#5f6c5e",
	"jade": "#37594a",
	"line": "#dcded0",
	"gold": "#a78046",
	"seal": "#4d7056",
	"xiyou": "#4d7056",
	"shuihu": "#426e78"
}

const ART = {
	"background": preload("res://shared_desktop_ui/assets/xiyou-background.webp"),
	"figure": preload("res://shared_desktop_ui/assets/xiyou-figure.png"),
	"brush": preload("res://shared_desktop_ui/assets/brush.svg")
}

const TITLE_FONTS = [
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-26-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-32-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-34-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-36-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-37-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-44-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-46-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-62-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-67-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-68-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-73-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-79-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-102-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-105-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-111-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-112-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-113-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-114-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-115-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-116-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-117-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-118-400-normal.woff2"),
	preload("res://shared_desktop_ui/assets/fonts/ma-shan-zheng-119-400-normal.woff2")
]
