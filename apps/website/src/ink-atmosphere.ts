import { inkClouds, inkPoint, type InkJourney } from './fine-ink-life';

export type InkMistFrame = {
  id: string;
  image: HTMLCanvasElement;
  bounds: [number, number, number, number];
  lift: number;
};
export type InkMistPaint = { image: HTMLCanvasElement; index: number };

// Code-painted mist is cached once. Its independently placed meshes move through
// the valleys; no full-screen cloud bitmap is repainted and uploaded each frame.
export function paintInkMist(paper: string): InkMistPaint[] {
  return inkClouds.map((at, index) => {
    const image = document.createElement('canvas');
    image.width = 512;
    image.height = 96;
    const c = image.getContext('2d')!;
    c.lineCap = 'round';
    c.strokeStyle = paper;
    c.shadowColor = paper;
    c.shadowBlur = 7;
    for (let i = 0; i < 16; i++) {
      const phase = i * 1.77 + at.phase;
      const y = 46 + Math.sin(phase) * 13;
      const start = 18 + (i % 5) * 13;
      const end = 492 - (i % 4) * 15;
      c.globalAlpha = 0.055 + Math.sin(i * 2.4) * 0.018;
      c.lineWidth = 5 + (i % 4) * 2;
      c.beginPath();
      c.moveTo(start, y + Math.sin(phase + 2) * 5);
      c.bezierCurveTo(162, y - 12, 302, y + 9, end, y + Math.cos(phase) * 6);
      c.stroke();
    }
    // Feather the ends without making circular fog stamps.
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    c.globalCompositeOperation = 'destination-in';
    const fade = c.createLinearGradient(0, 0, 512, 0);
    fade.addColorStop(0, 'transparent');
    fade.addColorStop(0.16, paper);
    fade.addColorStop(0.8, paper);
    fade.addColorStop(1, 'transparent');
    c.fillStyle = fade;
    c.fillRect(0, 0, 512, 96);
    return { image, index };
  });
}

export function placeInkMist(paints: InkMistPaint[], time: number): InkMistFrame[] {
  return paints.map(({ image, index }) => {
    const at = inkClouds[index];
    const drift =
      Math.sin((time * at.speed) / 36 + at.phase) * 45 + Math.sin(time / 85 + at.phase) * 30;
    const [x, y] = inkPoint(at.x + drift, at.y + Math.sin(time / 23 + at.phase) * 4);
    const [width, height] = inkPoint(at.width, at.height * 1.1);
    return {
      id: `valley-mist-${index}`,
      image,
      bounds: [x - width / 2, y - height / 2, width, height],
      lift: 80 + at.depth * 160,
    };
  });
}

export function reflectInkBoat(
  c: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement,
  tile: { x: number; y: number; width: number; height: number; foot: number },
  at: InkJourney,
  size: number,
  time: number,
  paper: string,
) {
  c.save();
  c.translate(at.x, at.y + size * 7);
  c.scale(1, -0.28);
  for (let row = 0; row < tile.foot + 8; row += 4) {
    c.globalAlpha = 0.13 * Math.pow(Math.min(1, (row + 3) / tile.foot), 0.8);
    const sway = Math.sin(time * 1.8 + row * 0.31) * 1.7;
    c.drawImage(
      atlas,
      tile.x,
      tile.y + row,
      tile.width,
      3,
      -tile.width / 2 + sway,
      row - tile.foot,
      tile.width,
      3,
    );
  }
  c.restore();
  if (!at.moving) return;
  c.save();
  c.translate(at.x, at.y + 4);
  c.rotate(Math.atan2(at.dy, at.dx));
  c.scale(size, size);
  c.strokeStyle = paper;
  c.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    c.globalAlpha = (0.26 - i * 0.055) * Math.min(1, at.pace ?? 1);
    c.beginPath();
    c.moveTo(-10 - i * 9, -3);
    c.quadraticCurveTo(-24 - i * 11, -7 - i * 2, -41 - i * 10, -9 - i * 3);
    c.moveTo(-10 - i * 9, 3);
    c.quadraticCurveTo(-24 - i * 11, 7 + i * 2, -41 - i * 10, 9 + i * 3);
    c.stroke();
  }
  c.restore();
}
