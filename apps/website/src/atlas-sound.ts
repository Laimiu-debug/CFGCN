export type AtlasCue = 'water' | 'wind' | 'town' | 'birds';
export const atlasSoundEvent = 'cfgcn:atlas-sound';
export function soundAtlas(kind: AtlasCue) {
  window.dispatchEvent(new CustomEvent(atlasSoundEvent, { detail: kind }));
}
