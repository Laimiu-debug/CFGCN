extends RefCounted

const CONFIG = {
	"id": "shuihu",
	"series": "02 / WATER MARGIN",
	"title": "聚义梁山",
	"title_i18n": {
		"zh-CN": "聚义梁山",
		"zh-TW": "聚義梁山",
		"en": "Water Margin"
	},
	"tagline_i18n": {
		"zh-CN": "江湖路远，幸有同袍。",
		"zh-TW": "江湖路遠，幸有同袍。",
		"en": "A wide world. A company of companions."
	},
	"background": "res://shared_desktop_ui/assets/shuihu-background.webp",
	"figure": "res://shared_desktop_ui/assets/shuihu-figure.webp",
	"gameplay_scene": "res://shared_desktop_ui/gameplay.tscn",
	"gameplay_scene_source": "shuihu-gameplay.tscn",
	"probe_script": "res://scripts/battle_app.gd",
	"start_modes": {
		"new": "new_game"
	},
	"preload_resources": [
		"res://assets/river.glb"
	],
	"actions": [
		"cfg_move_up",
		"cfg_move_down",
		"cfg_move_left",
		"cfg_move_right",
		"cfg_end_turn",
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
	"background": preload("res://shared_desktop_ui/assets/shuihu-background.webp"),
	"figure": preload("res://shared_desktop_ui/assets/shuihu-figure.webp"),
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
