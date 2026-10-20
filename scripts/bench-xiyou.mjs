import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
// Use a locally installed Playwright, or an explicitly supplied test runtime.
const require = createRequire(
  process.env.CFGCN_BROWSER_RUNTIME
    ? resolve(process.env.CFGCN_BROWSER_RUNTIME, 'package.json')
    : import.meta.url,
);
const { chromium } = require('playwright');
const variant = process.argv[2] ?? 'optimized';
assert(['baseline', 'optimized'].includes(variant));
const selectedCase = process.env.CFGCN_BENCH_CASE;
assert(!selectedCase || /^(200|500|1000):(1|4)$/.test(selectedCase), 'Invalid benchmark case');
mkdirSync('.local/qa', { recursive: true });
const root = resolve('apps/website/public'),
  pkg = resolve(`.local/crowd-bench/${variant}/pkg`),
  frozen = resolve(`.local/crowd-bench/${variant}/game`);
const server = createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    let path = resolve(root, '.' + u.pathname);
    if (existsSync(frozen) && u.pathname.startsWith('/games/xiyou/'))
      path = resolve(frozen, u.pathname.slice('/games/xiyou/'.length));
    if (u.pathname.startsWith('/games/xiyou/pkg/'))
      path = resolve(pkg, u.pathname.split('/').at(-1));
    assert(
      path.startsWith(root + sep) || path.startsWith(pkg + sep) || path.startsWith(frozen + sep),
    );
    if (u.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (!existsSync(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const bytes = readFileSync(path);
    res.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.json': 'application/json',
          '.wasm': 'application/wasm',
          '.glb': 'model/gltf-binary',
          '.png': 'image/png',
          '.wesl': 'text/plain',
          '.css': 'text/css',
        }[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(bytes);
  } catch (e) {
    res.writeHead(500);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = {
  variant,
  client: JSON.parse(readFileSync(resolve(pkg, 'manifest.json'))),
  synthetic: true,
  realPhone: false,
  cases: [],
  errors: [],
  logs: [],
};
try {
  const conditions = process.env.CFGCN_BENCH_FAST
    ? [{ n: 500, cpu: 1, mobile: false }]
    : [
        { n: 200, cpu: 1, mobile: false },
        { n: 500, cpu: 1, mobile: false },
        { n: 1000, cpu: 1, mobile: false },
        { n: 500, cpu: 4, mobile: true },
      ];
  for (const spec of conditions) {
    if (selectedCase && selectedCase !== `${spec.n}:${spec.cpu}`) continue;
    const c = await browser.newContext({
      viewport: spec.mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: spec.mobile ? 2 : 1,
      isMobile: spec.mobile,
      hasTouch: spec.mobile,
    });
    await c.addInitScript((debug) => {
      window.qaFrames = [];
      window.qaGpu = [];
      window.qaCapture = false;
      let prev = performance.now(),
        calls = 0,
        triangles = 0;
      const textureFormats = [];
      if (debug) {
        for (const method of ['texStorage2D', 'texImage2D']) {
          const original = WebGL2RenderingContext.prototype[method];
          WebGL2RenderingContext.prototype[method] = function (...a) {
            if (
              (method === 'texStorage2D' && a[3] === 512) ||
              (method === 'texImage2D' && a[3] === 512)
            )
              textureFormats.push({ method, args: a.slice(0, 8) });
            return original.apply(this, a);
          };
        }
      }
      Object.defineProperty(window, 'cfgcnBenchmarkFrame', {
        configurable: false,
        get: () => (seconds) => {
          if (window.qaCapture) window.qaFrames.push(seconds * 1000);
        },
        set: () => {},
      });
      for (const name of [
        'drawElements',
        'drawElementsInstanced',
        'drawArrays',
        'drawArraysInstanced',
      ]) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...a) {
          calls++;
          if (a[0] === this.TRIANGLES) {
            const count = name.startsWith('drawElements') ? a[1] : a[2];
            const instances = name.endsWith('Instanced') ? a.at(-1) : 1;
            triangles += (count / 3) * instances;
            if (debug && !window.qaDebug && [828, 2388].includes(count) && instances > 3) {
              const gl = this,
                program = gl.getParameter(gl.CURRENT_PROGRAM),
                blocks = [];
              const prior = gl.getParameter(gl.COPY_READ_BUFFER_BINDING);
              for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS); i++) {
                const binding = gl.getActiveUniformBlockParameter(
                    program,
                    i,
                    gl.UNIFORM_BLOCK_BINDING,
                  ),
                  buffer = gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, binding),
                  size = gl.getActiveUniformBlockParameter(program, i, gl.UNIFORM_BLOCK_DATA_SIZE),
                  offset = gl.getIndexedParameter(gl.UNIFORM_BUFFER_START, binding);
                const bytes = new Uint8Array(Math.min(size, 512));
                gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
                gl.getBufferSubData(gl.COPY_READ_BUFFER, Number(offset), bytes);
                blocks.push({
                  name: gl.getActiveUniformBlockName(program, i),
                  binding,
                  size,
                  offset,
                  data: [...new Float32Array(bytes.buffer)],
                });
              }
              const attrs = [];
              for (const j of [0, 1, 2, 3]) {
                const buffer = gl.getVertexAttrib(j, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
                  offset = gl.getVertexAttribOffset(j, gl.VERTEX_ATTRIB_ARRAY_POINTER),
                  type = gl.getVertexAttrib(j, gl.VERTEX_ATTRIB_ARRAY_TYPE),
                  stride = gl.getVertexAttrib(j, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
                  normalized = gl.getVertexAttrib(j, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED);
                const bytes = new Uint8Array(96);
                gl.bindBuffer(gl.COPY_READ_BUFFER, buffer);
                gl.getBufferSubData(gl.COPY_READ_BUFFER, offset, bytes);
                attrs.push({ j, offset, type, stride, normalized, bytes: [...bytes] });
              }
              gl.bindBuffer(gl.COPY_READ_BUFFER, prior);
              const active = gl.getParameter(gl.ACTIVE_TEXTURE),
                read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
                fbo = gl.createFramebuffer(),
                textures = [];
              for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
                const u = gl.getActiveUniform(program, i);
                if (u.type !== gl.SAMPLER_2D) continue;
                const unit = gl.getUniform(program, gl.getUniformLocation(program, u.name));
                gl.activeTexture(gl.TEXTURE0 + unit);
                const texture = gl.getParameter(gl.TEXTURE_BINDING_2D);
                gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
                gl.framebufferTexture2D(
                  gl.READ_FRAMEBUFFER,
                  gl.COLOR_ATTACHMENT0,
                  gl.TEXTURE_2D,
                  texture,
                  0,
                );
                const pixels = [];
                for (const xy of [
                  [0, 0],
                  [278, 218],
                  [279, 218],
                ]) {
                  const b = new Uint8Array(4);
                  gl.readPixels(...xy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
                  pixels.push([...b]);
                }
                textures.push({ name: u.name, unit, pixels });
              }
              gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
              gl.deleteFramebuffer(fbo);
              gl.activeTexture(active);
              const shaders = gl.getAttachedShaders(program).map((s) => ({
                type: gl.getShaderParameter(s, gl.SHADER_TYPE),
                source: gl.getShaderSource(s),
              }));
              window.qaDebug = {
                count,
                instances,
                blocks,
                attrs,
                textures,
                shaders,
                textureFormats,
              };
            }
          }
          return original.apply(this, a);
        };
      }
      function frame(t) {
        if (window.qaCapture && calls > 0) window.qaGpu.push({ calls, triangles });
        prev = t;
        calls = 0;
        triangles = 0;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.addEventListener('message', (e) => {
        if (e.data?.type === 'cfgcn:xiyou:state') window.qa = e.data.value;
        if (e.data?.type === 'cfgcn:xiyou:error') window.qaError = e.data.value;
      });
    }, Boolean(process.env.CFGCN_BENCH_DEBUG));
    const p = await c.newPage();
    p.on('pageerror', (e) => report.errors.push(e.message));
    p.on('console', (m) => {
      report.logs.push({ kind: m.type(), text: m.text().slice(0, 10000) });
      if (m.type() === 'error' || /ERROR|panicked|Validation Error/.test(m.text()))
        report.errors.push(m.text().slice(0, 10000));
    });
    const cdp = await c.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: spec.cpu });
    await p.goto(
      `http://127.0.0.1:${server.address().port}/games/xiyou/index.html?benchmark=${spec.n}`,
    );
    await p.waitForFunction(
      (n) => window.qa?.ready && window.qa?.enemies === n && window.qa.performance?.benchmark === n,
      spec.n,
      { timeout: 120000 },
    );
    assert.equal(await p.evaluate(() => window.qaError), undefined);
    await p.waitForTimeout(8000);
    await p.evaluate(() => (window.qaCapture = true));
    const start = await p.evaluate(() => window.qa.elapsed);
    await p.waitForTimeout(process.env.CFGCN_BENCH_FAST ? 6000 : 15000);
    const data = await p.evaluate(() => ({
      debug: window.qaDebug,
      frames: window.qaFrames,
      gpu: window.qaGpu,
      state: window.qa,
      heap: performance.memory?.usedJSHeapSize,
      canvas: {
        w: document.querySelector('canvas').width,
        h: document.querySelector('canvas').height,
      },
      timing: window.cfgcnBootTiming,
      gpuInfo: (() => {
        const gl = document.querySelector('canvas').getContext('webgl2'),
          ext = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          renderer: ext
            ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER),
          vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        };
      })(),
    }));
    if (data.debug)
      writeFileSync('.local/qa/crowd-debug.json', JSON.stringify(data.debug, null, 2));
    const sorted = data.frames.filter((n) => n > 0).sort((a, b) => a - b),
      percentile = (q) => sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
    const calls = data.gpu.map((g) => g.calls).sort((a, b) => a - b),
      tris = data.gpu.map((g) => g.triangles).sort((a, b) => a - b);
    const entry = {
      ...spec,
      frames: sorted.length,
      meanFps: (1000 * sorted.length) / sorted.reduce((a, b) => a + b, 0),
      p50ms: percentile(0.5),
      p95ms: percentile(0.95),
      p99ms: percentile(0.99),
      over33ms: sorted.filter((n) => n > 33.34).length / Math.max(1, sorted.length),
      drawCallsP50: calls[Math.floor(calls.length / 2)],
      trianglesP50: tris[Math.floor(tris.length / 2)],
      simulationSeconds: data.state.elapsed - start,
      enemies: data.state.enemies,
      canvas: data.canvas,
      heap: data.heap,
      performance: data.state.performance,
      gpuInfo: data.gpuInfo,
    };
    report.cases.push(entry);
    console.log(JSON.stringify(entry));
    assert(
      sorted.length > 100 && entry.simulationSeconds > 3,
      'render/update loop must actually advance',
    );
    await p.screenshot({ path: `.local/qa/crowd-${variant}-${spec.n}-${spec.cpu}x.png` });
    await c.close();
  }
  assert(report.cases.length > 0, 'No benchmark case matched');
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  const suffix = selectedCase ? `-${selectedCase.replace(':', '-cpu')}` : '';
  writeFileSync(`.local/qa/crowd-${variant}${suffix}.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}
