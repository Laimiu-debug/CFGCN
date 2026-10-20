import { inkActorScale, type InkBoat, type InkWalker, type InkJourney } from './fine-ink-life';

export type InkPalette = Record<
  'paper' | 'ink' | 'muted' | 'gold' | 'red' | 'jade' | 'water' | 'pink' | 'mist',
  string
>;

function line(c: CanvasRenderingContext2D, points: number[], color: string, width = 1) {
  c.beginPath();
  c.strokeStyle = color;
  c.lineWidth = width;
  for (let i = 0; i < points.length; i += 2)
    if (i) c.lineTo(points[i], points[i + 1]);
    else c.moveTo(points[i], points[i + 1]);
  c.stroke();
}
function oval(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
// Broken translucent strokes keep the tiny figures in the landscape's brush scale.
function wash(
  c: CanvasRenderingContext2D,
  path: Path2D,
  color: string,
  p: InkPalette,
  seed: number,
) {
  c.save();
  c.globalAlpha *= 0.76;
  c.fillStyle = color;
  c.fill(path);
  c.clip(path);
  for (let i = 0; i < 8; i++) {
    c.globalAlpha = 0.13 + (i % 3) * 0.04;
    const x = ((i * 13 + seed * 7) % 47) - 23,
      y = -45 + ((i * 17 + seed * 5) % 57);
    line(c, [x, y, x + 9, y + 1.4], i % 2 ? p.paper : p.ink, 0.35);
  }
  c.restore();
}

export function paintBoat(
  c: CanvasRenderingContext2D,
  actor: InkBoat,
  at: InkJourney,
  t: number,
  p: InkPalette,
) {
  c.save();
  c.translate(at.x, at.y);
  const direction = at.dx < 0 ? -1 : 1,
    size = actor.size * inkActorScale.boat;
  c.scale(size * direction, size);
  c.rotate(Math.atan2(at.dy, Math.abs(at.dx)) * 0.12 * direction);
  c.translate(0, Math.sin(t * 1.2 + actor.phase) * 0.22);
  if (at.moving) {
    c.globalAlpha = 0.35;
    line(c, [-24, 3, -31, 4, -41, 4], p.paper, 0.8);
    line(c, [-23, -1, -31, -2, -38, -2], p.muted, 0.4);
    line(c, [-22, 6, -29, 7, -36, 7], p.paper, 0.55);
  }
  c.globalAlpha = 0.1;
  oval(c, 1, 5, 25, 3, p.ink);
  c.globalAlpha = 1;
  const hull = new Path2D('M-25 -2Q-5 4 28 -4L23 4Q1 9 -19 4Z');
  wash(c, hull, p.muted, p, 3);
  c.globalAlpha = 0.55;
  line(c, [-24, -2, -17, 3, 2, 5, 22, 3, 28, -4], p.ink, 0.85);
  line(c, [-17, 0, -2, 2, 19, 0], p.gold, 1.2);
  line(c, [-15, 3, 3, 4, 20, 2], p.paper, 0.5);
  c.globalAlpha = 1;
  if (actor.kind === 'cargo') {
    line(c, [0, 0, 0, -40], p.ink, 0.7);
    const sail = new Path2D(`M2 -39Q${15 + Math.sin(t * 0.6) * 0.8} -31 18 -10L3 -8Z`);
    wash(c, sail, p.paper, p, 9);
    c.globalAlpha = 0.55;
    line(c, [2, -39, 18, -10, 3, -8], p.muted, 0.55);
    for (let j = 0; j < 5; j++)
      line(c, [3, -34 + j * 5, 14 + j * 0.8, -31 + j * 4.7], p.gold, 0.45);
    line(c, [-18, -4, -16, -10, -4, -9, -2, -3], p.muted, 0.7);
    c.globalAlpha = 0.5;
    oval(c, -10, -5, 5, 3, p.gold);
    c.globalAlpha = 1;
  } else if (actor.kind === 'ferry') {
    const cover = new Path2D('M-17 0Q-16 -14 -6 -16Q8 -17 13 -2L10 0Z');
    wash(c, cover, p.gold, p, 5);
    c.globalAlpha = 0.55;
    for (let j = 0; j < 5; j++) {
      c.beginPath();
      c.moveTo(-16 + j * 5, 0);
      c.quadraticCurveTo(-16 + j * 5, -11, -10 + j * 5, -14 + j * 0.8);
      c.strokeStyle = p.ink;
      c.lineWidth = 0.45;
      c.stroke();
    }
    line(c, [-15, -1, 11, -1], p.paper, 0.7);
    c.globalAlpha = 1;
  }
  // A quiet standing boatman, with a separate oar stroke and recovery.
  c.globalAlpha = 0.75;
  oval(c, 17, -12, 1.6, 2, p.paper);
  line(c, [14, -14, 18, -15, 20, -13], p.muted, 0.65);
  const coat = new Path2D('M15 -10L19 -10L20 -4L14 -4Z');
  wash(c, coat, p.ink, p, 2);
  line(c, [16, -4, 15, 0, 13, 1, 18, 0, 19, -3], p.ink, 0.7);
  const stroke = at.moving ? Math.sin(t * 1.7 + actor.phase) * 2.5 : 0;
  line(c, [17, -8, 22, -5, 31, 6 + stroke], p.muted, 0.8);
  line(c, [29, 4 + stroke, 33, 8 + stroke], p.gold, 1.4);
  c.restore();
}

export function paintWalker(
  c: CanvasRenderingContext2D,
  actor: InkWalker,
  at: InkJourney,
  t: number,
  p: InkPalette,
) {
  c.save();
  c.translate(at.x, at.y);
  const size = actor.size * inkActorScale.walker;
  c.scale(size * (at.dx < 0 ? -1 : 1), size);
  const phase = t * 4.3 + actor.phase,
    stride = at.moving ? Math.sin(phase) * 1.7 : 0;
  const monk = actor.kind === 'monk',
    lady = actor.kind === 'lady',
    pig = actor.kind === 'pig';
  const width = pig ? 5.2 : lady ? 3.2 : 2.8;
  c.globalAlpha = 0.12;
  oval(c, 0, 0.3, 3.9, 0.8, p.ink);
  c.globalAlpha = 0.8;
  line(c, [-1, -5, -1.2 + stride, -0.6, -2.5 + stride, 0], p.ink, 0.9);
  line(c, [1, -5, 1.2 - stride, -0.8, 2.8 - stride, 0], p.ink, 0.9);
  const robe = new Path2D(
    `M${-width} -19Q0 -20 ${width} -18L${width + 1.2} -6Q1 -4 ${-width - 1} -6Z`,
  );
  const color = monk ? p.red : lady ? p.pink : actor.kind === 'monkey' ? p.gold : p.muted;
  wash(c, robe, color, p, actor.phase);
  c.globalAlpha = 0.6;
  line(c, [-width, -18, -width - 0.6, -12, -width - 1.8 - stride * 0.35, -10], p.ink, 0.75);
  line(c, [width, -17, width + 1.5 + stride * 0.3, -13, width + 2.6, -12], p.muted, 0.85);
  line(c, [-1, -18, 0, -11, -0.5, -6], p.paper, 0.65);
  line(c, [-width, -7, width, -6], p.ink, 0.5);
  c.globalAlpha = 0.9;
  oval(c, 0.4, -22, 1.8, 2.3, p.paper);
  c.globalAlpha = 0.5;
  line(c, [0.3, -23.5, 1.6, -22, 0.9, -20.5], p.gold, 0.8);
  c.globalAlpha = 0.65;
  if (['farmer', 'resident', 'porter'].includes(actor.kind)) {
    line(c, [-3.5, -23, 0, -25, 3.7, -23, -3.5, -23], p.muted, 0.8);
    line(c, [-2.5, -23, 2.5, -23], p.gold, 0.8);
  } else if (monk) {
    line(c, [-1.7, -23.5, -1.5, -27, 0, -25, 1.4, -27, 2.3, -23.5], p.gold, 0.8);
    line(c, [6.2, 0, 6.2, -25], p.muted, 0.7);
    c.beginPath();
    c.arc(6.2, -26, 1.8, 0, Math.PI * 2);
    c.strokeStyle = p.gold;
    c.lineWidth = 0.7;
    c.stroke();
  } else if (actor.kind === 'monkey') {
    line(c, [5.5, 0, 5.5, -27], p.gold, 0.8);
    line(c, [-1, -24, 2, -24], p.gold, 0.8);
  } else if (lady) {
    oval(c, -0.6, -24, 1.8, 1.1, p.ink);
    line(c, [-3, -17, -4, -9, -6, -6], p.paper, 0.8);
  } else {
    line(c, [-2, -24, 2, -24], p.ink, 1.2);
  }
  if (actor.kind === 'porter') {
    line(c, [-9, -17, 9, -16], p.muted, 0.65);
    line(c, [-8, -17, -8, -8, 8, -7, 8, -16], p.gold, 0.5);
    oval(c, -8, -6, 2.5, 1.6, p.gold);
    oval(c, 8, -5, 2.6, 1.7, p.muted);
  }
  c.restore();
}
