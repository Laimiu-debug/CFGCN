import assets from '../art/audio/ink-v1/manifest.json';
import { atlasSoundEvent } from './atlas-sound';
import type { AtlasCue } from './atlas-sound';
import { GameAudioDirector } from './audio-state';
import type { AudioFrame, MusicScene, SoundCue } from './audio-state';

type Loop = { source: AudioBufferSourceNode; gain: GainNode; start: number; scene?: MusicScene };
const musicLevel = { menu: 0.58, exploration: 0.48, battle: 0.44 };
const cueLevel: Partial<Record<SoundCue, number>> = {
  'ui-hover': 0.13,
  'ui-confirm': 0.28,
  'ui-cancel': 0.25,
  'footstep-earth': 0.24,
  'footstep-stone': 0.24,
  'weapon-whoosh': 0.42,
  'metal-impact': 0.36,
  'wood-impact': 0.4,
  warning: 0.3,
  pickup: 0.35,
  'piece-place': 0.32,
  victory: 0.5,
  defeat: 0.45,
};
export const audioFailureEvent = 'cfgcn:audio-failure';

// The caller creates/resumes this context synchronously from a user gesture.
// One context owns menu, game, environments and bounded one-shot voices.
export async function createAmbience(context: AudioContext) {
  const page = document.querySelector<HTMLElement>('.app');
  const abort = new AbortController();
  const buffers = new Map<string, Promise<AudioBuffer>>();
  const loops = new Set<Loop>();
  const voices = new Map<AudioBufferSourceNode, GainNode>();
  const lastCue = new Map<SoundCue, number>();
  const cueCounts: Partial<Record<SoundCue, number>> = {};
  const environments = new Map<string, Loop>();
  const director = new GameAudioDirector();
  const master = context.createGain();
  master.gain.value = 0.8;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -5;
  limiter.knee.value = 3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  master.connect(limiter).connect(analyser).connect(context.destination);
  const levels = new Uint8Array(analyser.fftSize);
  let disposed = false,
    generation = 0,
    desired: MusicScene | undefined;
  let activeMusic: Loop | undefined,
    gamePaused = false,
    effectsPlayed = 0;
  let water = 0.2,
    birds = 0.45,
    duckUntil = 0,
    failures = 0;

  async function load(url: string) {
    if (!buffers.has(url)) {
      const task = (async () => {
        const response = await fetch(url, { signal: abort.signal, cache: 'force-cache' });
        if (!response.ok) throw new Error('Audio asset unavailable');
        const encoded = await response.arrayBuffer();
        if (disposed) throw new Error('Audio session closed');
        return context.decodeAudioData(encoded);
      })();
      buffers.set(url, task);
      void task.catch(() => buffers.delete(url));
    }
    return buffers.get(url)!;
  }
  function failed() {
    if (disposed) return;
    failures++;
    if (page) page.dataset.audioErrors = String(failures);
    if (failures === 1) window.dispatchEvent(new Event(audioFailureEvent));
  }
  function ramp(gain: GainNode, value: number, seconds = 0.8) {
    const now = context.currentTime;
    gain.gain.cancelAndHoldAtTime(now);
    gain.gain.linearRampToValueAtTime(value, now + seconds);
  }
  function startLoop(buffer: AudioBuffer, start: number, end: number): Loop {
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0;
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = start;
    source.loopEnd = end;
    source.connect(gain).connect(master);
    const loop = { source, gain, start: context.currentTime };
    loops.add(loop);
    source.onended = () => {
      loops.delete(loop);
      source.disconnect();
      gain.disconnect();
    };
    // Edited PCM wraps in the audio rendering thread; no JS replay timer.
    source.start();
    return loop;
  }
  function clearEffects() {
    for (const [source, gain] of voices) {
      source.onended = null;
      source.stop();
      source.disconnect();
      gain.disconnect();
    }
    voices.clear();
  }
  async function selectScene(scene: MusicScene) {
    if (disposed || desired === scene) return;
    desired = scene;
    const request = ++generation;
    clearEffects();
    lastCue.clear();
    const asset = assets.music[scene];
    const buffer = await load(asset.url);
    if (disposed || request !== generation) return;
    const previous = activeMusic;
    activeMusic = startLoop(buffer, asset.loopStart, asset.loopEnd);
    activeMusic.scene = scene;
    ramp(activeMusic.gain, musicLevel[scene], 1.1);
    if (previous) {
      ramp(previous.gain, 0, 1.1);
      previous.source.stop(context.currentTime + 1.15);
    }
    if (page) {
      page.dataset.musicScene = scene;
      page.dataset.musicLoopCount = '0';
      page.dataset.musicLoopSeconds = (asset.loopEnd - asset.loopStart).toFixed(6);
    }
    mixEnvironment();
  }
  function mixEnvironment() {
    for (const [name, loop] of environments) {
      const factor = desired === 'battle' ? 0.4 : 1;
      ramp(
        loop.gain,
        factor * (name === 'water' ? water * 0.9 : name === 'birds' ? birds * 0.65 : 0.75),
        1.4,
      );
    }
  }
  async function startEnvironment() {
    await Promise.all(
      Object.entries(assets.environment).map(async ([name, asset]) => {
        const buffer = await load(asset.url);
        if (disposed) return;
        environments.set(name, startLoop(buffer, asset.loopStart, asset.loopEnd));
        mixEnvironment();
      }),
    );
  }
  function play(id: SoundCue) {
    if (disposed || context.state !== 'running' || document.hidden || gamePaused) return;
    const now = context.currentTime;
    const interval = id === 'ui-hover' ? 0.18 : id.startsWith('footstep') ? 0.22 : 0.12;
    if (now - (lastCue.get(id) ?? -Infinity) < interval || voices.size >= 8) return;
    const cached = buffers.get(assets.effects[id].url);
    if (!cached) return; // Drop a loading cue; never replay it at a later action.
    lastCue.set(id, now);
    void cached
      .then((buffer) => {
        if (
          disposed ||
          gamePaused ||
          context.state !== 'running' ||
          context.currentTime - now > 0.1 ||
          voices.size >= 8
        )
          return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.value = cueLevel[id] ?? 0.42;
        if (id.startsWith('footstep')) source.playbackRate.value = effectsPlayed % 2 ? 0.97 : 1.03;
        source.connect(gain).connect(master);
        voices.set(source, gain);
        source.onended = () => {
          voices.delete(source);
          source.disconnect();
          gain.disconnect();
        };
        source.start();
        effectsPlayed++;
        cueCounts[id] = (cueCounts[id] ?? 0) + 1;
        if (page) {
          page.dataset.lastSoundCue = id;
          page.dataset.soundCueCounts = JSON.stringify(cueCounts);
        }
        if (id === 'victory' || id === 'defeat') {
          duckUntil = now + buffer.duration + 0.5;
          if (activeMusic) ramp(activeMusic.gain, 0.14, 0.12);
        }
      })
      .catch(() => undefined);
  }
  function syncPause() {
    if (disposed || context.state === 'closed') return;
    const suspended = document.hidden || gamePaused;
    if ((suspended && context.state === 'suspended') || (!suspended && context.state === 'running'))
      return;
    void (suspended ? context.suspend() : context.resume()).catch(failed);
  }
  function apply(frame: AudioFrame) {
    gamePaused = frame.paused;
    syncPause();
    void selectScene(frame.scene).catch(failed);
    if (Math.abs(frame.water - water) > 0.025 || Math.abs(frame.birds - birds) > 0.025) {
      water = frame.water;
      birds = frame.birds;
      mixEnvironment();
    }
    for (const cue of new Set(frame.cues)) play(cue);
  }
  function receive(event: MessageEvent) {
    const frame = document.querySelector<HTMLIFrameElement>(
      '.shadow-trial > iframe, .xiyou-stage iframe',
    );
    if (event.origin !== location.origin || !frame || event.source !== frame.contentWindow) return;
    const state = director.accept(event.data?.type, event.data?.value);
    if (state) apply(state);
  }
  function reset() {
    director.reset();
    gamePaused = false;
    water = 0.2;
    birds = 0.45;
    syncPause();
    void selectScene('menu').catch(failed);
    mixEnvironment();
  }
  const targetButton = (event: Event) => {
    const target = (event.target as Element | null)?.closest?.('button, a[href], [role="button"]');
    return target &&
      !target.hasAttribute('disabled') &&
      target.getAttribute('aria-disabled') !== 'true' &&
      !target.hasAttribute('data-audio-toggle')
      ? target
      : null;
  };
  let hovered: Element | null = null;
  function hover(event: Event) {
    const target = targetButton(event);
    if (target && target !== hovered) play('ui-hover');
    hovered = target;
  }
  function click(event: Event) {
    const target = targetButton(event);
    if (!target) return;
    const label = target.getAttribute('aria-label') ?? target.textContent ?? '';
    play(/返回|关闭|收起|取消|關閉|back|close|cancel/i.test(label) ? 'ui-cancel' : 'ui-confirm');
  }
  function atlas(event: Event) {
    const cue = (event as CustomEvent<AtlasCue>).detail;
    if (cue === 'town') play('piece-place');
    if (cue === 'birds') {
      const loop = environments.get('birds');
      if (loop) {
        ramp(loop.gain, 0.9, 0.2);
        loop.gain.gain.setTargetAtTime(birds * 0.65, context.currentTime + 1.5, 0.5);
      }
    }
    if (cue === 'wind' || cue === 'water') {
      const loop = environments.get(cue);
      if (loop) {
        ramp(loop.gain, 1.3, 0.2);
        loop.gain.gain.setTargetAtTime(
          cue === 'water' ? water * 0.9 : 0.75,
          context.currentTime + 1.5,
          0.5,
        );
      }
    }
  }
  function report() {
    if (disposed || !page) return;
    page.dataset.audioContext = context.state;
    page.dataset.audioVoices = String(voices.size);
    page.dataset.audioLoops = String(loops.size);
    page.dataset.audioTime = context.currentTime.toFixed(3);
    page.dataset.environmentWater = water.toFixed(3);
    analyser.getByteTimeDomainData(levels);
    page.dataset.audioLevel = Math.sqrt(
      levels.reduce((sum, x) => sum + ((x - 128) / 128) ** 2, 0) / levels.length,
    ).toFixed(4);
    if (activeMusic?.scene) {
      const asset = assets.music[activeMusic.scene];
      const elapsed = context.currentTime - activeMusic.start;
      page.dataset.musicLoopCount = String(
        elapsed < asset.loopEnd
          ? 0
          : 1 + Math.floor((elapsed - asset.loopEnd) / (asset.loopEnd - asset.loopStart)),
      );
      if (duckUntil && context.currentTime >= duckUntil) {
        duckUntil = 0;
        ramp(activeMusic.gain, musicLevel[activeMusic.scene], 1);
      }
    }
  }
  window.addEventListener('message', receive);
  window.addEventListener('hashchange', reset);
  window.addEventListener(atlasSoundEvent, atlas);
  document.addEventListener('visibilitychange', syncPause);
  document.addEventListener('pointerover', hover, { passive: true });
  document.addEventListener('focusin', hover);
  document.addEventListener('click', click, true);
  const timer = window.setInterval(report, 200);
  const stop = async () => {
    if (disposed) return;
    disposed = true;
    generation++;
    abort.abort();
    clearInterval(timer);
    window.removeEventListener('message', receive);
    window.removeEventListener('hashchange', reset);
    window.removeEventListener(atlasSoundEvent, atlas);
    document.removeEventListener('visibilitychange', syncPause);
    document.removeEventListener('pointerover', hover);
    document.removeEventListener('focusin', hover);
    document.removeEventListener('click', click, true);
    clearEffects();
    for (const loop of loops) {
      loop.source.stop();
      loop.source.disconnect();
      loop.gain.disconnect();
    }
    loops.clear();
    buffers.clear();
    environments.clear();
    if (context.state !== 'closed') await context.close();
    if (page) {
      for (const key of [
        'audioLevel',
        'audioContext',
        'audioTime',
        'audioVoices',
        'audioLoops',
        'musicScene',
        'musicLoopCount',
        'musicLoopSeconds',
        'lastSoundCue',
        'soundCueCounts',
        'audioErrors',
        'environmentWater',
      ])
        delete page.dataset[key];
    }
  };
  try {
    syncPause();
    await selectScene('menu');
    void startEnvironment().catch(failed);
    void Promise.all(Object.values(assets.effects).map((asset) => load(asset.url))).catch(failed);
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}
