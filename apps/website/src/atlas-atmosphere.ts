import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';

type Options = {
  scene: THREE.Scene;
  anchors: Map<GameId, THREE.Vector3>;
  palette: (name: string) => THREE.Color;
  compact: boolean;
  arrival: boolean;
  ground: (x: number, z: number) => number;
};
export function createAtlasAtmosphere({
  scene,
  anchors,
  palette,
  compact,
  arrival,
  ground,
}: Options) {
  const root = new THREE.Group();
  scene.add(root);
  const pointer = new THREE.Vector3(999, 0, 999);
  const seeds: {
    x: number;
    y: number;
    z: number;
    size: number;
    speed: number;
    smoke: boolean;
    mist?: boolean;
  }[] = [];
  for (let i = 0; i < (arrival ? 5 : compact ? 13 : 23); i++) {
    const x = -168 + ((i * 71) % 330),
      z = -94 + ((i * 43) % 187),
      y = 43 + (i % 4) * 5;
    for (let j = 0; j < 6; j++)
      seeds.push({
        x: x + (j - 2.5) * 3.7,
        y: y + Math.sin(j * 0.8) * 2,
        z: z + Math.cos(j) * 2,
        size: (20 + Math.sin(j * 0.8) * 8) * (arrival ? 0.35 : 1),
        speed: 1.7 + (i % 3) * 0.45,
        smoke: false,
      });
  }
  if (!arrival)
    for (let i = 0; i < (compact ? 5 : 9); i++) {
      const x = -145 + i * 34,
        z = -66 + ((i * 37) % 145);
      for (let j = 0; j < 5; j++)
        seeds.push({
          x: x + (j - 2) * 7,
          y: 3.5,
          z: z + Math.sin(j) * 3,
          size: 36 + Math.sin(j) * 7,
          speed: 0.24 + (i % 3) * 0.07,
          smoke: false,
          mist: true,
        });
    }
  for (const [id, anchor] of anchors) {
    if (arrival && id !== 'xiyou') continue;
    for (let j = 0; j < 5; j++)
      seeds.push({
        x: anchor.x - 4 + j * 0.35,
        y: anchor.y + 7 + j * 1.5,
        z: anchor.z + 2,
        size: 1.3 + j * 0.55,
        speed: 0.12,
        smoke: true,
      });
  }
  const positions = new Float32Array(seeds.length * 3),
    sizes = new Float32Array(seeds.length),
    shades = new Float32Array(seeds.length),
    stretches = new Float32Array(seeds.length);
  seeds.forEach((s, i) => {
    sizes[i] = s.size;
    shades[i] = s.smoke ? 0.12 : s.mist ? 0.11 : 0.28;
    stretches[i] = s.mist ? 3.4 : 1.25;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('shade', new THREE.BufferAttribute(shades, 1));
  geometry.setAttribute('stretch', new THREE.BufferAttribute(stretches, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: palette('on-jade') }, height: { value: 800 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute float size,shade,stretch;uniform float height;varying float alpha,aspect;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);alpha=shade;aspect=stretch;
      gl_PointSize=min(220.,size*height/-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 color;varying float alpha,aspect;
      void main(){vec2 p=gl_PointCoord*2.-1.;p.y*=aspect;
      float d=length(p);if(d>1.)discard;
      float wisps=.86+.14*sin(p.x*12.+sin(p.y*8.)*2.);
      float a=pow(1.-smoothstep(.05,1.,d),1.7)*alpha*wisps;
      gl_FragColor=vec4(color*(.92+.08*gl_PointCoord.y),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const clouds = new THREE.Points(geometry, material);
  clouds.frustumCulled = false;
  root.add(clouds);
  // Tiny leaf/petal particles are effects, not replacement character models.
  const petalPositions = new Float32Array((compact ? 45 : 90) * 3);
  const petalColors = new Float32Array(petalPositions.length);
  const regions = [...anchors.keys()];
  for (let i = 0; i < petalPositions.length / 3; i++) {
    const color =
      regions[i % regions.length] === 'honglou'
        ? palette('accent-honglou').lerp(palette('paper'), 0.5)
        : palette('gold').lerp(palette('paper'), 0.35);
    color.toArray(petalColors, i * 3);
  }
  const petalsGeometry = new THREE.BufferGeometry();
  petalsGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  petalsGeometry.setAttribute('color', new THREE.BufferAttribute(petalColors, 3));
  const petalsMaterial = new THREE.PointsMaterial({
    vertexColors: true,
    size: 0.3,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  root.add(new THREE.Points(petalsGeometry, petalsMaterial));
  const homes = [...anchors.values()];
  return {
    cloudCount: seeds.filter((s) => !s.smoke && !s.mist).length / 6,
    mistCount: seeds.filter((s) => s.mist).length / 5,
    firstCloudPosition: () => `${positions[0].toFixed(2)},${positions[2].toFixed(2)}`,
    pointAt(point: THREE.Vector3) {
      pointer.copy(point);
    },
    tick(seconds: number, viewportHeight: number, reduced: boolean) {
      material.uniforms.height.value = viewportHeight;
      const t = seconds;
      seeds.forEach((s, i) => {
        let x = s.smoke
          ? s.x + Math.sin(t * 0.3 + i) * 0.6
          : ((s.x + 180 + t * s.speed) % 360) - 180;
        let z = s.z + Math.sin(t * 0.12 + i * 0.7) * 1.2;
        if (!reduced && !s.smoke && !s.mist) {
          const dx = x - pointer.x,
            dz = z - pointer.z,
            d = Math.hypot(dx, dz);
          const push = Math.max(0, 1 - d / 24) * 6;
          x += (dx / Math.max(d, 1)) * push;
          z += (dz / Math.max(d, 1)) * push;
        }
        const y = (s.mist ? ground(x, z) : 0) + s.y + Math.sin(t * 0.2 + i) * 0.5;
        positions.set([x, y, z], i * 3);
      });
      geometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < petalPositions.length / 3; i++) {
        const home = homes[i % homes.length];
        if (!home) continue;
        petalPositions.set(
          [
            home.x + Math.sin(i * 2.4 + t * 0.12) * 15,
            home.y + 1 + ((i * 0.71 + t * 0.3) % 9),
            home.z + Math.cos(i * 1.7 + t * 0.1) * 12,
          ],
          i * 3,
        );
      }
      petalsGeometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      scene.remove(root);
      geometry.dispose();
      material.dispose();
      petalsGeometry.dispose();
      petalsMaterial.dispose();
    },
  };
}
