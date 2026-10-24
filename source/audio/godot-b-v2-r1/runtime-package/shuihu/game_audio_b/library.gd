extends RefCounted

const META = {
	"game": "shuihu",
	"version": "B2.1",
	"actorAssets": [],
	"speechPolicy": {
		"actor_gap_seconds": 10.0,
		"global_gap_seconds": 6.0,
		"max_new_cast_age_seconds": 0.24,
		"maximum_simultaneous_speakers": 1.0,
		"repeat_clip_gap_seconds": 20.0
	},
	"assets": [
		{
			"id": "music-shuihu",
			"path": "res://game_audio_b/assets/music-shuihu.res",
			"sha256": "0a96f622fbea894b2e0540612c6f15e15cfa32b16c0599fdff04fa0904e5a62b",
			"bytes": 27713451,
			"kind": "music"
		},
		{
			"id": "staff-air",
			"path": "res://game_audio_b/assets/staff-air.res",
			"sha256": "fadeb8fa82e3d48260410e38d86a189b6fc2c23d17583e0475322ced3d946403",
			"bytes": 75212,
			"kind": "effect"
		},
		{
			"id": "staff-body",
			"path": "res://game_audio_b/assets/staff-body.res",
			"sha256": "4fa61a4cbb013b6a33439476a01acfe5f69ca7b01d2dd479402d9cb3d0b0ae0e",
			"bytes": 98931,
			"kind": "effect"
		},
		{
			"id": "blade-armor",
			"path": "res://game_audio_b/assets/blade-armor.res",
			"sha256": "7e04493246ea3df39ee6540fc48efa77aeb72accbe2e00f67d74cf203bb74727",
			"bytes": 176416,
			"kind": "effect"
		},
		{
			"id": "shield-block",
			"path": "res://game_audio_b/assets/shield-block.res",
			"sha256": "ca3563169283faba14587ac5511a82049cef81d9bb221ee5885ac371bf961921",
			"bytes": 189769,
			"kind": "effect"
		},
		{
			"id": "water-jian",
			"path": "res://game_audio_b/assets/water-jian.res",
			"sha256": "1baf5479fcc4aa74704d413aebf80532e31509c6d326a5cba17cce5af8295bce",
			"bytes": 177305,
			"kind": "effect"
		},
		{
			"id": "bow-release",
			"path": "res://game_audio_b/assets/bow-release.res",
			"sha256": "1dd5451a5234837a08d09484ee719d545f53db6495a61afd921cdd326e6cf78a",
			"bytes": 97867,
			"kind": "effect"
		},
		{
			"id": "danger-wood",
			"path": "res://game_audio_b/assets/danger-wood.res",
			"sha256": "219c0df169c17d7ca8108dddf27ba85d94afcf81bca3b06ec3fc7b7102312846",
			"bytes": 120451,
			"kind": "effect"
		},
		{
			"id": "wound-cloth",
			"path": "res://game_audio_b/assets/wound-cloth.res",
			"sha256": "63f8810b4fbc08e4f1e7172d4a22f627030008b4e34d931ec2be4d2168c3f073",
			"bytes": 81637,
			"kind": "effect"
		},
		{
			"id": "defeat",
			"path": "res://game_audio_b/assets/defeat.res",
			"sha256": "ad6eef1897890a3e68762ce7691af01d009047a92503e7366b1040e03a751ade",
			"bytes": 69946,
			"kind": "effect"
		},
		{
			"id": "footstep-earth",
			"path": "res://game_audio_b/assets/footstep-earth.res",
			"sha256": "149839903e578c441f81d9ca183b02ac62692b557d111605841c15d86cd2c0e1",
			"bytes": 10772,
			"kind": "effect"
		},
		{
			"id": "footstep-stone",
			"path": "res://game_audio_b/assets/footstep-stone.res",
			"sha256": "ee405ec8dab6db58fae7d67a6632b13cd7d947a7b2f81dacffeb339afc04250d",
			"bytes": 9820,
			"kind": "effect"
		},
		{
			"id": "ink-spell",
			"path": "res://game_audio_b/assets/ink-spell.res",
			"sha256": "094fd29e9d8e045c94f223c95e6b278baeb25685c75461f02cabfeb3984819da",
			"bytes": 34502,
			"kind": "effect"
		},
		{
			"id": "metal-impact",
			"path": "res://game_audio_b/assets/metal-impact.res",
			"sha256": "6f70fd4ac863049b517c885abc548aa95c5dcec433f58ee37f003a0c333d4265",
			"bytes": 27203,
			"kind": "effect"
		},
		{
			"id": "pickup",
			"path": "res://game_audio_b/assets/pickup.res",
			"sha256": "ceedad46422fde379291f71a0de99e8bca167e7ada6ad9d4b62f6d0d87421c7f",
			"bytes": 27927,
			"kind": "effect"
		},
		{
			"id": "piece-place",
			"path": "res://game_audio_b/assets/piece-place.res",
			"sha256": "8b33bc3cc7bc8eb5a47e108817df988923bc47be1efd5b6940d6e7a8af09fc1a",
			"bytes": 11569,
			"kind": "effect"
		},
		{
			"id": "victory",
			"path": "res://game_audio_b/assets/victory.res",
			"sha256": "dfc01881dcd42eebfb7086523624ed7caab3c9d431c6623c99aecf0fbd81a2d4",
			"bytes": 68314,
			"kind": "effect"
		},
		{
			"id": "warning",
			"path": "res://game_audio_b/assets/warning.res",
			"sha256": "6e48640884ae96fe16a15ad83870cda61528374267981de75a68c979b15ad7df",
			"bytes": 27437,
			"kind": "effect"
		},
		{
			"id": "water-spell",
			"path": "res://game_audio_b/assets/water-spell.res",
			"sha256": "0e0c53f83002b8a5caca32cbd3b9e810b0541fa545a740223cac1029bd047be7",
			"bytes": 32530,
			"kind": "effect"
		},
		{
			"id": "weapon-whoosh",
			"path": "res://game_audio_b/assets/weapon-whoosh.res",
			"sha256": "ad6c3895d0438334381be2ff9fd1139ffe29cdbfa81e6170a7c8367988dd7e0d",
			"bytes": 15795,
			"kind": "effect"
		},
		{
			"id": "wood-impact",
			"path": "res://game_audio_b/assets/wood-impact.res",
			"sha256": "d8afcef68210860ca5b096f27c79c098bc3c5ade0a785d70b1e3f28a81c39159",
			"bytes": 17719,
			"kind": "effect"
		},
		{
			"id": "ui-confirm",
			"path": "res://game_audio_b/assets/ui-confirm.res",
			"sha256": "731343ecf884b59d928387e72d1d25b256ce6a986459cc920001d76fcf2b3f6a",
			"bytes": 15215,
			"kind": "effect"
		},
		{
			"id": "ui-cancel",
			"path": "res://game_audio_b/assets/ui-cancel.res",
			"sha256": "08238691cc45c2a00c5becbc0c9c0aad64235511b32091eed5853cbd9cb36a0f",
			"bytes": 9580,
			"kind": "effect"
		}
	],
	"mixPolicy": {
		"version": "B2.1",
		"voice_gain": 0.9,
		"skill_voice_duck": 0.56,
		"contact_voice_duck": 0.72,
		"critical_voice_duck": 0.48,
		"skill_global_gap": 0.12,
		"contact_global_gap": 0.075,
		"release_once_per_token": true
	},
	"manifestSha256": "42caa0444cc17254a99d62a104c78e02bccffcfb502bb8ef924b034caf414eb4"
}

