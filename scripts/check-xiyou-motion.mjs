import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(
  process.env.CFGCN_BROWSER_RUNTIME
    ? resolve(process.env.CFGCN_BROWSER_RUNTIME, 'package.json')
    : import.meta.url,
);
const { chromium } = require('playwright');
const root = resolve('apps/website/dist'),
  game = resolve('.local/crowd-bench/optimized/game'),
  pkg = resolve('.local/crowd-bench/optimized/pkg');
const server = createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    let path = resolve(root, '.' + (u.pathname === '/' ? '/index.html' : u.pathname));
    if (u.pathname.startsWith('/games/xiyou/'))
      path = resolve(game, u.pathname.slice('/games/xiyou/'.length));
    if (u.pathname.startsWith('/games/xiyou/pkg/'))
      path = resolve(pkg, u.pathname.split('/').at(-1));
    assert([root, game, pkg].some((p) => path.startsWith(p + sep)));
    if (u.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    assert(existsSync(path), path);
    res.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.wasm': 'application/wasm',
          '.glb': 'model/gltf-binary',
          '.png': 'image/png',
          '.wesl': 'text/plain',
          '.woff2': 'font/woff2',
        }[extname(path)] ?? 'application/octet-stream',
    });
    res.end(readFileSync(path));
  } catch (e) {
    res.writeHead(404);
    res.end(String(e));
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = {
  client: JSON.parse(readFileSync(resolve(pkg, 'manifest.json'))).wasm,
  checks: [],
  casts: [],
  turns: [],
  walkFacing: [],
  errors: [],
};
try {
  const allTraces = [];
  report.videos = [];
  for (const member of [0, 1, 2]) {
    const c = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'no-preference',
      recordVideo: { dir: '.local/qa/videos', size: { width: 1280, height: 800 } },
    });
    // Valid recruited-party fixture; use normal controls and combat after restoring.
    const cp = {
      version: 1,
      chapter: 3,
      level: 13,
      xp: 0,
      monk: [5, 2, 2, 0],
      wukong: [2, 0, 0, 0],
      dragon: [0, 0, 0, 1],
      dragon_joined: true,
      events: 31,
      camp: 1,
      leader: member,
    };
    await c.addInitScript((cp) => {
      window.qaMotion = [];
      window.cfgcnMotionProbe = () => true;
      window.cfgcnBenchmarkMotion = (v) => {
        const s = JSON.parse(v);
        s.wall = performance.now();
        window.qaMotion.push(s);
      };
      if (window === window.top) {
        localStorage.setItem(
          'cfgcn:save:xiyou:v1',
          JSON.stringify({
            schemaVersion: 1,
            gameId: 'xiyou',
            savedAt: new Date().toISOString(),
            payload: { version: 1, runs: 3, wins: 2, best: 8, results: [], checkpoint: cp },
          }),
        );
        window.addEventListener('message', (e) => {
          if (e.data?.type === 'cfgcn:xiyou:state') window.qa = e.data.value;
        });
      }
    }, cp);
    const p = await c.newPage();
    p.on('pageerror', (e) => report.errors.push(e.message));
    p.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(m.text());
    });
    await p.goto(`http://127.0.0.1:${server.address().port}/#/world/xiyou`);
    await p.waitForFunction(() => window.qa?.ready, null, { timeout: 90000 });
    await p.getByRole('button', { name: /^从路标继续/ }).click();
    await p.waitForFunction(() => window.qa?.phase === 'playing' && window.qa.ready);
    const frame = p.frames().find((f) => f.url().includes('/games/xiyou/'));

    await p.frameLocator('iframe').locator('canvas').focus();
    await p.keyboard.press(`Digit${member + 1}`);
    await p.waitForFunction((m) => window.qa.journey.leader === m, member);
    await p.keyboard.down('w');
    await p.waitForTimeout(400);
    for (const skill of [0, 1]) {
      const button = p.locator('.xiyou-spells button').nth(skill);
      await button.waitFor({ state: 'visible' });
      assert(await button.isEnabled(), `leader ${member} skill ${skill} unavailable`);
      const before = await p.evaluate(() => window.qa);
      await button.click();
      await p.waitForTimeout(280);
      await p.screenshot({ path: `.local/qa/motion-skill-${member}-${skill}.png` });
      await p.waitForTimeout(320);
      const after = await p.evaluate(() => window.qa);
      const kind = [1, 0, 4][member],
        point = (s) => (member === 0 ? s.master : member === 1 ? s.hero : s.journey.dragon_pos);
      const distance = point(after).z - point(before).z,
        seconds = after.elapsed - before.elapsed;
      assert(
        distance > seconds * 3.5,
        `mouse skill stopped held walking for ${member}: ${distance}/${seconds}`,
      );
      report.casts.push({ member, skill, distance, seconds, kind });
    }
    await p.keyboard.up('w');
    await p.waitForTimeout(120);
    // Observe clones / the dragon spirit disappear again, through normal timers.
    await p.waitForTimeout(3300);
    // Deliberate direction changes for each controlled character, not just
    // observing a nonzero leg joint while holding W in one direction.
    for (const key of ['d', 's', 'a', 'w']) {
      await p.frameLocator('iframe').locator('canvas').focus();
      const before = await p.evaluate(() => window.qa);
      await p.keyboard.down(key);
      await p.waitForTimeout(420);
      await p.keyboard.up(key);
      const after = await p.evaluate(() => window.qa);
      const point = (s) => (member === 0 ? s.master : member === 1 ? s.hero : s.journey.dragon_pos);
      const a = point(before),
        b = point(after);
      const distance = Math.hypot(b.x - a.x, b.z - a.z);
      assert(distance > 0.6, `role ${member} stuck on turn ${key}`);
      report.turns.push({ member, key, distance });
    }
    await p.locator('.xiyou-pause').click();
    await p.waitForFunction(() => window.qa.phase === 'paused');
    await p.waitForTimeout(150);
    const pausedA = (await frame.evaluate(() => window.qaMotion)).at(-1);
    await p.waitForTimeout(350);
    const pausedB = (await frame.evaluate(() => window.qaMotion)).at(-1);
    assert(pausedA && pausedB);
    assert.equal(pausedA.elapsed, pausedB.elapsed);
    assert.deepEqual(pausedA.party, pausedB.party);
    assert.deepEqual(pausedA.camera, pausedB.camera);
    assert.deepEqual(pausedA.spells, pausedB.spells);
    report.checks.push(
      'pause freezes actual bone transforms, blend weights, root transforms, camera and spell population',
    );
    const part = await frame.evaluate(() => window.qaMotion);
    let steady = 0,
      previousHeading = null,
      maxError = 0,
      facingSamples = 0;
    const roleKind = [1, 0, 4][member];
    for (let i = 1; i < part.length; i++) {
      const a = part[i - 1].party.find((a) => a.kind === roleKind),
        b = part[i].party.find((a) => a.kind === roleKind);
      const dt = part[i].elapsed - part[i - 1].elapsed;
      if (!a || !b || dt <= 0 || part[i].phase !== 'playing') continue;
      const dx = b.position[0] - a.position[0],
        dz = b.position[2] - a.position[2],
        distance = Math.hypot(dx, dz);
      if (distance / dt < 2 || distance > 1.5) {
        steady = 0;
        previousHeading = null;
        continue;
      }
      const heading = Math.atan2(dx, dz);
      const change =
        previousHeading === null
          ? Math.PI
          : Math.abs(
              Math.atan2(Math.sin(heading - previousHeading), Math.cos(heading - previousHeading)),
            );
      steady = change < 0.04 ? steady + dt : 0;
      previousHeading = heading;
      if (steady < 0.3) continue;
      const [x, y, z, w] = b.rotation,
        fx = 2 * (x * z + w * y),
        fz = 1 - 2 * (x * x + y * y);
      const error = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / distance)));
      maxError = Math.max(maxError, error);
      facingSamples++;
    }
    assert(facingSamples > 20, `role ${member} has no steady walking samples`);
    assert(maxError < 0.22, `role ${member} turns away from its running feet: ${maxError}`);
    report.walkFacing.push({ member, samples: facingSamples, maxRadians: maxError });
    allTraces.push(...part);
    report.videos.push(await p.video().path());
    await c.close();
  }
  const traces = allTraces;
  writeFileSync('.local/qa/motion-frames.json', JSON.stringify(traces));
  let hiddenRigSamples = 0;
  for (let i = 1; i < traces.length; i++) {
    if (traces[i].phase !== 'playing' || traces[i - 1].phase !== 'playing') continue;
    for (const player of traces[i].animation_players) {
      const previous = traces[i - 1].animation_players.find(
        (p) => p.actor[0] === player.actor[0] && p.actor[1] === player.actor[1],
      );
      if (!player.visible && previous && !previous.visible) {
        assert.equal(player.tracks, 0, `Hidden rig is still animating: ${player.actor}`);
        hiddenRigSamples++;
      }
      assert(player.tracks < 9, 'Inactive blend nodes stayed in the playback set');
    }
  }
  assert(hiddenRigSamples > 30, 'No hidden rig was observed after the skill ended');
  report.hiddenRigSamples = hiddenRigSamples;
  report.checks.push(
    'hidden clones / dragon spirit and zero-weight clips stop playback; active skills reactivate through normal timers',
  );
  const castFrames = traces
    .filter((s) => s.phase === 'playing')
    .flatMap((s) => s.party.map((a) => ({ ...a, dt: s.dt, camera: s.camera })))
    .filter((a) => a.clip >= 2 && a.weights[8] > 0.72);
  assert(castFrames.length > 10, 'No walking casts used the lower-body layer');
  for (const kind of [0, 1, 4]) {
    const fs = castFrames.filter((a) => a.kind === kind);
    assert(fs.length >= 3, `missing layered motion ${kind}`);
    const bone = kind === 4 ? 'fore.L' : 'thigh.L';
    assert(
      fs.every((a) => a.joints[bone]),
      `no exported ${bone} target on ${kind}`,
    );
    const distinct = new Set(
      fs.map((a) => JSON.stringify(a.joints[bone][1].map((n) => Math.round(n * 1000)))),
    );
    assert(distinct.size > 2, `leg bone froze during cast ${kind}`);
    report.checks.push(
      `role ${kind}: actual ${bone} rotates throughout moving casts (${distinct.size} sampled poses)`,
    );
  }
  assert(
    traces.every((s) => s.spells[0] + s.spells[1] <= 96),
    'spell entity pool exceeded the 96-stroke cap',
  );
  const cams = traces.filter((s) => s.phase === 'playing' && s.camera).map((s) => s.camera[1]);
  const first = cams[0];
  const maxCameraRotationError = Math.max(
    ...cams.flatMap((q) => q.map((n, i) => Math.abs(n - first[i]))),
  );
  assert(maxCameraRotationError < 0.00001, `camera pitch wobbled ${maxCameraRotationError}`);
  report.cameraRotationError = maxCameraRotationError;
  report.checks.push(
    'all six mouse casts preserve the held movement key; distance advances during both skills',
  );
  report.checks.push(
    'camera keeps a fixed pitch over slopes; dynamic VFX allocation stays bounded',
  );
  report.frames = traces.length;
  report.maxStrokes = Math.max(...traces.map((s) => s.spells[0]));
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  writeFileSync('.local/qa/motion-browser.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise((done) => server.close(done));
}
