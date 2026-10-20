// The viewport stays within authored countryside. Its bounds are deliberately
// smaller than the source DEM; zooming out must not expose unfinished padding.
export const atlasViewBounds = { left: -102, right: 128, north: -78, south: 66 };
export const atlasViewFov = 24;
export const atlasViewElevation = { y: 0.78, z: Math.sqrt(1 - 0.78 ** 2) };
export const atlasViewEasing = (seconds: number) => 1 - Math.exp(-7 * Math.max(0, seconds));

export function atlasFootprint(aspect: number) {
  const tangent = Math.tan((atlasViewFov * Math.PI) / 360);
  const { y, z } = atlasViewElevation;
  return [-1, 1].flatMap((vertical) => {
    const t = y / (y - vertical * tangent * z);
    return [-1, 1].map((horizontal) => ({
      x: horizontal * tangent * aspect * t,
      z: z + (-z - vertical * tangent * y) * t,
    }));
  });
}

export function constrainAtlasView(aspect: number, zoom: number, x: number, z: number) {
  const corners = atlasFootprint(Math.max(0.1, aspect));
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minZ = Math.min(...corners.map((c) => c.z));
  const maxZ = Math.max(...corners.map((c) => c.z));
  const bounds = atlasViewBounds;
  const maxDistance = Math.min(
    (bounds.right - bounds.left) / (maxX - minX),
    (bounds.south - bounds.north) / (maxZ - minZ),
  );
  const scale = Math.max(0.48, Math.min(1, zoom));
  const distance = maxDistance * scale;
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
  return {
    zoom: scale,
    distance,
    x: clamp(x, bounds.left - minX * distance, bounds.right - maxX * distance),
    z: clamp(z, bounds.north - minZ * distance, bounds.south - maxZ * distance),
  };
}
