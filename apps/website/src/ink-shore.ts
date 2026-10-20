type Pixels = { data: Uint8ClampedArray; width: number; height: number };

// A small distance field makes the relief meet the authored water boundary. The
// painting is sampled once on load; this is not a per-frame terrain operation.
export function createInkShore(pixels: Pixels) {
  const width = 600,
    height = 376;
  const distances = new Float32Array(width * height);
  const wet = (x: number, y: number) => {
    const px = Math.max(0, Math.min(pixels.width - 1, Math.round((x / 2400) * (pixels.width - 1)))),
      py = Math.max(0, Math.min(pixels.height - 1, Math.round((y / 1501) * (pixels.height - 1))));
    return pixels.data[(py * pixels.width + px) * 4 + 3] > 128;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      distances[y * width + x] = wet((x * 2400) / (width - 1), (y * 1501) / (height - 1))
        ? 0
        : 10000;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x) distances[i] = Math.min(distances[i], distances[i - 1] + 1);
      if (y) distances[i] = Math.min(distances[i], distances[i - width] + 1);
      if (x && y) distances[i] = Math.min(distances[i], distances[i - width - 1] + Math.SQRT2);
      if (x < width - 1 && y)
        distances[i] = Math.min(distances[i], distances[i - width + 1] + Math.SQRT2);
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) distances[i] = Math.min(distances[i], distances[i + 1] + 1);
      if (y < height - 1) distances[i] = Math.min(distances[i], distances[i + width] + 1);
      if (x < width - 1 && y < height - 1)
        distances[i] = Math.min(distances[i], distances[i + width + 1] + Math.SQRT2);
      if (x && y < height - 1)
        distances[i] = Math.min(distances[i], distances[i + width - 1] + Math.SQRT2);
    }
  return {
    wet,
    height(x: number, y: number, land: number) {
      if (wet(x, y)) return -2;
      const gx = Math.max(0, Math.min(width - 1, (x / 2400) * (width - 1))),
        gy = Math.max(0, Math.min(height - 1, (y / 1501) * (height - 1))),
        ix = Math.floor(gx),
        iy = Math.floor(gy),
        jx = Math.min(ix + 1, width - 1),
        jy = Math.min(iy + 1, height - 1),
        tx = gx - ix,
        ty = gy - iy;
      const top = distances[iy * width + ix] * (1 - tx) + distances[iy * width + jx] * tx,
        bottom = distances[jy * width + ix] * (1 - tx) + distances[jy * width + jx] * tx;
      const t = Math.min(1, ((top * (1 - ty) + bottom * ty) * 4) / 62);
      return land * t * t * (3 - 2 * t);
    },
  };
}
