import { inkGroundDepth, inkLayerDepth, type DepthLayer } from './ink-depth';

// The water painted into a bank / mountain cutout moves with that cutout too.
// Anchoring a hull to a separate ground plane makes it slide ashore on camera motion.
export function inkPaintDepth(
  layers: DepthLayer[],
  x: number,
  y: number,
  opaque: (layer: DepthLayer, x: number, y: number) => boolean,
  water = false,
) {
  let depth = inkGroundDepth(y);
  for (const layer of layers) {
    if (water && layer.kind === 'bridge') continue;
    if (opaque(layer, x, y)) depth = Math.max(depth, inkLayerDepth(layer, x, y));
  }
  return depth;
}

export function inkZoomLimit(size: { width: number; height: number }) {
  const aspect = size.width / size.height;
  const extent = Math.min(1501, 2400 / aspect) * 0.88;
  const sourceScale = (size.height / extent) * (2400 / 1586);
  // Avoid tripling a soft source. Wide displays still get a small inspection range;
  // this is a viewing limit, not a claim that resampling adds painted detail.
  return Math.max(1.35, Math.min(1.6, 1.35 / sourceScale));
}
