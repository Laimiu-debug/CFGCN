extends RefCounted

const META = {
	"game": "xiyou",
	"version": "B2.1",
	"actorAssets": [
		{
			"id": "wukong-skill-01",
			"kind": "voice",
			"actor": 1.0,
			"skills": [
				0,
				3,
				4,
				9
			],
			"ultimate": false,
			"text": "吃俺老孙一棒！",
			"calloutSource": "source/audio/godot-b-v2-r1/callout/wukong-source.mp3"
		},
		{
			"id": "tangseng-skill-01",
			"kind": "voice",
			"actor": 0.0,
			"skills": [
				0,
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8,
				9,
				10
			],
			"ultimate": false,
			"text": "定心，护持。"
		},
		{
			"id": "bajie-skill-01",
			"kind": "voice",
			"actor": 2.0,
			"skills": [
				0,
				1,
				3,
				4,
				9
			],
			"ultimate": false,
			"text": "吃俺一耙！"
		},
		{
			"id": "shaseng-skill-01",
			"kind": "voice",
			"actor": 3.0,
			"skills": [
				0,
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				9,
				10,
				11
			],
			"ultimate": false,
			"text": "镇！"
		},
		{
			"id": "xiaobailong-skill-01",
			"kind": "voice",
			"actor": 4.0,
			"skills": [
				0,
				1,
				3,
				4,
				6,
				8
			],
			"ultimate": false,
			"text": "破浪！"
		},
		{
			"id": "tangseng-ultimate-01",
			"kind": "voice",
			"actor": 0.0,
			"skills": [
				11
			],
			"ultimate": true,
			"text": "护佑众生！"
		},
		{
			"id": "wukong-ultimate-01",
			"kind": "voice",
			"actor": 1.0,
			"skills": [
				5
			],
			"ultimate": true,
			"text": "镇！"
		},
		{
			"id": "bajie-ultimate-01",
			"kind": "voice",
			"actor": 2.0,
			"skills": [
				11
			],
			"ultimate": true,
			"text": "天蓬，破阵！"
		},
		{
			"id": "shaseng-ultimate-01",
			"kind": "voice",
			"actor": 3.0,
			"skills": [
				8
			],
			"ultimate": true,
			"text": "流沙，覆海！"
		},
		{
			"id": "xiaobailong-ultimate-01",
			"kind": "voice",
			"actor": 4.0,
			"skills": [
				11
			],
			"ultimate": true,
			"text": "白龙，破浪！"
		},
		{
			"id": "monk-chime",
			"kind": "skill-effect",
			"actor": 0.0,
			"skills": [
				0.0,
				1.0,
				2.0,
				3.0,
				4.0,
				5.0,
				6.0,
				7.0,
				8.0,
				9.0,
				10.0,
				11.0
			],
			"ultimate": false
		},
		{
			"id": "staff-sweep",
			"kind": "skill-effect",
			"actor": 1.0,
			"skills": [
				0.0,
				1.0,
				2.0,
				3.0,
				4.0,
				5.0,
				6.0,
				7.0,
				8.0,
				9.0,
				10.0,
				11.0
			],
			"ultimate": false
		},
		{
			"id": "rake-drag",
			"kind": "skill-effect",
			"actor": 2.0,
			"skills": [
				0.0,
				1.0,
				2.0,
				3.0,
				4.0,
				5.0,
				6.0,
				7.0,
				8.0,
				9.0,
				10.0,
				11.0
			],
			"ultimate": false
		},
		{
			"id": "sand-spade",
			"kind": "skill-effect",
			"actor": 3.0,
			"skills": [
				0.0,
				1.0,
				2.0,
				3.0,
				4.0,
				5.0,
				6.0,
				7.0,
				8.0,
				9.0,
				10.0,
				11.0
			],
			"ultimate": false
		},
		{
			"id": "water-jian",
			"kind": "skill-effect",
			"actor": 4.0,
			"skills": [
				0.0,
				1.0,
				2.0,
				3.0,
				4.0,
				5.0,
				6.0,
				7.0,
				8.0,
				9.0,
				10.0,
				11.0
			],
			"ultimate": false
		}
	],
	"speechPolicy": {
		"actor_gap_seconds": 10.0,
		"global_gap_seconds": 6.0,
		"max_new_cast_age_seconds": 0.24,
		"maximum_simultaneous_speakers": 1.0,
		"repeat_clip_gap_seconds": 20.0
	},
	"assets": [
		{
			"id": "music-xiyou",
			"path": "res://game_audio_b/assets/music-xiyou.res",
			"sha256": "f72d5e13d166e669de25513da3630ccb2f696c3102486c48575fe9ccfcdef11d",
			"bytes": 30039055,
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
			"id": "wukong-skill-01",
			"path": "res://game_audio_b/assets/wukong-skill-01-1b3d1daa7c19.res",
			"sha256": "1b3d1daa7c19f6d85bd56010077359a1603c8e2ed3f4c53f9a5c598bc1e9cc67",
			"bytes": 271923,
			"kind": "voice"
		},
		{
			"id": "tangseng-skill-01",
			"path": "res://game_audio_b/assets/tangseng-skill-01-512447219594.res",
			"sha256": "512447219594f1dbce17c1ccb3657732fa00847516b881923d85733211fb8c24",
			"bytes": 234335,
			"kind": "voice"
		},
		{
			"id": "bajie-skill-01",
			"path": "res://game_audio_b/assets/bajie-skill-01-9463a99400f2.res",
			"sha256": "9463a99400f26bb59e7f8c1296f640e5b15a8006c01ecc1522ba56c05f494d61",
			"bytes": 304243,
			"kind": "voice"
		},
		{
			"id": "shaseng-skill-01",
			"path": "res://game_audio_b/assets/shaseng-skill-01-2be452ee14fe.res",
			"sha256": "2be452ee14fea79df469d8cc6f6b3323ae7878f8ffc4bb55fe442754a25ebfe5",
			"bytes": 108817,
			"kind": "voice"
		},
		{
			"id": "xiaobailong-skill-01",
			"path": "res://game_audio_b/assets/xiaobailong-skill-01-14c2a6c0d124.res",
			"sha256": "14c2a6c0d124ceb497dd845aa69533104c141f382a2220eb2864e38505603824",
			"bytes": 124871,
			"kind": "voice"
		},
		{
			"id": "tangseng-ultimate-01",
			"path": "res://game_audio_b/assets/tangseng-ultimate-01-b9035ace4d07.res",
			"sha256": "b9035ace4d074943185e153480c07787355e410592cf7e41178d847a3c7c81c3",
			"bytes": 164217,
			"kind": "voice"
		},
		{
			"id": "wukong-ultimate-01",
			"path": "res://game_audio_b/assets/wukong-ultimate-01-d4ef055e4f4a.res",
			"sha256": "d4ef055e4f4af97b8ab75190ae01bd2f922045c184a122b07fd017427aab6548",
			"bytes": 83665,
			"kind": "voice"
		},
		{
			"id": "bajie-ultimate-01",
			"path": "res://game_audio_b/assets/bajie-ultimate-01-a19aea9be8d5.res",
			"sha256": "a19aea9be8d56ca33148195c7c23d5fd2527ea145ec9bc0afd1c909962776c78",
			"bytes": 314024,
			"kind": "voice"
		},
		{
			"id": "shaseng-ultimate-01",
			"path": "res://game_audio_b/assets/shaseng-ultimate-01-ab789edb4e27.res",
			"sha256": "ab789edb4e27b3caec79f93e2c2d8312f6780d6a8d30acf06e446d859412e065",
			"bytes": 359488,
			"kind": "voice"
		},
		{
			"id": "xiaobailong-ultimate-01",
			"path": "res://game_audio_b/assets/xiaobailong-ultimate-01-7f4572643f1e.res",
			"sha256": "7f4572643f1e96757e290c2d2247ba6a950bbcff0164539fadffe8f7c9df6c9c",
			"bytes": 200943,
			"kind": "voice"
		},
		{
			"id": "monk-chime",
			"path": "res://game_audio_b/assets/monk-chime-494f91bf7ff7.res",
			"sha256": "494f91bf7ff7bc0beb6c05cfb8f4ef328d94f5c00ec04fd6642b2218277155b6",
			"bytes": 120070,
			"kind": "skill-effect"
		},
		{
			"id": "staff-sweep",
			"path": "res://game_audio_b/assets/staff-sweep.res",
			"sha256": "8c31facdd7021c7d87863b774eec5015e7fb1589cd753c8c42dc1d0c4447dbbd",
			"bytes": 6757,
			"kind": "skill-effect"
		},
		{
			"id": "rake-drag",
			"path": "res://game_audio_b/assets/rake-drag-190ce34fcc42.res",
			"sha256": "190ce34fcc4298414b8d9f8533995c9524cbbe85745082e2bd164c211875d7a2",
			"bytes": 110199,
			"kind": "skill-effect"
		},
		{
			"id": "sand-spade",
			"path": "res://game_audio_b/assets/sand-spade-33dedef6b2bd.res",
			"sha256": "33dedef6b2bd17a19615458d145ee527b09e81d8e458d992f73e881745c6ca5b",
			"bytes": 213544,
			"kind": "skill-effect"
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
	"manifestSha256": "94559c60e7269eb7b293f763ccfc377d30c28e31efbe03d4da9d5971b1c8db3d"
}

const STREAMS = {
	"music-xiyou": preload("res://game_audio_b/assets/music-xiyou.res"),
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
	"wukong-skill-01": preload("res://game_audio_b/assets/wukong-skill-01-1b3d1daa7c19.res"),
	"tangseng-skill-01": preload("res://game_audio_b/assets/tangseng-skill-01-512447219594.res"),
	"bajie-skill-01": preload("res://game_audio_b/assets/bajie-skill-01-9463a99400f2.res"),
	"shaseng-skill-01": preload("res://game_audio_b/assets/shaseng-skill-01-2be452ee14fe.res"),
	"xiaobailong-skill-01": preload("res://game_audio_b/assets/xiaobailong-skill-01-14c2a6c0d124.res"),
	"tangseng-ultimate-01": preload("res://game_audio_b/assets/tangseng-ultimate-01-b9035ace4d07.res"),
	"wukong-ultimate-01": preload("res://game_audio_b/assets/wukong-ultimate-01-d4ef055e4f4a.res"),
	"bajie-ultimate-01": preload("res://game_audio_b/assets/bajie-ultimate-01-a19aea9be8d5.res"),
	"shaseng-ultimate-01": preload("res://game_audio_b/assets/shaseng-ultimate-01-ab789edb4e27.res"),
	"xiaobailong-ultimate-01": preload("res://game_audio_b/assets/xiaobailong-ultimate-01-7f4572643f1e.res"),
	"monk-chime": preload("res://game_audio_b/assets/monk-chime-494f91bf7ff7.res"),
	"staff-sweep": preload("res://game_audio_b/assets/staff-sweep.res"),
	"rake-drag": preload("res://game_audio_b/assets/rake-drag-190ce34fcc42.res"),
	"sand-spade": preload("res://game_audio_b/assets/sand-spade-33dedef6b2bd.res"),
	"ui-confirm": preload("res://game_audio_b/assets/ui-confirm.res"),
	"ui-cancel": preload("res://game_audio_b/assets/ui-cancel.res")
}
