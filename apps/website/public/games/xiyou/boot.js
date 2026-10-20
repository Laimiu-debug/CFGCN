import { readModule, saveModule } from './module-cache.js';
import { installAssetCache } from './asset-cache.js';
window.cfgcnBenchmarkFrame = () => {};
window.cfgcnMotionProbe ??= () => false;
window.cfgcnBenchmarkMotion ??= () => {};
const origin = location.origin;
window.cfgcnCrowdBenchmark = () => {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) return 0;
  const n = Number(new URL(location.href).searchParams.get('benchmark'));
  return [200, 500, 1000].includes(n) ? n : 0;
};
const bootStart = performance.now();
const timing = { cache: false };
let resourceCache;
let wasmMemory;
let prefetchScheduled = false;
window.cfgcnMapSurvey = () => new URL(location.href).searchParams.get('map') === '1';
window.cfgcnSkillTrial = () => new URL(location.href).searchParams.get('skills') === '1';
const mark = (name) => {
  timing[name] = Math.round(performance.now() - bootStart);
};
window.cfgcnBootTiming = timing;
window.cfgcnMark = (name) => {
  if (timing[name] === undefined) mark(name);
};
let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
window.cfgcnReducedMotion = () => reducedMotion;
const input = {
  x: 0,
  z: 0,
  freeze: false,
  clone: false,
  action: 0,
  choice: 0,
  member: 0,
  checkpoint: null,
  map_position: null,
  map_visited: 0,
  map_target: 0,
};
// Restore the separate map checkpoint before constructing the first terrain
// neighbourhood. Otherwise an initial ready frame at Chang'an can overwrite a
// distant save before the outer React shell has sent its restore action.
if (window.cfgcnMapSurvey()) {
  try {
    const saved = JSON.parse(localStorage.getItem('cfgcn:map:xiyou:v1') ?? 'null');
    if (
      saved?.version === 1 &&
      Number.isFinite(saved.pos?.x) &&
      Number.isFinite(saved.pos?.z) &&
      Math.abs(saved.pos.x) < 1_000_000 &&
      Math.abs(saved.pos.z) < 1_000_000 &&
      Number.isSafeInteger(saved.visited) &&
      saved.visited >= 0 &&
      saved.visited <= 0xffffffff
    ) {
      input.map_position = saved.pos;
      input.map_visited = saved.visited;
    }
  } catch {
    /* Storage-denied visitors can still enter a new map. */
  }
}
const tell = (kind, value) => parent.postMessage({ type: `cfgcn:xiyou:${kind}`, value }, origin);
// Keyboard events do not cross the focused WASM iframe. Forward this map-only
// shortcut through the same origin/source-checked bridge as the game snapshot.
window.addEventListener('keydown', (event) => {
  if (
    !window.cfgcnMapSurvey() ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return;
  if (
    event.target instanceof Element &&
    event.target.closest('input, textarea, select, [contenteditable="true"]')
  )
    return;
  if (event.code !== 'KeyM' && event.key.toLowerCase() !== 'm') return;
  event.preventDefault();
  input.x = input.z = 0;
  tell('map-toggle');
});
const chartRequests = [];
window.cfgcnReadChartRequest = () => chartRequests.shift() ?? '';
window.cfgcnChart = (value) => tell('chart', JSON.parse(value));
window.cfgcnReadInput = () => {
  const value = JSON.stringify(input);
  input.freeze = input.clone = false;
  input.action = 0;
  input.checkpoint = null;
  input.map_position = null;
  input.map_visited = 0;
  for (const key of [
    'shadow_cast',
    'shadow_leader',
    'shadow_equip',
    'shadow_loadouts',
    'shadow_auto',
  ])
    input[key] = null;
  input.shadow_restart = false;
  input.shadow_dodge = false;
  return value;
};
const loadingWatchdog = setTimeout(() => tell('error', 'LOADING_TIMEOUT'), 90000);
window.cfgcnShadowState = (value) => {
  const state = JSON.parse(value);
  if (state.ready) clearTimeout(loadingWatchdog);
  tell('shadow-state', state);
};
window.cfgcnState = (value) => {
  const state = JSON.parse(value);
  if (state.ready) {
    clearTimeout(loadingWatchdog);
    if (timing.ready === undefined) {
      mark('ready');
      tell('timing', timing);
    }
    if (!state.expedition && !prefetchScheduled) {
      prefetchScheduled = true;
      // Warm river combat bytes only after actually entering that prototype.
      setTimeout(() => {
        void resourceCache?.prefetch();
      }, 2000);
    }
  }
  if (resourceCache) state.performance.resource_cache = resourceCache.stats;
  state.performance.wasm_memory_bytes = wasmMemory?.buffer.byteLength ?? 0;
  tell('state', state);
};
window.cfgcnError = (value) => tell('error', String(value));
window.addEventListener('message', (event) => {
  if (
    event.origin !== origin ||
    event.source !== parent ||
    event.data?.type !== 'cfgcn:xiyou:input'
  )
    return;
  const value = event.data.value;
  if (!value || typeof value !== 'object') return;
  if (
    Array.isArray(value.chart_request) &&
    value.chart_request.length === 3 &&
    value.chart_request.every(Number.isFinite)
  ) {
    const [x, z, span] = value.chart_request;
    if (Math.abs(x) < 1_000_000 && Math.abs(z) < 1_000_000 && span >= 128 && span <= 1024) {
      const request = JSON.stringify([x, z, span]);
      if (!chartRequests.includes(request)) {
        chartRequests.push(request);
        if (chartRequests.length > 4) chartRequests.shift();
      }
    }
  }
  if (typeof value.reduced_motion === 'boolean') reducedMotion = value.reduced_motion;
  if (['zh-CN', 'zh-TW', 'en'].includes(value.locale)) {
    document.documentElement.lang = value.locale;
    document.querySelector('canvas').setAttribute(
      'aria-label',
      {
        'zh-CN': '西游师徒西行三维场景',
        'zh-TW': '西遊師徒西行三維場景',
        en: 'Journey to the West 3D game scene',
      }[value.locale],
    );
  }
  for (const key of ['x', 'z'])
    if (Number.isFinite(value[key])) input[key] = Math.max(-1, Math.min(1, value[key]));
  for (const key of ['freeze', 'clone']) if (value[key] === true) input[key] = true;
  if (Number.isInteger(value.action) && value.action >= 1 && value.action <= 13)
    input.action = value.action;
  if (Number.isInteger(value.choice) && value.choice >= 0 && value.choice <= 2)
    input.choice = value.choice;
  if (Number.isInteger(value.member) && value.member >= 0 && value.member <= 2)
    input.member = value.member;
  if (value.action === 5) input.checkpoint = value.checkpoint ?? null;
  if (value.action === 11) {
    input.map_position = value.map_position ?? null;
    input.map_visited = Number.isInteger(value.map_visited) ? value.map_visited >>> 0 : 0;
  }
  if (Number.isInteger(value.map_target) && value.map_target >= 0 && value.map_target < 32)
    input.map_target = value.map_target;
  if (value.focus) document.querySelector('canvas').focus();
  if (window.cfgcnSkillTrial()) {
    if (value.shadow_dodge === true) input.shadow_dodge = true;
    if (Number.isInteger(value.shadow_cast) && value.shadow_cast >= 0 && value.shadow_cast < 4)
      input.shadow_cast = value.shadow_cast;
    if (
      Number.isInteger(value.shadow_leader) &&
      value.shadow_leader >= 0 &&
      value.shadow_leader < 5
    )
      input.shadow_leader = value.shadow_leader;
    if (
      Array.isArray(value.shadow_equip) &&
      value.shadow_equip.length === 3 &&
      value.shadow_equip.every(Number.isSafeInteger)
    )
      input.shadow_equip = value.shadow_equip;
    if (
      Array.isArray(value.shadow_loadouts) &&
      value.shadow_loadouts.length === 5 &&
      value.shadow_loadouts.every(
        (a) =>
          Array.isArray(a) &&
          a.length === 4 &&
          a.every((n) => Number.isInteger(n) && n >= 0 && n < 12),
      )
    )
      input.shadow_loadouts = value.shadow_loadouts;
    if (typeof value.shadow_auto === 'boolean') input.shadow_auto = value.shadow_auto;
    if (value.shadow_restart === true) input.shadow_restart = true;
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    input.x = input.z = 0;
    input.action = 2;
  }
});
window.addEventListener('blur', () => {
  input.x = input.z = 0;
});
window.addEventListener('error', (event) => tell('error', event.message));
window.addEventListener('unhandledrejection', (event) => tell('error', String(event.reason)));
try {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  if (!gl) throw new Error('WEBGL2_UNAVAILABLE');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  const manifestResponse = await fetch('./pkg/manifest.json', {
    cache: 'no-cache',
    signal: AbortSignal.timeout(45000),
  });
  if (!manifestResponse.ok) throw new Error(`MANIFEST_HTTP_${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  if (
    manifest.protocolVersion !== 1 ||
    !/^client-[a-f0-9]{12}\.wasm$/.test(manifest.wasm) ||
    !/^client-[a-f0-9]{12}\.js$/.test(manifest.module)
  )
    throw new Error('CLIENT_VERSION_MISMATCH');
  mark('manifest');
  resourceCache = installAssetCache(manifest.resources);
  window.cfgcnAssetCache = resourceCache;
  const preparation = resourceCache.prepare(
    window.cfgcnSkillTrial()
      ? [
          'series_mesh.wesl',
          'series_paint.wesl',
          'shadow/tangseng.glb',
          'shadow/wukong.glb',
          'shadow/bajie.glb',
          'shadow/shaseng.glb',
          'shadow/xiaobailong.glb',
          'shadow/wolf.glb',
          'shadow/tiger.glb',
          'shadow/baigufuren.glb',
          'ink-terrain.jpg',
          'ink_scenery.glb',
          'ink_landmarks.glb',
          'ink_hamlet.glb',
        ]
      : window.cfgcnMapSurvey()
        ? [
            'series_mesh.wesl',
            'series_paint.wesl',
            'shadow_wukong.glb',
            'ink-terrain.jpg',
            'ink_scenery.glb',
            'ink_landmarks.glb',
            'ink_hamlet.glb',
          ]
        : ['series_mesh.wesl', 'series_paint.wesl'],
  );
  const glue = import(`./pkg/${manifest.module}`);
  const key = `${manifest.wasm}:${manifest.module}`;
  const cached = await readModule(key);
  let compiled = cached?.module;
  timing.cache = Boolean(cached);
  timing.cacheSource = cached?.source ?? 'network';
  const download = async (filename, expectedBytes, compressed) => {
    const response = await fetch(`./pkg/${filename}`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`WASM_HTTP_${response.status}`);
    const total = Number(expectedBytes) || Number(response.headers.get('content-length'));
    let downloaded;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        tell('loading', {
          stage: 'download',
          progress: total > 0 ? Math.min(1, received / total) : null,
        });
      }
      downloaded = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        downloaded.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } else downloaded = new Uint8Array(await response.arrayBuffer());
    mark('download');
    // Some hosts apply Content-Encoding themselves. Inspect the payload so that
    // an automatically decoded response is not decompressed twice.
    if (compressed && downloaded[0] === 0x1f && downloaded[1] === 0x8b) {
      downloaded = new Uint8Array(
        await new Response(
          new Blob([downloaded]).stream().pipeThrough(new DecompressionStream('gzip')),
        ).arrayBuffer(),
      );
    }
    mark('decompress');
    if (
      downloaded.length !== Number(manifest.bytes) ||
      downloaded[0] !== 0 ||
      downloaded[1] !== 0x61 ||
      downloaded[2] !== 0x73 ||
      downloaded[3] !== 0x6d
    )
      throw new Error('INVALID_WASM_PAYLOAD');
    return downloaded;
  };
  if (!compiled) {
    let moduleBytes;
    if (manifest.gzip === `${manifest.wasm}.gz` && typeof DecompressionStream === 'function') {
      try {
        moduleBytes = await download(manifest.gzip, manifest.gzipBytes, true);
      } catch {
        tell('loading', { stage: 'download', progress: 0 });
      }
    }
    moduleBytes ??= await download(manifest.wasm, manifest.bytes, false);
    tell('loading', { stage: 'compile', progress: null });
    compiled = await WebAssembly.compile(moduleBytes);
    mark('compile');
    void saveModule(key, compiled, moduleBytes);
  }
  const { default: init } = await glue;
  await preparation;
  const runtime = await init({ module_or_path: compiled });
  wasmMemory = runtime.memory;
  mark('init');
  tell('loading', { stage: 'models', progress: null });
} catch (error) {
  clearTimeout(loadingWatchdog);
  tell('error', String(error));
}
