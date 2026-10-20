import * as THREE from 'three';
import data from './atlas-data.json';
import { geometry as atlas } from './atlas';

type Options = {
  scene: THREE.Scene;
  positionAt: (u: number, v: number) => THREE.Vector3;
  palette: (name: string) => THREE.Color;
};

// One DEM-aligned surface and a union of geographic water and story wetlands.
// Pond fans never overlap, and no competing water triangles share the depth.
export function createAtlasWater({ scene, positionAt, palette }: Options) {
  const root = new THREE.Group();
  root.name = 'Continuous ink rivers and lakes';
  scene.add(root);
  const channels: THREE.Vector3[][] = [];
  const depth = (360 * atlas.height) / atlas.width;
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 844;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  // Internal coverage data, never displayed as an illustration.
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-out';
  for (const path of data.land) context.fill(new Path2D(path));
  context.globalCompositeOperation = 'source-over';
  context.lineCap = context.lineJoin = 'round';
  for (const path of data.lakes) context.fill(new Path2D(path));
  for (const river of data.rivers) {
    context.lineWidth = river.major ? 4.2 : 2;
    context.strokeStyle = 'white';
    context.stroke(new Path2D(river.d));
    if (!river.major) continue;
    for (const path of river.d.split(/(?=M)/)) {
      const raw = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(
        (m) => new THREE.Vector2(+m[1] / atlas.width, +m[2] / atlas.height),
      );
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < raw.length - 1; i++) {
        const a = raw[i],
          b = raw[i + 1];
        const count = Math.max(1, Math.ceil(a.distanceTo(b) * 400));
        for (let j = 0; j < count; j++) {
          const uv = a.clone().lerp(b, j / count);
          if (uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1) points.push(positionAt(uv.x, uv.y));
        }
      }
      if (points.length > 1) channels.push(points);
    }
  }
  const bytes = new Uint8Array(canvas.width * canvas.height);
  const mask = new THREE.DataTexture(bytes, canvas.width, canvas.height, THREE.RedFormat);
  mask.magFilter = mask.minFilter = THREE.LinearFilter;
  let dirty = true;
  const updateMask = () => {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < bytes.length; i++) bytes[i] = pixels[i * 4 + 3];
    mask.needsUpdate = true;
    dirty = false;
  };
  const uniforms = {
    time: { value: 0 },
    coverage: { value: mask },
    waterColor: { value: palette('accent-shuihu').lerp(palette('paper'), 0.18) },
    bankColor: { value: palette('paper-shade').lerp(palette('gold'), 0.12) },
    lightColor: { value: palette('paper') },
    ripple: { value: new THREE.Vector3(999, 0, 999) },
    rippleTime: { value: -100 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 mapUv;varying vec3 world;
      void main(){mapUv=vec2(uv.x,1.-uv.y);world=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time,rippleTime;uniform sampler2D coverage;
      uniform vec3 waterColor,lightColor,bankColor,ripple;
      varying vec2 mapUv;varying vec3 world;
      void main(){
        float cover=texture2D(coverage,mapUv).r;
        if(cover<.12)discard;
        vec2 p=world.xz;
        float wash=sin(p.x*.24+p.y*.16-time*.65+sin(p.y*.31)*1.4);
        float rippleNoise=sin(p.x*.57-p.y*.39+time*.8)*.5+.5;
        float glint=smoothstep(.78,1.,wash)*smoothstep(.35,.85,rippleNoise)*.16;
        float age=time-rippleTime;
        float dist=distance(p,ripple.xz);
        float ring=exp(-pow((dist-age*3.2)*1.2,2.))*exp(-age*.8);
        ring*=step(0.,age)*step(age,5.);
        vec3 color=mix(waterColor,lightColor,.12+glint+ring*.4);
        color=mix(bankColor,color,smoothstep(.12,.75,cover));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // Identical topology and samples to the ground avoids cutting across it.
  const geometry = new THREE.PlaneGeometry(360, depth, 192, 112);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++)
    positions.setY(i, positionAt((i % 193) / 192, Math.floor(i / 193) / 112).y + 0.12);
  const surface = new THREE.Mesh(geometry, material);
  surface.userData.kind = 'water';
  root.add(surface);
  const isWater = (point: THREE.Vector3) => {
    if (dirty) updateMask();
    const u = point.x / 360 + 0.5,
      v = point.z / depth + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const x = Math.min(canvas.width - 1, Math.floor(u * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor(v * canvas.height));
    return bytes[y * canvas.width + x] > 140;
  };
  let lastRipple = -10;
  return {
    root,
    surfaces: [surface],
    channels,
    isWater,
    addLiteraryWater(center: THREE.Vector3, width: number, pondDepth: number) {
      context.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const radius = 1 + Math.sin(a * 3) * 0.1 + Math.cos(a * 5) * 0.07;
        const x = ((center.x + Math.cos(a) * width * 0.5 * radius) / 360 + 0.5) * canvas.width;
        const y =
          ((center.z + Math.sin(a) * pondDepth * 0.5 * radius) / depth + 0.5) * canvas.height;
        if (i) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.closePath();
      context.fill();
      dirty = true;
    },
    tick(seconds: number) {
      if (dirty) updateMask();
      uniforms.time.value = seconds;
    },
    disturb(point: THREE.Vector3, seconds: number) {
      if (seconds - lastRipple < 0.18 || !isWater(point)) return;
      lastRipple = seconds;
      uniforms.ripple.value.copy(point);
      uniforms.rippleTime.value = seconds;
    },
    dispose() {
      scene.remove(root);
      geometry.dispose();
      material.dispose();
      mask.dispose();
    },
  };
}
