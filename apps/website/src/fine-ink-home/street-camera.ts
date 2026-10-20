export type StreetCamera = { x: number; y: number; zoom: number };
export const streetExtent = { width: 3400, height: 2100 };
export const streetHome: StreetCamera = { x: 1700, y: 1150, zoom: 1 };
export function streetView(camera: StreetCamera, width: number, height: number) {
  const h = 1820 / camera.zoom;
  const w = (h * width) / Math.max(1, height);
  const x = Math.max(-180, Math.min(streetExtent.width + 180 - w, camera.x - w / 2));
  const y = Math.max(-150, Math.min(streetExtent.height + 150 - h, camera.y - h / 2));
  return { x, y, width: w, height: h };
}
export function streetZoom(
  camera: StreetCamera,
  factor: number,
  width: number,
  height: number,
  u = 0.5,
  v = 0.5,
): StreetCamera {
  const before = streetView(camera, width, height);
  const zoom = Math.max(1, Math.min(24, camera.zoom * factor));
  const nextHeight = 1820 / zoom;
  const nextWidth = (nextHeight * width) / Math.max(1, height);
  return {
    zoom,
    x: before.x + before.width * u + nextWidth * (0.5 - u),
    y: before.y + before.height * v + nextHeight * (0.5 - v),
  };
}
