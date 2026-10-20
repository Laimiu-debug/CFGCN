import { useEffect, useRef } from 'react';
import { paintInkMist, placeInkMist, reflectInkBoat, type InkMistFrame } from './ink-atmosphere';
import {
  advanceInkClock,
  inkBoats,
  inkClouds,
  inkFlags,
  inkJourney,
  inkPoint,
  inkSmoke,
  inkWalkers,
  type InkBoat,
  type InkJourney,
  type InkWalker,
} from './fine-ink-life';

export type InkCamera = { x: number; y: number; scale: number; width: number; height: number };
export type InkTouch = { x: number; y: number; serial: number };
export type InkOccluder = { image: string; x: number; y: number; width: number; height: number };
type Props = {
  camera: InkCamera;
  paused: boolean;
  ready: boolean;
  water: string[];
  waterMask: string;
  shoreFront: string;
  occluders: InkOccluder[];
  pointer: { x: number; y: number };
  touch: InkTouch | null;
  follow: string | null;
  onFollow: (x: number, y: number) => void;
  onReady: () => void;
  depth?: boolean;
  onDepthFrame?: (frame: InkLifeFrame) => void;
};
export type InkActorFrame = {
  id: string;
  x: number;
  y: number;
  kind: 'boat' | 'walker';
  tile: { x: number; y: number; width: number; height: number; foot: number };
};
export type InkLifeFrame = {
  water: HTMLCanvasElement;
  effects: HTMLCanvasElement;
  actors: HTMLCanvasElement;
  entities: InkActorFrame[];
  mists: InkMistFrame[];
};
type Palette = Record<
  'paper' | 'ink' | 'muted' | 'gold' | 'red' | 'jade' | 'water' | 'pink' | 'mist',
  string
>;
type Ripple = { x: number; y: number; born: number };
// Homepage route changes keep the current ecosystem time for this tab.
let savedWorldTime = 0;

