import { mapFields, mapLandmarks } from './expedition-map';
import type { MapPosition } from './expedition-map';
import { fogCell, fogKey } from './map-exploration';
import type { MapChart } from './map-exploration';
import type { Locale } from '@cfgcn/shared';

type Paint = {
  center: MapPosition;
  player: MapPosition;
  span: number;
  chart?: MapChart;
  fog: Set<string>;
  miniature?: boolean;
  symbols: HTMLImageElement | null;
  portrait: HTMLImageElement | null;
  locale?: Locale;
};
const mix = (a: number[], b: number[], t: number) =>
  a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const rgb = (v: number[]) => `rgb(${v.join(' ')})`;
// Smooth geographic value noise, used only for the stationery mist pigment.
function mistNoise(x: number, z: number): number {
  const i = Math.floor(x),
    j = Math.floor(z);
  const a = x - i,
    b = z - j,
    u = a * a * (3 - 2 * a),
    v = b * b * (3 - 2 * b);
  const sample = (x: number, z: number) => {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  return (
    (sample(i, j) * (1 - u) + sample(i + 1, j) * u) * (1 - v) +
    (sample(i, j + 1) * (1 - u) + sample(i + 1, j + 1) * u) * v
  );
}

export function paintInkMap(ctx: CanvasRenderingContext2D, p: Paint) {
  const el = ctx.canvas,
    width = el.width,
    height = el.height,
    size = Math.max(width, height);
  const css = getComputedStyle(el);
  const color = (name: string) => css.getPropertyValue(name).trim();
  const channels = (name: string) => {
    const value = color(name).slice(1);
    return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  };
  const paper = channels('--paper'),
    jade = channels('--jade'),
    stone = channels('--muted'),
    water = channels('--accent-shuihu');
  const unit = width / el.getBoundingClientRect().width;
  const metres = size / p.span;
  const sx = (x: number) => (p.center.x - x) * metres + width / 2;
  const sy = (z: number) => (p.center.z - z) * metres + height / 2;
  ctx.clearRect(0, 0, width, height);
  // The whole sheet starts as land, never a road or a synthetic corridor.
  ctx.fillStyle = rgb(mix(paper, jade, 0.1));
  ctx.fillRect(0, 0, width, height);
  const chart = p.chart;
  if (chart) {
    const n = chart.size,
      step = chart.span / (n - 1);
    const raster = document.createElement('canvas');
    raster.width = raster.height = n;
    const rc = raster.getContext('2d')!,
      pixels = rc.createImageData(n, n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = chart.terrain[j * n + i],
          b = chart.terrain[j * n + Math.min(n - 1, i + 1)],
          c = chart.terrain[Math.min(n - 1, j + 1) * n + i];
        const dx = (b[0] - a[0]) / (step * 10),
          dz = (c[0] - a[0]) / (step * 10);
        const slope = Math.min(1, Math.hypot(dx, dz));
        const shade = Math.max(-0.1, Math.min(0.23, dx * 0.12 + dz * 0.14));
        const land = mix(
          paper,
          slope > 0.45 ? stone : jade,
          Math.max(0.05, 0.12 + slope * 0.26 + shade + a[2] / 1500),
        );
        const tint = a[1] > 3 ? mix(land, water, 0.38 + Math.min(1, a[1] / 180) * 0.28) : land;
        pixels.data.set([...tint, 255], (j * n + i) * 4);
      }
    rc.putImageData(pixels, 0, 0);
    const extent = chart.span * metres;
    ctx.save();
    ctx.translate(sx(chart.x), sy(chart.z));
    ctx.scale(-1, -1);
    ctx.drawImage(raster, -extent / 2, -extent / 2, extent, extent);
    ctx.restore();
    // Marching-square height contours, interpolated from actual relief samples.
    // The old disconnected diagonal ticks did not describe a slope.
    ctx.strokeStyle = color('--muted');
    ctx.lineWidth = unit * 0.65;
    ctx.globalAlpha = 0.3;
    const interval = p.span > 320 ? 40 : 20;
    const contourSegments: [number[], number[]][] = [];
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        const values = [
          chart.terrain[j * n + i],
          chart.terrain[j * n + i + 1],
          chart.terrain[(j + 1) * n + i + 1],
          chart.terrain[(j + 1) * n + i],
        ];
        if (values.some((v) => v[1] > 3)) continue;
        const wx = chart.x - chart.span / 2 + i * step,
          wz = chart.z - chart.span / 2 + j * step;
        const points = [
          [wx, wz],
          [wx + step, wz],
          [wx + step, wz + step],
          [wx, wz + step],
        ];
        const low = Math.min(...values.map((v) => v[0])),
          high = Math.max(...values.map((v) => v[0]));
        for (
          let level = Math.floor(low / interval + 1) * interval;
          level <= high;
          level += interval
        ) {
          const cross: number[][] = [];
          for (let k = 0; k < 4; k++) {
            const next = (k + 1) % 4,
              a = values[k][0],
              b = values[next][0];
            if (a < level === b < level) continue;
            const t = (level - a) / (b - a);
            cross.push([
              sx(points[k][0] + (points[next][0] - points[k][0]) * t),
              sy(points[k][1] + (points[next][1] - points[k][1]) * t),
            ]);
          }
          for (let k = 0; k + 1 < cross.length; k += 2) {
            contourSegments.push([cross[k], cross[k + 1]]);
          }
        }
      }
    const nodes = new Map<string, { point: number[]; edges: number[] }>();
    const key = (point: number[]) => point.map((v) => v.toFixed(3)).join(':');
    contourSegments.forEach((segment, i) =>
      segment.forEach((point) => {
        const id = key(point),
          node = nodes.get(id) ?? { point, edges: [] };
        node.edges.push(i);
        nodes.set(id, node);
      }),
    );
    const used = new Set<number>();
    ctx.beginPath();
    contourSegments.forEach((segment, i) => {
      if (used.has(i)) return;
      const path = [segment[0], segment[1]];
      used.add(i);
      // Grow both directions so open contours do not end at arbitrary cells.
      for (const reverse of [false, true]) {
        if (reverse) path.reverse();
        for (;;) {
          const last = path[path.length - 1],
            next = nodes.get(key(last))?.edges.find((n) => !used.has(n));
          if (next === undefined) break;
          used.add(next);
          const edge = contourSegments[next];
          path.push(key(edge[0]) === key(last) ? edge[1] : edge[0]);
        }
      }
      ctx.moveTo(...(path[0] as [number, number]));
      for (let k = 1; k < path.length - 1; k++)
        ctx.quadraticCurveTo(
          path[k][0],
          path[k][1],
          (path[k][0] + path[k + 1][0]) / 2,
          (path[k][1] + path[k + 1][1]) / 2,
        );
      ctx.lineTo(...(path[path.length - 1] as [number, number]));
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (const field of mapFields) {
      if (
        !p.fog.has(fogKey(field.x, field.z)) ||
        Math.abs(field.x - p.center.x) > p.span ||
        Math.abs(field.z - p.center.z) > p.span
      )
        continue;
      ctx.save();
      ctx.translate(sx(field.x), sy(field.z));
      ctx.rotate(field.angle);
      ctx.strokeStyle = color('--jade');
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 0.8 * unit;
      for (let v = -field.extent[1] + 1.5; v < field.extent[1] - 1; v += 2.8) {
        ctx.beginPath();
        for (let u = -field.extent[0] + 1.5; u < field.extent[0] - 1; u += 2.8) {
          ctx.moveTo((u - 0.5) * metres, (v + 0.7) * metres);
          ctx.quadraticCurveTo(u * metres, (v - 0.6) * metres, (u + 0.5) * metres, v * metres);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    const icon = (id: number, wx: number, wz: number, w: number) => {
      if (!p.symbols || !p.fog.has(fogKey(wx, wz))) return;
      const x = sx(wx),
        y = sy(wz);
      if (x < -w || y < -w || x > width + w || y > height + w) return;
      ctx.drawImage(
        p.symbols,
        (id % 4) * 128,
        Math.floor(id / 4) * 128,
        128,
        128,
        x - w / 2,
        y - w * 0.78,
        w,
        w,
      );
    };
    // Botanical canopy marks describe woodland cover in plan view. They are
    // grounded at the real roots, without stamping upright trees everywhere.
    for (const [wx, wz, symbol, scale] of chart.props) {
      if (!p.fog.has(fogKey(wx, wz))) continue;
      const x = sx(wx),
        y = sy(wz);
      if (x < -40 || y < -40 || x > width + 40 || y > height + 40) continue;
      if (symbol === 0 || symbol === 21) {
        icon(symbol, wx, wz, Math.max(2.5 * unit, (symbol === 0 ? 2.5 : 3.6) * scale * metres));
        continue;
      }
      if (symbol === 20 || symbol >= 25) {
        if (p.span > 320 && symbol >= 25) continue;
        const r = Math.max(1.8 * unit, scale * metres * (symbol === 20 ? 1 : 0.65));
        ctx.strokeStyle = color('--jade');
        ctx.lineWidth = 0.65 * unit;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - r, y + r / 2);
        ctx.quadraticCurveTo(x - r, y - r, x - r * 0.35, y - r * 0.8);
        ctx.moveTo(x, y + r / 2);
        ctx.quadraticCurveTo(x - r * 0.2, y - r, x + r * 0.3, y - r);
        ctx.moveTo(x + r, y + r / 2);
        ctx.quadraticCurveTo(x + r * 0.2, y - r * 0.1, x + r, y - r * 0.5);
        ctx.stroke();
        if (symbol === 26) {
          ctx.fillStyle = color('--paper-raised');
          for (const offset of [-0.6, 0.2, 0.8]) {
            ctx.beginPath();
            ctx.arc(x + r * offset, y - r * 0.6, 1.4 * unit, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        continue;
      }
      const r = Math.max(3 * unit, (symbol === 5 ? 2 : symbol === 19 ? 3.8 : 3) * scale * metres);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(wx * 0.18 + wz * 0.11) * 0.5);
      // Two offset washes soften the canopy edge, with dry branching ink.
      ctx.fillStyle = color('--jade');
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.4, r * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = symbol === 3 || symbol === 19 ? 0.28 : 0.4;
      ctx.beginPath();
      const canopy: number[][] = [];
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2,
          lobe = 1 + Math.sin(a * (symbol === 1 || symbol === 2 ? 6 : 5)) * 0.1;
        const u = Math.cos(a) * r * lobe,
          v = Math.sin(a) * r * lobe * 0.78;
        canopy.push([u, v]);
      }
      ctx.moveTo((canopy[0][0] + canopy[23][0]) / 2, (canopy[0][1] + canopy[23][1]) / 2);
      canopy.forEach((q, i) => {
        const next = canopy[(i + 1) % canopy.length];
        ctx.quadraticCurveTo(q[0], q[1], (q[0] + next[0]) / 2, (q[1] + next[1]) / 2);
      });
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color('--jade');
      ctx.lineWidth = 0.65 * unit;
      ctx.stroke();
      ctx.globalAlpha = 0.33;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a + 0.25) * r * 0.4,
          Math.sin(a + 0.25) * r * 0.35,
          Math.cos(a) * r * 0.72,
          Math.sin(a) * r * 0.55,
        );
      }
      ctx.stroke();
      // Leaf crowns retain the accepted dry-brush artwork, while their real
      // roots and clustered wash describe cover. Exclude the upright trunk.
      if (p.symbols) {
        const cropHeight = symbol === 3 || symbol === 19 ? 78 : 64;
        ctx.globalAlpha = 0.88;
        ctx.drawImage(
          p.symbols,
          (symbol % 4) * 128 + 6,
          Math.floor(symbol / 4) * 128 + 4,
          116,
          cropHeight,
          -r * 1.05,
          -r * 0.76,
          r * 2.1,
          r * 1.4,
        );
      }
      if (symbol === 24) {
        ctx.fillStyle = color('--vermilion');
        ctx.globalAlpha = 0.45;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(Math.cos(k * 1.8) * r * 0.6, Math.sin(k * 1.8) * r * 0.5, unit, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    const occupiedLabels: { x: number; y: number }[] = [];
    for (const m of mapLandmarks) {
      if (!p.fog.has(fogKey(m.x, m.z))) continue;
      // Short fences read as footprints rather than oversized upright icons.
      if (m.pack === 4 && m.scene === 1) {
        ctx.strokeStyle = color('--gold-ink');
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = unit;
        ctx.beginPath();
        ctx.moveTo(sx(m.x) - (m.width * metres) / 2, sy(m.z));
        ctx.lineTo(sx(m.x) + (m.width * metres) / 2, sy(m.z));
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      const id =
        m.pack === 4
          ? 22 + m.scene
          : m.pack === 3
            ? 14 + m.scene
            : m.pack === 2
              ? 7 + m.scene
              : m.pack === 1
                ? m.scene === 0
                  ? 6
                  : 3
                : 10 + m.scene;
      const w = Math.max((p.miniature ? 11 : 18) * unit, m.width * metres * 1.15);
      icon(id, m.x, m.z, w);
      if (
        p.miniature ||
        p.span > 320 ||
        !(
          (m.pack === 3 && m.scene !== 1 && m.scene !== 4) ||
          (m.pack === 4 && m.scene === 0) ||
          !m.pack
        )
      )
        continue;
      const x = sx(m.x),
        y = sy(m.z) + 11 * unit;
      if (
        x < 45 * unit ||
        x > width - 45 * unit ||
        y < 15 * unit ||
        y > height - 25 * unit ||
        occupiedLabels.some((q) => Math.abs(q.x - x) < 70 * unit && Math.abs(q.y - y) < 20 * unit)
      )
        continue;
      occupiedLabels.push({ x, y });
      ctx.textAlign = 'center';
      ctx.font = `${11 * unit}px ${css.getPropertyValue('--font-display')}`;
      ctx.strokeStyle = color('--paper');
      ctx.lineWidth = 3 * unit;
      const name = m.names[p.locale === 'en' ? 2 : p.locale === 'zh-TW' ? 1 : 0];
      ctx.strokeText(name, x, y);
      ctx.fillStyle = color('--ink');
      ctx.fillText(name, x, y);
    }
  }
  // Opaque, stationary ink mist is world-anchored. Remove its explored part
  // with the same soft reveal mask that clips terrain, plants and buildings.
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const mc = mask.getContext('2d')!;
  for (const key of p.fog) {
    const [fx, fz] = key.split(':').map(Number),
      x = sx((fx + 0.5) * fogCell),
      y = sy((fz + 0.5) * fogCell),
      r = fogCell * 1.4 * metres;
    if (x < -r || y < -r || x > width + r || y > height + r) continue;
    const g = mc.createRadialGradient(x, y, r * 0.5, x, y, r);
    g.addColorStop(0, color('--paper'));
    g.addColorStop(1, 'transparent');
    mc.fillStyle = g;
    mc.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  const mist = document.createElement('canvas');
  mist.width = width;
  mist.height = height;
  const fc = mist.getContext('2d')!;
  const wash = document.createElement('canvas');
  wash.width = 160;
  wash.height = Math.max(1, Math.round((160 * height) / width));
  const wc = wash.getContext('2d')!,
    pigment = wc.createImageData(wash.width, wash.height);
  for (let j = 0; j < wash.height; j++)
    for (let i = 0; i < wash.width; i++) {
      const wx = p.center.x - ((i / wash.width) * width - width / 2) / metres;
      const wz = p.center.z - ((j / wash.height) * height - height / 2) / metres;
      const grain =
        0.16 + mistNoise(wx / 130, wz / 75) * 0.15 + mistNoise(wx / 53 + 8, wz / 21) * 0.055;
      pigment.data.set([...mix(paper, stone, grain), 255], (j * wash.width + i) * 4);
    }
  wc.putImageData(pigment, 0, 0);
  fc.drawImage(wash, 0, 0, width, height);
  fc.globalAlpha = 1;
  fc.globalCompositeOperation = 'destination-out';
  fc.drawImage(mask, 0, 0);
  ctx.drawImage(mist, 0, 0);
  const px = sx(p.player.x),
    py = sy(p.player.z),
    radius = (p.miniature ? 12 : 18) * unit;
  if (px > -radius && py > -radius && px < width + radius && py < height + radius) {
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = color('--paper');
    ctx.strokeStyle = color('--gold-ink');
    ctx.lineWidth = 1.5 * unit;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 2 * unit, 0, Math.PI * 2);
    ctx.clip();
    if (p.portrait)
      ctx.drawImage(
        p.portrait,
        -radius + 2 * unit,
        -radius + 2 * unit,
        radius * 2 - 4 * unit,
        radius * 2 - 4 * unit,
      );
    ctx.restore();
  }
  // Orientation follows westward game coordinates; no invented navigation path.
  ctx.fillStyle = color('--ink');
  ctx.beginPath();
  ctx.moveTo(width / 2, 12 * unit);
  ctx.lineTo(width / 2 - 3 * unit, 19 * unit);
  ctx.lineTo(width / 2 + 3 * unit, 19 * unit);
  ctx.fill();
  if (!p.miniature) {
    ctx.textAlign = 'center';
    ctx.font = `${11 * unit}px ${css.getPropertyValue('--font-display')}`;
    ctx.fillText(p.locale === 'en' ? 'WEST' : '西', width / 2, 31 * unit);
    const length = 25 * metres;
    ctx.strokeStyle = color('--ink');
    ctx.lineWidth = unit;
    ctx.beginPath();
    ctx.moveTo(18 * unit, height - 20 * unit);
    ctx.lineTo(18 * unit + length, height - 20 * unit);
    ctx.moveTo(18 * unit, height - 23 * unit);
    ctx.lineTo(18 * unit, height - 17 * unit);
    ctx.moveTo(18 * unit + length, height - 23 * unit);
    ctx.lineTo(18 * unit + length, height - 17 * unit);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillText('25 m', 18 * unit, height - 28 * unit);
  }
}
