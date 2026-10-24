# Godot B audio ownership and shared UI interface

2026-10-24，用户已采用B。当前源版本为B2.2，指针 `current.json`，不可变交接 `source/audio/godot-b-v2-r2/delivery.json`（SHA `e19d37927c49dd716e1cea819520b69f5c1b169f4a6b7b12785de7558ba11684`）。用户对四组实机对照确认“更清楚，按这个方向继续”：独立保护真实Boss预警、限制普通敌群并发，命中轻重取真实结算；不将动画marker或落空猜成命中／格挡。两作各只更新mixer和library两个音频代码文件，主工程新Windows包验收仍单独进行。事件约定与未覆盖项见 `source/audio/godot-b-v2-r2/event-contract.json`；接收固定主工程快照可用 `python scripts/audio-desktop-contact/adopt.py --game xiyou --project <project-directory>`，不传project则仅同步两作live音频。该脚本逐SHA验证已有B2.1或B2.2，遇并发改动即保留原文件，不依赖玩家／QA旧档。

B1接入历史见 `docs/godot-b-audio.md`；B2.1原交接 `source/audio/godot-b-v2-r1/delivery.json`（SHA `f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af`）及 `docs/godot-audio-windows-b2.md` 保留。B2.2没有新生成素材，全部配乐、音效、声音资源与循环元数据保持B2.1；本批Runway新增调用／积分均0，B2两稿悟空台词累计仍2积分。“吃俺老孙一棒！”保留用户已确认“俺”清楚、该句可以的原声，未将一句认可扩展为所有台词终审。

Canonical source: this directory. Sync both main projects with `python scripts/audio-desktop-adopt/sync.py`; the default reads current.json. For a release use the immutable runtime files/SHA listed in the delivery, not a changing live directory. Do not edit generated `game_audio_b/` copies or shared desktop UI files here. Source checks do not replace the next Windows package and website acceptance gates.

Shared UI uses the real autoload, without loading a second player:

```gdscript
var audio = get_node_or_null("/root/CFGCNAudio")
if is_instance_valid(audio) and audio.has_method("ui_event"):
    audio.ui_event("ui_confirm") # ui_cancel / ui_hint / ui_error
```

`ui_event` returns whether a sound started. Confirm/cancel use the preserved ui-confirm/ui-cancel sources; hint uses a quieter confirm, error the B wooden cue. All use Effects and existing Master/Effects mute, with UI permission while game sounds pause. UI cooldowns use real monotonic time independently of the frozen game/music clock. Calls are optional and silent for unknown actions; do not turn a false cooldown/mute result into an invented fallback sound. Audio-owned API and native bus checks are in `scripts/audio-desktop-adopt/ui.gd`. Shared UI action wiring remains with its owner.

An explicit quit flow can use `await audio.prepare_shutdown()` before `get_tree().quit()`. This stops the producer and drains three native processing frames, including the synchronous Movie Maker driver. Ordinary tree teardown also calls the idempotent release path, so immediate settings/headless and normal driver exits are covered. Do not call prepare_shutdown when returning to the main menu; the persistent host continues there.

Exit regression: `python scripts/audio-desktop-adopt/exit.py` runs real two-project headless settings (20 checks each), fast exit and compatibility-GPU fast exit with full stdout/stderr, including ObjectDB/resource diagnostics. `mixer.shutdown()` stops every player, clears stream references and allows one bounded 100 ms driver drain before final tree teardown. Host also releases external Boss warning streams and signal references. There is no delay on ordinary scene changes and no change to frozen builds. Initial stop/clear-only failure and final logs remain under `.local/qa/godot-audio-b-v1/exit-lifecycle/`; final SHA is in `result.json` and `source/audio/godot-b-v1/delivery.json`.

The driver-drain choice was checked against [Godot's native playback stop path](https://github.com/godotengine/godot/blob/master/servers/audio/audio_server.cpp) and validated on this machine. Full-loop/audio proofs precede this exit-only patch; new API and exit regressions cover the final source. It is not a multi-driver guarantee.