function line(c: CanvasRenderingContext2D, points: number[], color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  for (let i = 0; i < points.length; i += 2) {
    if (i === 0) c.moveTo(points[i], points[i + 1]);
    else c.lineTo(points[i], points[i + 1]);
  }
  c.stroke();
}
function oval(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function boat(
  c: CanvasRenderingContext2D,
  actor: InkBoat,
  at: InkJourney,
  t: number,
  p: Palette,
  waterWake = true,
) {
  c.save();
  c.translate(at.x, at.y);
  const facing = at.dx >= 0 ? 1 : -1;
  c.scale(actor.size * facing, actor.size);
  c.rotate(Math.atan2(at.dy, Math.abs(at.dx)) * 0.14 * facing);
  const bob = Math.sin(t * 1.4 + actor.phase) * 0.55;
  c.translate(0, bob);
  // The wake remains tied to this hull, and disappears while it waits at the quay.
  if (at.moving && waterWake) {
    c.globalAlpha = 0.42;
    line(c, [-22, 2, -34, 5, -49, 5], p.paper, 1.5);
    line(c, [-19, 5, -32, 9, -43, 9], p.paper, 0.9);
    line(c, [-20, -2, -32, -5, -44, -5], p.paper, 1.1);
  }
  c.globalAlpha = 0.16;
  oval(c, 1, 7, 27, 5, p.ink);
  c.globalAlpha = 1;
  c.fillStyle = p.gold;
  c.beginPath();
  c.moveTo(-25, -3);
  c.quadraticCurveTo(0, 4, 29, -5);
  c.lineTo(23, 6);
  c.quadraticCurveTo(0, 12, -20, 5);
  c.closePath();
  c.fill();
  line(c, [-25, -3, -18, 4, 21, 5, 29, -5], p.ink, 1.35);
  line(c, [-17, 1, 19, 1], p.paper, 0.8);
  if (actor.kind === 'cargo') {
    line(c, [1, 0, 1, -44], p.ink, 1.1);
    c.fillStyle = actor.id === 'jinling-barge' ? p.red : p.gold;
    c.beginPath();
    c.moveTo(3, -43);
    c.quadraticCurveTo(22 + Math.sin(t) * 2, -26, 17, -8);
    c.lineTo(3, -10);
    c.closePath();
    c.fill();
    for (let j = 0; j < 5; j++) line(c, [4, -37 + j * 6, 17, -34 + j * 5.6], p.ink, 0.45);
    c.fillStyle = p.paper;
    c.fillRect(-18, -7, 12, 7);
    line(c, [-18, -8, -6, -8], p.ink, 1);
  } else if (actor.kind === 'ferry') {
    c.fillStyle = p.gold;
    c.beginPath();
    c.moveTo(-17, 0);
    c.quadraticCurveTo(-13, -19, 4, -17);
    c.quadraticCurveTo(13, -14, 16, 0);
    c.closePath();
    c.fill();
    for (let j = 0; j < 4; j++) {
      c.beginPath();
      c.moveTo(-15 + j * 7, 0);
      c.quadraticCurveTo(-13 + j * 7, -14, -9 + j * 7, -14);
      c.strokeStyle = p.ink;
      c.lineWidth = 0.65;
      c.stroke();
    }
    oval(c, -5, -12, 2, 2.3, p.gold);
    line(c, [-5, -9, -5, -4], p.jade, 3);
    oval(c, 5, -11, 2, 2.3, p.gold);
    line(c, [5, -8, 5, -3], p.red, 2.7);
  }
  // Boatman, oar pivot and rowing recovery are separate from the moving hull.
  oval(c, 18, -13, 2.5, 2.8, p.gold);
  line(c, [18, -10, 17, -4, 13, -1, 22, -1], p.ink, 2.2);
  const oar = at.moving ? Math.sin(t * 2.2 + actor.phase) * 5 * Math.min(1, at.pace ?? 1) : 0;
  line(c, [17, -7, 26, 4 + oar, 33, 10 + oar], p.ink, 1.2);
  line(c, [30, 7 + oar, 35, 12 + oar], p.gold, 2.4);
  c.restore();
}

function walker(
  c: CanvasRenderingContext2D,
  actor: InkWalker,
  at: InkJourney,
  t: number,
  p: Palette,
) {
  c.save();
  c.translate(at.x, at.y);
  c.scale(actor.size * (at.dx < 0 ? -1 : 1), actor.size);
  const stride = at.moving
    ? Math.sin(t * 5.8 + actor.phase) * 3.3 * Math.min(1, at.pace ?? 1)
    : Math.sin(t * 0.7 + actor.phase) * 0.2;
  const skin = p.gold;
  const cloth =
    actor.kind === 'monk'
      ? p.red
      : actor.kind === 'monkey'
        ? p.gold
        : actor.town === 'honglou'
          ? p.pink
          : actor.town === 'shuihu'
            ? p.water
            : p.jade;
  c.globalAlpha = 0.18;
  oval(c, 0, 1, 5, 1.7, p.ink);
  c.globalAlpha = 1;
  line(c, [-1, -6, -3 + stride, -1, -4 + stride, 0], p.ink, 1.65);
  line(c, [1, -6, 3 - stride, -1, 4 - stride, 0], p.ink, 1.65);
  c.fillStyle = cloth;
  c.beginPath();
  c.moveTo(-3, -16);
  c.lineTo(3, -16);
  c.lineTo(actor.kind === 'lady' ? 6 : 4, -5);
  c.lineTo(-4, -5);
  c.closePath();
  c.fill();
  line(c, [-3, -14, -5 - stride * 0.6, -9, -3 - stride * 0.8, -8], cloth, 2);
  line(c, [3, -14, 5 + stride * 0.6, -10, 7 + stride * 0.4, -11], cloth, 2);
  oval(c, 0.7, -19, 2.6, 3.1, skin);
  if (actor.kind === 'farmer' || actor.kind === 'resident' || actor.kind === 'porter') {
    c.fillStyle = p.gold;
    c.beginPath();
    c.moveTo(-5, -20);
    c.lineTo(0, -24);
    c.lineTo(6, -20);
    c.closePath();
    c.fill();
    line(c, [-5, -20, 6, -20], p.ink, 0.6);
  } else if (actor.kind === 'monk') {
    c.fillStyle = p.gold;
    c.beginPath();
    c.moveTo(-3, -21);
    c.lineTo(-2, -27);
    c.lineTo(0, -24);
    c.lineTo(2, -27);
    c.lineTo(4, -21);
    c.closePath();
    c.fill();
    line(c, [7, 0, 7, -26], p.gold, 1.1);
    oval(c, 7, -27, 2.5, 2.5, p.gold);
    oval(c, 7, -27, 1.4, 1.4, p.paper);
  } else if (actor.kind === 'monkey') {
    line(c, [7, 1, 7, -29], p.gold, 1.5);
    line(c, [-2, -20, 3, -21], p.red, 1.3);
    c.beginPath();
    c.moveTo(-3, -7);
    c.quadraticCurveTo(-12, -14, -9, -18);
    c.strokeStyle = p.gold;
    c.lineWidth = 1.3;
    c.stroke();
  } else if (actor.kind === 'pig') {
    oval(c, 1, -12, 4.6, 5.4, cloth);
    oval(c, 4, -19, 2, 1.3, skin);
    line(c, [7, 0, 7, -28, 12, -28], p.ink, 1.2);
  } else if (actor.kind === 'sandy') {
    line(c, [-9, -25, 10, -7], p.ink, 1.3);
    oval(c, -10, -26, 3.2, 2, p.gold);
  } else if (actor.kind === 'lady') {
    oval(c, 0, -22, 2, 1.9, p.ink);
    line(c, [-1, -23, 5, -23], p.red, 0.9);
    c.fillStyle = p.paper;
    c.beginPath();
    c.arc(8 + stride * 0.2, -12, 3.5, Math.PI, Math.PI * 2);
    c.fill();
  }
  if (actor.kind === 'porter') {
    line(c, [-11, -17, 11, -17], p.ink, 1.2);
    line(c, [-10, -17, -10, -8, 10, -8, 10, -17], p.gold, 0.7);
    oval(c, -10, -6, 3, 2.5, p.gold);
    oval(c, 10, -6, 3, 2.5, p.gold);
  }
  c.restore();
}

function cloud(
  c: CanvasRenderingContext2D,
  at: (typeof inkClouds)[number],
  t: number,
  pointer: Props['pointer'],
  p: Palette,
) {
  const drift = Math.sin((t * at.speed) / 32 + at.phase) * 52 + Math.sin(t / 67 + at.phase) * 72;
  const [x, y] = inkPoint(at.x + drift, at.y + Math.sin(t / 19 + at.phase) * 6);
  const [w, h] = inkPoint(at.width, at.height);
  c.save();
  c.translate(x + pointer.x * at.depth * 17, y + pointer.y * at.depth * 8);
  for (let j = 0; j < 8; j++) {
    const localX = (j / 7 - 0.5) * w;
    const localY = Math.sin(j * 2.3 + at.phase) * h * 0.18;
    const radius = w * (0.22 + Math.sin(j + 2) * 0.035);
    c.save();
    c.translate(localX, localY);
    c.scale(radius, h * (0.32 + Math.sin(j * 3 + 1) * 0.09));
    const gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, p.paper);
    gradient.addColorStop(0.3, p.paper);
    gradient.addColorStop(1, 'transparent');
    c.globalAlpha = 0.36;
    c.fillStyle = gradient;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
  }
  c.restore();
}

