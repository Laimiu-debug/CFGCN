import geometry from './atlas-geometry.json';
import type { GameId } from '@cfgcn/shared';

// Plate carrée, north up. The relief, vector paths and every marker use these same bounds.
export function atlasPoint(longitude: number, latitude: number): [number, number] {
  return [
    ((longitude - geometry.west) / (geometry.east - geometry.west)) * geometry.width,
    ((geometry.north - latitude) / (geometry.north - geometry.south)) * geometry.height,
  ];
}

export function atlasPlace(id: GameId) {
  const [longitude, latitude] = geometry.places[id];
  const [x, y] = atlasPoint(longitude, latitude);
  return {
    longitude,
    latitude,
    x,
    y,
    left: (x / geometry.width) * 100,
    top: (y / geometry.height) * 100,
  };
}

// Soft regional art selection uses the same geographic anchors as navigation.
// This is scenery composition, not a claim about ancient political boundaries.
export function atlasRegion(longitude: number, latitude: number): GameId {
  return (Object.entries(geometry.places) as [GameId, number[]][]).reduce(
    (nearest, [id, [lon, lat]]) => {
      const distance = Math.hypot(longitude - lon, (latitude - lat) * 1.15);
      return distance < nearest.distance ? { id, distance } : nearest;
    },
    { id: 'xiyou' as GameId, distance: Infinity },
  ).id;
}

export { geometry };
