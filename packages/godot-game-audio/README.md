# Godot B audio ownership and shared UI interface

2026-10-24，用户已采用B；B1主工程接入与历史验证见 `docs/godot-b-audio.md`。当前可冻结音频批为B2.1，指针 `current.json`，不可变交接 `source/audio/godot-b-v2-r1/delivery.json`（SHA `f222e4c49b931648b871f7016a9a20478693b350eea42479de9804b1583c00af`），说明 `docs/godot-audio-windows-b2.md`。B2保留B音乐，优化战斗密度、主控／同伴／危险层次、短句间隔及语音让位，并按原生技能索引校正绑定。只重做悟空一条易误听台词，两稿累计2积分；最终B2.1“吃俺老孙一棒！”已由用户确认“俺”清楚、该句可以，补充记录 `.local/qa/godot-audio-b-v2/callout-user-acceptance.json`，不改冻结时的历史delivery，也不把一句认可扩展成所有台词终审。

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