export function FineInkLife(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(props);
  current.current = props;
  useEffect(() => {
    const node = canvas.current!;
    const c = node.getContext('2d', { alpha: true });
    if (!c) return;
    const css = getComputedStyle(node);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const p: Palette = {
      paper: color('--paper-raised'),
      ink: color('--ink'),
      muted: color('--muted'),
      gold: color('--gold'),
      red: color('--vermilion'),
      jade: color('--jade'),
      water: color('--accent-shuihu'),
      pink: color('--accent-honglou'),
      mist: color('--scene-mist'),
    };
    let raf = 0,
      last = 0,
      elapsed = savedWorldTime,
      lastReport = -1,
      lastTouch = -1,
      first = true;
    let water: Path2D[] = [],
      waterSource: string[] | null = null;
    const ripples: Ripple[] = [];
    const surface = document.createElement('canvas');
    surface.width = 1586;
    surface.height = 992;
    const wc = surface.getContext('2d')!;
    const effects = document.createElement('canvas');
    effects.width = 1586;
    effects.height = 992;
    const ec = effects.getContext('2d')!;
    const atlas = document.createElement('canvas');
    atlas.width = 1024;
    atlas.height = 512;
    const ac = atlas.getContext('2d')!;
    const mistPaints = paintInkMist(p.paper);
    let maskImage: HTMLImageElement | null = null;
    let maskPixels: Uint8ClampedArray | null = null;
    let maskSource = '';
    const cutouts = new Map<string, HTMLImageElement>();
    const headings = new Map<string, { dx: number; dy: number }>();
    let disposed = false;
    let dirty = true;
    let lastPaintProps: Props | null = null;
    const draw = (now: number) => {
      if (disposed) return;
      const v = current.current;
      const active = !v.paused && !document.hidden && v.ready;
      elapsed = advanceInkClock(elapsed, last ? now - last : 0, active);
      last = now;
      if (!active && lastPaintProps === v && !dirty) {
        node.dataset.running = 'false';
        raf = requestAnimationFrame(draw);
        return;
      }
      lastPaintProps = v;
      dirty = false;
      if (v.waterMask !== maskSource) {
        maskSource = v.waterMask;
        maskImage = new Image();
        maskImage.onload = () => {
          wc.setTransform(1, 0, 0, 1, 0, 0);
          wc.clearRect(0, 0, 1586, 992);
          wc.drawImage(maskImage!, 0, 0, 1586, 992);
          maskPixels = wc.getImageData(0, 0, 1586, 992).data;
          dirty = true;
          node.dataset.waterReady = 'true';
        };
        maskImage.src = v.waterMask;
      }
      if (waterSource !== v.water) {
        waterSource = v.water;
        water = v.water.filter(Boolean).map((d) => new Path2D(d));
      }
      const dpr = v.depth ? 1 : Math.min(devicePixelRatio || 1, 2);
      const { width, height, x, y, scale } = v.camera;
      const pw = Math.round(width * dpr),
        ph = Math.round(height * dpr);
      if (node.width !== pw || node.height !== ph) {
        node.width = pw;
        node.height = ph;
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);
      c.translate(x, y);
      c.scale(scale, scale);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (v.touch && v.touch.serial !== lastTouch) {
        lastTouch = v.touch.serial;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        const mx = Math.floor((v.touch.x / 2400) * 1586),
          my = Math.floor((v.touch.y / 1501) * 992);
        const wet =
          maskPixels && mx >= 0 && my >= 0 && mx < 1586 && my < 992
            ? maskPixels[(my * 1586 + mx) * 4 + 3] > 60
            : water.some((path) => c.isPointInPath(path, v.touch!.x, v.touch!.y));
        c.restore();
        if (wet) ripples.push({ x: v.touch.x, y: v.touch.y, born: elapsed });
      }
      // Every water channel has its own mask. The wash never covers a field or a bank.
      wc.setTransform(1586 / 2400, 0, 0, 992 / 1501, 0, 0);
      wc.clearRect(0, 0, 2400, 1501);
      wc.save();
      const allWater = new Path2D();
      water.forEach((path) => allWater.addPath(path));
      if (!maskPixels) wc.clip(allWater);
      wc.globalAlpha = 0.04;
      wc.fillStyle = p.water;
      wc.fillRect(0, 0, 2400, 1501);
      for (let j = 0; j < 170; j++) {
        const px = ((j * 179.37 + elapsed * (3 + (j % 3))) % 2500) - 50;
        const py = ((j * 79.113) % 1460) + Math.sin(elapsed / 3 + j) * 2.1;
        const span = 12 + (j % 7) * 5;
        wc.globalAlpha = 0.1 + Math.sin(elapsed * 0.8 + j) * 0.06;
        wc.strokeStyle = j % 3 ? p.paper : p.water;
        wc.lineWidth = 0.8;
        wc.beginPath();
        wc.moveTo(px, py);
        wc.quadraticCurveTo(px + span / 2, py - 2, px + span, py);
        wc.stroke();
      }
      for (let j = ripples.length - 1; j >= 0; j--) {
        const r = ripples[j],
          age = elapsed - r.born;
        if (age > 4.2) {
          ripples.splice(j, 1);
          continue;
        }
        for (let k = 0; k < 3; k++) {
          const radius = Math.max(0, age * 17 - k * 9);
          wc.globalAlpha = (1 - age / 4.2) * 0.6;
          wc.strokeStyle = p.paper;
          wc.lineWidth = 1.5;
          wc.beginPath();
          wc.ellipse(r.x, r.y, radius, radius * 0.32, 0, 0, Math.PI * 2);
          wc.stroke();
        }
      }
      wc.restore();
      if (maskPixels && maskImage && !v.depth) {
        wc.save();
        wc.globalCompositeOperation = 'destination-in';
        wc.drawImage(maskImage, 0, 0, 2400, 1501);
        wc.restore();
      }
      if (!v.depth) c.drawImage(surface, 0, 0, 2400, 1501);
      ac.clearRect(0, 0, 1024, 512);
      ac.lineCap = 'round';
      ac.lineJoin = 'round';
      const entities: InkActorFrame[] = [];
      const boats = inkBoats.map((actor) => ({
        actor,
        at: inkJourney(actor.route, elapsed, actor.speed, actor.dwell, actor.phase, 2.4),
      }));
      for (const [i, { actor, at }] of boats.entries()) {
        const heading = headings.get(actor.id) ?? { dx: at.dx, dy: at.dy };
        if (active) {
          heading.dx += (at.dx - heading.dx) * 0.1;
          heading.dy += (at.dy - heading.dy) * 0.1;
        }
        headings.set(actor.id, heading);
        if (v.depth) {
          const tile = {
            x: (i % 8) * 128,
            y: Math.floor(i / 8) * 112,
            width: 128,
            height: 112,
            foot: 96,
          };
          boat(
            ac,
            actor,
            { ...at, x: tile.x + 64, y: tile.y + tile.foot, dx: heading.dx, dy: heading.dy },
            elapsed,
            p,
            false,
          );
          reflectInkBoat(
            wc,
            atlas,
            tile,
            { ...at, dx: heading.dx, dy: heading.dy },
            actor.size,
            elapsed,
            p.paper,
          );
          entities.push({ id: actor.id, x: at.x, y: at.y, kind: 'boat', tile });
        } else boat(c, actor, { ...at, dx: heading.dx, dy: heading.dy }, elapsed, p);
      }
      if (v.depth && maskImage && maskPixels) {
        wc.save();
        wc.globalCompositeOperation = 'destination-in';
        wc.drawImage(maskImage, 0, 0, 2400, 1501);
        wc.restore();
      }
      if (!v.depth) {
        let shore = cutouts.get(v.shoreFront);
        if (!shore) {
          shore = new Image();
          shore.onload = () => {
            dirty = true;
          };
          shore.src = v.shoreFront;
          cutouts.set(v.shoreFront, shore);
        }
        if (shore.complete && shore.naturalWidth) c.drawImage(shore, 0, 0, 2400, 1501);
      }
      // Actual extracted bridge fronts are drawn after hulls, before bridge pedestrians.
      for (const o of v.depth ? [] : v.occluders) {
        let image = cutouts.get(o.image);
        if (!image) {
          image = new Image();
          image.onload = () => {
            dirty = true;
          };
          image.src = o.image;
          cutouts.set(o.image, image);
        }
        if (image.complete && image.naturalWidth) c.drawImage(image, o.x, o.y, o.width, o.height);
      }
      inkWalkers
        .map((actor) => ({
          actor,
          at: inkJourney(actor.route, elapsed, actor.speed, actor.dwell, actor.phase, 0.55),
        }))
        .sort((a, b) => a.at.y - b.at.y)
        .forEach(({ actor, at }, i) => {
          if (v.depth) {
            const tile = {
              x: (i % 12) * 64,
              y: 256 + Math.floor(i / 12) * 64,
              width: 64,
              height: 64,
              foot: 56,
            };
            walker(ac, actor, { ...at, x: tile.x + 32, y: tile.y + tile.foot }, elapsed, p);
            entities.push({ id: actor.id, x: at.x, y: at.y, kind: 'walker', tile });
          } else walker(c, actor, at, elapsed, p);
        });
      // Thin village smoke, flags and birds have their own clock / phase, not whole-image motion.
      inkSmoke.forEach(([sx, sy], j) => {
        for (let k = 0; k < 4; k++) {
          const age = (elapsed * 0.12 + k * 0.24 + j * 0.13) % 1;
          const xx = sx + Math.sin(age * 4 + j) * 8 + age * 12,
            yy = sy - age * 51;
          c.globalAlpha = Math.sin(age * Math.PI) * 0.16;
          c.strokeStyle = p.paper;
          c.lineWidth = 3 + age * 8;
          c.beginPath();
          c.moveTo(xx, yy);
          c.quadraticCurveTo(xx - 8, yy - 7, xx + 5, yy - 16);
          c.stroke();
        }
      });
      c.globalAlpha = 1;
      inkFlags.forEach(([fx, fy], j) => {
        line(c, [fx, fy, fx, fy - 26], p.ink, 0.8);
        c.fillStyle = p.red;
        c.beginPath();
        c.moveTo(fx, fy - 26);
        c.quadraticCurveTo(fx + 8, fy - 28 + Math.sin(elapsed * 1.8 + j) * 2, fx + 15, fy - 23);
        c.lineTo(fx + 14, fy - 12);
        c.quadraticCurveTo(fx + 5, fy - 17, fx, fy - 15);
        c.closePath();
        c.fill();
      });
      for (let j = 0; j < 9; j++) {
        const bx = ((elapsed * 8 + j * 26) % 1100) + 600,
          by = 210 + Math.sin(elapsed / 17) * 32 + (j % 3) * 9;
        const wing = Math.sin(elapsed * 4 + j * 0.8) * 2.4;
        c.globalAlpha = 0.65;
        c.strokeStyle = p.ink;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(bx - 4, by - wing);
        c.quadraticCurveTo(bx - 1, by - 2, bx, by);
        c.quadraticCurveTo(bx + 1, by - 2, bx + 4, by - wing);
        c.stroke();
      }
      c.globalAlpha = 1;
      if (v.depth) {
        ec.clearRect(0, 0, 1586, 992);
        ec.drawImage(node, 0, 0, 1586, 992);
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, node.width, node.height);
        c.restore();
      }
      if (!v.depth) inkClouds.forEach((at) => cloud(c, at, elapsed, v.pointer, p));
      if (v.depth)
        v.onDepthFrame?.({
          water: surface,
          effects,
          actors: atlas,
          entities,
          mists: placeInkMist(mistPaints, elapsed),
        });
      if (now - lastReport > 120) {
        node.dataset.worldTime = elapsed.toFixed(2);
        node.dataset.running = String(active);
        node.dataset.boats = JSON.stringify(
          boats.map(({ actor, at }) => ({
            id: actor.id,
            x: +at.x.toFixed(1),
            y: +at.y.toFixed(1),
            docked: !at.moving,
          })),
        );
        node.dataset.ripples = String(ripples.length);
        node.dataset.mists = JSON.stringify(
          placeInkMist(mistPaints, elapsed).map((m) => ({
            id: m.id,
            x: +m.bounds[0].toFixed(2),
            y: +m.bounds[1].toFixed(2),
            lift: m.lift,
          })),
        );
        node.dataset.reflections = String(v.depth ? boats.length : 0);
        lastReport = now;
        const tracked = boats.find((b) => b.actor.id === v.follow);
        if (tracked && active) v.onFollow(tracked.at.x, tracked.at.y);
      }
      if (first && v.ready) {
        first = false;
        v.onReady();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      savedWorldTime = elapsed;
      cutouts.clear();
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      className="fine-ink-life"
      data-depth-source={props.depth ? 'true' : undefined}
      aria-hidden="true"
      data-layer-count="6"
      data-vessels={inkBoats.length}
      data-residents={inkWalkers.length}
    />
  );
}
