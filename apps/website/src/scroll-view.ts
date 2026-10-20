import layout from './scroll-layout.json';
// Ground-plane footprint of the actual illustrated perspective camera.
export const scrollFov = 22;
export const scrollElevation = 0.62;
export const scrollViewBounds = {
  left: layout.bounds.west + 20,
  right: layout.bounds.east - 20,
  north: layout.bounds.north + 20,
  south: layout.bounds.south - 20,
};
export function scrollHomeView(aspect: number) {
  const compact = aspect < 1.15,
    origin = layout.places.xiyou;
  return {
    span: compact ? 155 : Math.max(240, 490 / aspect),
    x: compact ? origin.x : 30,
    z: compact ? origin.z + 14 : 20,
  };
}
export function scrollFootprint(aspect: number) {
  const tangent = Math.tan((scrollFov * Math.PI) / 360),
    y = scrollElevation,
    z = Math.sqrt(1 - y * y);
  return [-1, 1].flatMap((v) => {
    const t = y / (y - v * tangent * z);
    return [-1, 1].map((h) => ({ x: h * tangent * aspect * t, z: z + (-z - v * tangent * y) * t }));
  });
}
export function constrainScrollView(aspect: number, span: number, x: number, z: number) {
  const corners = scrollFootprint(Math.max(0.05, aspect));
  const minX = Math.min(...corners.map((c) => c.x)),
    maxX = Math.max(...corners.map((c) => c.x));
  const minZ = Math.min(...corners.map((c) => c.z)),
    maxZ = Math.max(...corners.map((c) => c.z));
  const bounds = scrollViewBounds;
  const maxDistance = Math.min(
    (bounds.right - bounds.left) / (maxX - minX),
    (bounds.south - bounds.north) / (maxZ - minZ),
  );
  const distance = Math.min(
    Math.max(10, span) / (2 * Math.tan((scrollFov * Math.PI) / 360)),
    maxDistance,
  );
  const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
  return {
    span: distance * 2 * Math.tan((scrollFov * Math.PI) / 360),
    x: clamp(x, bounds.left - minX * distance, bounds.right - maxX * distance),
    z: clamp(z, bounds.north - minZ * distance, bounds.south - maxZ * distance),
    distance,
  };
}
