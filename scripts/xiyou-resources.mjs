import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// Only active runtime files. Studio originals, rejected candidates and editable
// sources never enter the download/preload manifest.
export function gameResources(root) {
  const puppetIds = [
    'tangseng',
    'wukong',
    'bajie',
    'shaseng',
    'xiaobailong',
    'wolf',
    'tiger',
    'baigufuren',
  ];
  const groups = {
    shadow: puppetIds.map((id) => `shadow/${id}.glb`),
    core: [
      'wukong.glb',
      'monk.glb',
      'wolf.glb',
      'crowd.glb',
      'crowd-vat.png',
      'series_mesh.wesl',
      'series_paint.wesl',
      'terrain_profile.wesl',
      'fx/lotus.png',
      'fx/staff.png',
      'fx/tide.png',
      'fx/warning.png',
    ],
    world: ['mountain_world.glb', 'pine_tree.glb', 'seal_stone.glb'],
    river: ['river_scene.glb', 'white_dragon.glb', 'river_dragon.glb', 'riverling.glb'],
    trial: ['landscape.glb'],
    expedition: [
      'ink-terrain.jpg',
      'ink_scenery.glb',
      'ink_landmarks.glb',
      'ink_hamlet.glb',
      'ink_settlement.glb',
      'ink_heifeng.glb',
      'ink_river.glb',
      'ink_gaolao.glb',
      'ink-flora.png',
      'ink-map-wukong.png',
      'ink-map-symbols.png',
      'shadow_wukong.glb',
    ],
  };
  return Object.entries(groups).flatMap(([group, paths]) =>
    paths.map((path) => {
      const data = readFileSync(join(root, 'apps/website/public/games/xiyou/assets', path));
      return {
        path,
        group,
        bytes: data.byteLength,
        sha256: createHash('sha256').update(data).digest('hex'),
      };
    }),
  );
}