const STREAMS = {
	"music-shuihu": preload("res://game_audio_b/assets/music-shuihu.res"),
	"staff-air": preload("res://game_audio_b/assets/staff-air.res"),
	"staff-body": preload("res://game_audio_b/assets/staff-body.res"),
	"blade-armor": preload("res://game_audio_b/assets/blade-armor.res"),
	"shield-block": preload("res://game_audio_b/assets/shield-block.res"),
	"water-jian": preload("res://game_audio_b/assets/water-jian.res"),
	"bow-release": preload("res://game_audio_b/assets/bow-release.res"),
	"danger-wood": preload("res://game_audio_b/assets/danger-wood.res"),
	"wound-cloth": preload("res://game_audio_b/assets/wound-cloth.res"),
	"defeat": preload("res://game_audio_b/assets/defeat.res"),
	"footstep-earth": preload("res://game_audio_b/assets/footstep-earth.res"),
	"footstep-stone": preload("res://game_audio_b/assets/footstep-stone.res"),
	"ink-spell": preload("res://game_audio_b/assets/ink-spell.res"),
	"metal-impact": preload("res://game_audio_b/assets/metal-impact.res"),
	"pickup": preload("res://game_audio_b/assets/pickup.res"),
	"piece-place": preload("res://game_audio_b/assets/piece-place.res"),
	"victory": preload("res://game_audio_b/assets/victory.res"),
	"warning": preload("res://game_audio_b/assets/warning.res"),
	"water-spell": preload("res://game_audio_b/assets/water-spell.res"),
	"weapon-whoosh": preload("res://game_audio_b/assets/weapon-whoosh.res"),
	"wood-impact": preload("res://game_audio_b/assets/wood-impact.res"),
	"ui-confirm": preload("res://game_audio_b/assets/ui-confirm.res"),
	"ui-cancel": preload("res://game_audio_b/assets/ui-cancel.res")
}
