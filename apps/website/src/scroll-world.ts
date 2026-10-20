import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameId } from '@cfgcn/shared';
import { settlementPlan, type Building, type RoofForm } from './scroll-settlements';
import {
  scrollLayout as layout,
  scrollIds,
  scrollRivers,
  scrollRoads,
  terrainHeight,
  waterDistance,
  townDistance,
  distanceToPath,
  smooth,
  mountainHeight,
  cultivationWeight,
} from './scroll-terrain';

type Palette = (key: string) => THREE.Color;
const vertex = `
  #ifdef GROUND
    attribute float relief; attribute float ridge; varying float vRelief; varying float vRidge;
  #endif
  varying vec3 vWorld; varying vec3 vNormal; varying vec3 vColor; varying vec2 vUv; varying float vHeight;
  void main() {
    vec4 p=vec4(position,1.); vec3 n=normal;vHeight=position.y;
    #ifdef GROUND
      vRelief=relief;
      vRidge=ridge;
    #endif
    #ifdef USE_COLOR
      vColor=color;
    #else
      vColor=vec3(1.);
    #endif
    #ifdef USE_INSTANCING
      p=instanceMatrix*p; n=mat3(instanceMatrix)*n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vColor*=instanceColor;
    #endif
    vec4 world=modelMatrix*p;
    vWorld=world.xyz; vNormal=normalize(mat3(modelMatrix)*n); vUv=uv;
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;
const pigment = `
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y); }
  float rockBrush(vec2 p){
    vec2 q=p*.3+vec2(noise(p*.13),noise(p*.13+19.))*.7,i=floor(q),f=fract(q);float seed=hash(i);
    float t=(f.y-.12)/.76;
    float d=abs(f.x-(.78-.70*t+(seed-.5)*.22));
    float width=.025+.045*(1.-t);
    return (1.-smoothstep(width,width+max(fwidth(d),.018),d))*smoothstep(0.,.12,t)*(1.-smoothstep(.63,.9,t))*step(.40,seed);
  }
  vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
`;
export async function createScrollWorld(scene: THREE.Scene, palette: Palette) {
  const loader = new GLTFLoader(),
    textures = new THREE.TextureLoader();
  const [roofModel, treeModel, farTreeModel, earth, routes, grain] = await Promise.all([
    loader.loadAsync('/art/atlas/scroll/roof.glb'),
    loader.loadAsync('/art/atlas/scroll/tree.glb'),
    loader.loadAsync('/art/atlas/scroll/tree-far.glb'),
    textures.loadAsync('/art/atlas/scroll/earth.webp'),
    textures.loadAsync('/art/atlas/scroll/routes.webp'),
    textures.loadAsync('/art/atlas/scroll/grain.webp'),
  ]);
  const root = new THREE.Group();
  root.name = 'Continuous ink landscape from approved composition';
  scene.add(root);
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  earth.colorSpace = THREE.SRGBColorSpace;
  earth.anisotropy = 8;
  routes.colorSpace = THREE.NoColorSpace;
  routes.anisotropy = 8;
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.colorSpace = THREE.NoColorSpace;
  const paper = palette('paper-raised'),
    ink = palette('ink'),
    jade = palette('jade'),
    gold = palette('gold');
  const shader = (base: THREE.Color, ground = false, surface = 0) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      defines: ground ? { GROUND: 1 } : {},
      vertexColors: true,
      uniforms: {
        uBase: { value: base },
        uPaper: { value: paper },
        uInk: { value: ink },
        uRock: { value: paper.clone().lerp(gold, 0.62).lerp(palette('muted'), 0.32) },
        uRockBlue: { value: jade.clone().lerp(palette('accent-shuihu'), 0.55).lerp(paper, 0.13) },
        uEarth: { value: earth },
        uRoutes: { value: routes },
        uMapStep: { value: new THREE.Vector2(1 / earth.image.width, 1 / earth.image.height) },
        uWorldStep: {
          value: new THREE.Vector2(
            (layout.bounds.east - layout.bounds.west) / earth.image.width,
            (layout.bounds.south - layout.bounds.north) / earth.image.height,
          ),
        },
        uGrain: { value: grain },
        uGround: { value: ground ? 1 : 0 },
        uSurface: { value: surface },
      },
      fragmentShader: `
      #ifdef GROUND
        varying float vRelief; varying float vRidge;
      #endif
      uniform vec3 uBase,uPaper,uInk,uRock,uRockBlue; uniform sampler2D uEarth,uGrain,uRoutes; uniform float uGround,uSurface;
      uniform vec2 uMapStep,uWorldStep;
      varying vec3 vWorld,vNormal,vColor;varying vec2 vUv;varying float vHeight;${pigment}
      void main(){
        vec3 n=normalize(vNormal); vec3 c=uBase*vColor;
        if(uGround>.5){
          vec3 soil=texture2D(uEarth,vUv).rgb;
          c=soil;
          #ifdef GROUND
            float bank=texture2D(uRoutes,vUv).g;
            float bx=(texture2D(uRoutes,vUv+vec2(uMapStep.x,0.)).g-texture2D(uRoutes,vUv-vec2(uMapStep.x,0.)).g)*.12/(2.*uWorldStep.x);
            float bz=(texture2D(uRoutes,vUv-vec2(0.,uMapStep.y)).g-texture2D(uRoutes,vUv+vec2(0.,uMapStep.y)).g)*.12/(2.*uWorldStep.y);
            n=normalize(n-vec3(bx,0.,bz)*(1.-vRelief));
            c=mix(c,uInk,bank*.055*(1.-vRelief));
            float cliff=smoothstep(.05,.45,vRelief)*smoothstep(.10,.38,1.-n.y);
            vec3 planeNormal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
            if(dot(planeNormal,n)<0.)planeNormal=-planeNormal;
            n=normalize(mix(n,planeNormal,cliff));
            // The earth painting is projected from above. On a steep wall it
            // stretched grass/flecks into long vertical strings. Rock uses three
            // projections at the same world scale instead.
            vec3 weights=pow(abs(n),vec3(4.)); weights/=dot(weights,vec3(1.));
            float wash=dot(weights,vec3(noise(vWorld.zy*.12),noise(vWorld.xz*.12),noise(vWorld.xy*.12)));
            float flecks=dot(weights,vec3(noise(vWorld.zy*1.3),noise(vWorld.xz*1.3),noise(vWorld.xy*1.3)));
            float cool=smoothstep(6.,25.,vWorld.y)*(.38+.62*smoothstep(.25,.8,n.y));
            cool+=.2*(1.-smoothstep(-.5,.7,dot(n,normalize(vec3(-.65,.1,.35)))));
            vec3 rock=mix(uRock,uRockBlue,min(.8,cool))*(.94+.09*wash);
            rock=mix(rock,uPaper,smoothstep(.68,.89,flecks)*.10);
            float brush=dot(weights,vec3(rockBrush(vWorld.zy),rockBrush(vWorld.xz),rockBrush(vWorld.xy)));
            rock=mix(rock,uInk,brush*.16);
            c=mix(c,rock,cliff);
            // Broken horizontal bedding belongs to the rock, not long vertical
            // streaks which made even the geometry appear to be melting.
            float bed=vWorld.y*.13+noise(vWorld.xz*.055)*.65;
            float band=abs(fract(bed)-.5);
            float aa=max(fwidth(bed),.025);
            float bedding=1.-smoothstep(.025,.025+aa,band);
            float broken=smoothstep(.28,.62,noise(vWorld.xz*.34+floor(bed)));
            c=mix(c,uInk,cliff*bedding*broken*.17);
            c=mix(c,uInk,vRelief*vRidge*.16);
          #endif
          c=mix(c,soil,texture2D(uRoutes,vUv).r);
        }
        if(uSurface>.5 && uSurface<1.5){
          float tiles=smoothstep(.88,.98,fract(vUv.y*19.));
          float seams=smoothstep(.94,1.,fract(vUv.x*34.+floor(vUv.y*19.)*.5));
          c*=.91+.09*noise(vUv*vec2(34.,19.));
          c=mix(c,uInk,(tiles*.22+seams*.1));
        }
        if(uSurface>2.5){
          c=mix(uInk*.85,c,smoothstep(.15,.5,vHeight));
          c*=.86+.14*noise(vWorld.xz*2.+vWorld.y);
        }
        if(uSurface>1.5 && uSurface<2.5){
          float fleck=noise(vWorld.xz*5.+vWorld.y*2.);
          c*=.93+.08*fleck;
        }
        float diffuse=max(0.,dot(n,normalize(vec3(-.65,.72,.35))));
        float shade=uGround>.5 ? .76+.24*smoothstep(.08,.82,diffuse) : .57+.43*diffuse;
        c*=shade;
        float paperGrain=texture2D(uGrain,vWorld.xz*.14).r;
        #ifdef GROUND
          vec3 grainWeights=pow(abs(n),vec3(4.));grainWeights/=dot(grainWeights,vec3(1.));
          paperGrain=dot(grainWeights,vec3(texture2D(uGrain,vWorld.zy*.14).r,paperGrain,texture2D(uGrain,vWorld.xy*.14).r));
        #endif
        c*=.94+.07*paperGrain;
        float haze=(1.-smoothstep(-300.,-85.,vWorld.z))*.20;
        c=mix(c,uPaper,haze);
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
    });
    materials.add(m);
    return m;
  };
  const mat = {
    wall: shader(palette('muted').lerp(paper, 0.43), false, 2),
    white: shader(palette('paper-raised').lerp(gold, 0.13), false, 2),
    earthWall: shader(paper.clone().lerp(gold, 0.38), false, 2),
    roof: shader(palette('muted').lerp(ink, 0.18).lerp(palette('accent-shuihu'), 0.13), false, 1),
    warmRoof: shader(palette('muted').lerp(gold, 0.26).lerp(ink, 0.12), false, 1),
    blueRoof: shader(palette('muted').lerp(palette('accent-shuihu'), 0.34), false, 1),
    ochre: shader(gold.clone().lerp(paper, 0.24), false, 1),
    wood: shader(palette('gold-ink')),
    red: shader(palette('vermilion')),
    dark: shader(ink.clone().lerp(paper, 0.07)),
    leaf: shader(new THREE.Color(1, 1, 1), false, 3),
    pink: shader(palette('accent-honglou').lerp(paper, 0.53)),
  };
  const firstGeometry = (model: THREE.Object3D) => {
    let found: THREE.BufferGeometry | undefined;
    model.traverse((n) => {
      if (n instanceof THREE.Mesh && !found) found = n.geometry.clone();
    });
    return found!;
  };
  const roof = firstGeometry(roofModel.scene),
    tree = firstGeometry(treeModel.scene),
    farTree = firstGeometry(farTreeModel.scene);
  geometry.add(roof);
  geometry.add(tree);
  geometry.add(farTree);
  for (const model of [roofModel, treeModel, farTreeModel])
    model.scene.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        n.geometry.dispose();
        (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose());
      }
    });
  let seed = 274115;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  // One continuous mesh: mountains share vertices with their slopes and the plains.
  const nx = 540,
    nz = 430,
    positions: number[] = [],
    uvs: number[] = [],
    relief: number[] = [],
    indices: number[] = [];
  const { west, east, north, south } = layout.bounds;
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = west + ((east - west) * i) / nx,
        z = north + ((south - north) * j) / nz,
        h = terrainHeight(x, z);
      positions.push(x, h, z);
      relief.push(smooth(1.5, 12, mountainHeight(x, z)));
      uvs.push(i / nx, 1 - j / nz);
      if (i < nx && j < nz) {
        const a = j * (nx + 1) + i,
          b = a + nx + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  const ground = new THREE.BufferGeometry();
  const ridges = new Float32Array(relief.length);
  for (let j = 1; j < nz; j++)
    for (let i = 1; i < nx; i++) {
      const at = j * (nx + 1) + i;
      const neighbors = [at - 1, at + 1, at - nx - 1, at + nx + 1];
      const curvature =
        positions[at * 3 + 1] - neighbors.reduce((sum, n) => sum + positions[n * 3 + 1], 0) / 4;
      ridges[at] = smooth(0.15, 0.7, Math.abs(curvature));
    }
  ground.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ground.setAttribute('relief', new THREE.Float32BufferAttribute(relief, 1));
  ground.setAttribute('ridge', new THREE.Float32BufferAttribute(ridges, 1));
  ground.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  ground.setIndex(indices);
  ground.computeVertexNormals();
  geometry.add(ground);
  const groundMesh = new THREE.Mesh(ground, shader(new THREE.Color(1, 1, 1), true));
  groundMesh.name = 'Shared ground, mountain roots, fields and river banks';
  root.add(groundMesh);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    angle = 0,
  ) => {
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
      new THREE.Vector3(sx, sy, sz),
    );
    const clone = g.clone();
    clone.applyMatrix4(transform);
    clone.deleteAttribute('color');
    if (!clone.getAttribute('uv'))
      clone.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
          new Float32Array(clone.getAttribute('position').count * 2),
          2,
        ),
      );
    const items = buckets.get(m) ?? [];
    items.push(clone);
    buckets.set(m, items);
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  geometry.add(cube);
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    angle = 0,
  ) => add(cube, m, x, y + h / 2, z, w, h, d, angle);
  // Curved hip/gable roof families complement the retained Studio roof component.
  // They are code-authored architectural geometry, with real eaves and tile UVs.
  const makeRoof = (hip: boolean) => {
    const pos: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    if (!hip) {
      for (const side of [-1, 1]) {
        const start = pos.length / 3;
        for (let j = 0; j <= 6; j++)
          for (let i = 0; i <= 8; i++) {
            const u = i / 8,
              v = j / 6,
              x = (u - 0.5) * 1.12;
            pos.push(
              x,
              0.22 * Math.pow(1 - v, 1.65) + 0.034 * Math.pow(Math.abs(u - 0.5) * 2, 6) * v * v,
              side * v * 0.37,
            );
            uv.push(u, v);
            if (i < 8 && j < 6) {
              const a = start + j * 9 + i;
              if (side === 1) idx.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
              else idx.push(a, a + 1, a + 9, a + 1, a + 10, a + 9);
            }
          }
      }
    } else {
      const rings = [
        [0.56, 0.37, 0.025],
        [0.49, 0.31, 0],
        [0.38, 0.22, 0.065],
        [0.29, 0.11, 0.155],
        [0.27, 0, 0.22],
      ];
      const outline = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
      ];
      rings.forEach(([rx, rz, y], j) => {
        outline.forEach(([x, z], i) => {
          pos.push(x * rx, y + (j === 0 ? Math.abs(x * z) * 0.032 : 0), z * rz);
          uv.push(i / 8, j / 4);
        });
        if (j < rings.length - 1)
          for (let i = 0; i < 8; i++) {
            const a = j * 9 + i;
            idx.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
          }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    geometry.add(g);
    return g;
  };
  const pavilionRoof = (() => {
    const pos: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    const rings = [
      [0.64, 0.025],
      [0.54, 0],
      [0.29, 0.16],
      [0.03, 0.29],
    ];
    rings.forEach(([r, y], j) => {
      for (let i = 0; i <= 8; i++) {
        const a = (i * Math.PI) / 4;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        uv.push(i / 8, j / 3);
        if (j < 3 && i < 8) {
          const k = j * 9 + i;
          idx.push(k, k + 9, k + 1, k + 1, k + 9, k + 10);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    geometry.add(g);
    return g;
  })();
  const gableEnd = new THREE.BufferGeometry();
  gableEnd.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.5, 0, -0.32, -0.5, 0.22, 0, -0.5, 0, 0.32, 0.5, 0, 0.32, 0.5, 0.22, 0, 0.5, 0, -0.32],
      3,
    ),
  );
  gableEnd.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([0, 0, 0.5, 1, 1, 0, 0, 0, 0.5, 1, 1, 0], 2),
  );
  gableEnd.setIndex([0, 2, 1, 3, 5, 4]);
  gableEnd.computeVertexNormals();
  geometry.add(gableEnd);
  const roofForms: Record<RoofForm, THREE.BufferGeometry> = {
    hip: makeRoof(true),
    gable: makeRoof(false),
    studio: roof,
    pavilion: pavilionRoof,
  };
  const anchors = new Map<GameId, THREE.Vector3>();
  let buildingCount = 0;
  const build = (p: Building) => {
    buildingCount++;
    const { x, z, w, d, h, angle, royal, kind, finish } = p,
      base = p.base ?? terrainHeight(x, z);
    const rot = (u: number, v: number) => [
      x + Math.cos(angle) * u + Math.sin(angle) * v,
      z - Math.sin(angle) * u + Math.cos(angle) * v,
    ];
    const piece = (
      u: number,
      y: number,
      v: number,
      width: number,
      height: number,
      depth: number,
      m: THREE.Material,
    ) => {
      const [px, pz] = rot(u, v);
      box(px, base + y, pz, width, height, depth, m, angle);
    };
    const plaster =
      finish === 'red'
        ? mat.red
        : finish === 'timber'
          ? mat.wood
          : finish === 'earth'
            ? mat.earthWall
            : mat.white;
    const soil = terrainHeight(x, z);
    if (!p.tier && base > soil + 0.2) {
      if (soil > 0.1 && finish === 'red')
        box(x, soil, z, w + 0.65, base - soil, d + 0.65, mat.wall, angle);
      else
        for (const a of [-1, 1])
          for (const b of [-1, 1]) {
            const [px, pz] = rot(a * w * 0.4, b * d * 0.4);
            box(
              px,
              Math.min(soil, -0.25),
              pz,
              0.13,
              base - Math.min(soil, -0.25) + 0.08,
              0.13,
              mat.wood,
            );
          }
    }
    if (p.site && soil > 0.1) {
      const bottoms = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([a, b]) => {
        const [px, pz] = rot(a, b);
        return terrainHeight(px, pz);
      });
      const low = Math.min(...bottoms) - 0.12;
      box(x, low, z, w + 0.12, Math.max(0.18, base - low + 0.1), d + 0.12, mat.wall, angle);
    }
    // Continuous footings and a dark recess under the overhanging eave give the house weight.
    piece(0, 0, 0, w + 0.15, 0.16, d + 0.16, mat.wall);
    piece(0, 0.16, 0, w, h - 0.16, d, plaster);
    const rm = royal
      ? mat.ochre
      : finish === 'earth'
        ? mat.warmRoof
        : kind === 'gallery'
          ? mat.blueRoof
          : mat.roof;
    const r = roofForms[p.roof];
    add(
      r,
      rm,
      x,
      base + h,
      z,
      p.roof === 'studio' ? w * 1.18 : w,
      p.roof === 'studio' ? w * 0.78 : Math.min(w * 0.9, d * 1.5),
      p.roof === 'studio' ? (d / 0.58) * 1.17 : p.roof === 'pavilion' ? d : d / 0.64,
      angle,
    );
    if (p.roof === 'gable')
      add(gableEnd, plaster, x, base + h, z, w, Math.min(w * 0.9, d * 1.5), d / 0.64, angle);
    // Ridge, raised ends and a dark fascia remain legible at the wide homepage camera.
    const rise = p.roof === 'studio' ? w * 0.122 : Math.min(w * 0.9, d * 1.5) * 0.22;
    piece(0, h + rise, 0, w * 0.56, 0.085, 0.09, royal ? mat.ochre : mat.warmRoof);
    for (const end of [-1, 1])
      piece(end * w * 0.28, h + rise, 0, 0.12, 0.15, 0.09, royal ? mat.ochre : mat.roof);
    for (const side of [-1, 1]) {
      piece(0, h - 0.12, side * d * 0.51, w, 0.13, 0.07, finish === 'red' ? mat.red : mat.wood);
      const open = kind === 'hall' || kind === 'gallery' || kind === 'pavilion' || kind === 'shop';
      const bays = Math.max(2, Math.min(6, Math.floor(w / 1.1)));
      for (let i = 0; i <= bays; i++) {
        const u = (i / bays - 0.5) * w * 0.92;
        piece(
          u,
          0.16,
          side * d * 0.52,
          0.075,
          h - 0.2,
          0.075,
          finish === 'red' ? mat.red : mat.wood,
        );
        if (i < bays) {
          const center = u + (w * 0.46) / bays;
          if (open)
            piece(center, 0.2, side * d * 0.51, (w * 0.68) / bays, h * 0.67, 0.035, mat.dark);
          else if (i === Math.floor(bays / 2))
            piece(center, 0.16, side * d * 0.515, (w * 0.65) / bays, h * 0.75, 0.035, mat.wood);
          else {
            piece(center, h * 0.4, side * d * 0.515, (w * 0.56) / bays, h * 0.29, 0.04, mat.dark);
            piece(center, h * 0.51, side * d * 0.54, (w * 0.57) / bays, 0.045, 0.045, mat.wood);
          }
        }
      }
    }
    if (kind === 'shop') {
      const awning = roofForms.gable;
      const [ax, az] = rot(0, d * 0.78);
      add(
        awning,
        Math.sin(x + z) > 0 ? mat.earthWall : mat.blueRoof,
        ax,
        base + h * 0.7,
        az,
        w * 0.82,
        w * 0.2,
        d * 0.85,
        angle,
      );
      for (const side of [-1, 1])
        piece(side * w * 0.38, 0, d * 0.92, 0.045, h * 0.75, 0.045, mat.wood);
      piece(0, 0.2, d * 0.87, w * 0.8, 0.35, 0.34, mat.wood);
    }
    if (kind === 'hall' && !p.tier) {
      for (let step = 0; step < 3; step++)
        piece(0, step * 0.09, d * 0.52 + 0.55 - step * 0.15, w * 0.55, 0.1, 0.45, mat.wall);
    }
  };
  const house = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    royal = false,
    angle = 0,
    base = terrainHeight(x, z),
  ) =>
    build({
      x,
      z,
      w,
      d,
      h,
      royal,
      angle,
      base,
      kind: 'hall',
      tier: true,
      finish: royal ? 'red' : 'plaster',
      roof: 'hip',
    });
  const plan = settlementPlan();
  const flags: THREE.Mesh[] = [];
  const flag = (x: number, z: number, y: number) => {
    box(x, y, z, 0.055, 3.8, 0.055, mat.wood);
    const g = new THREE.PlaneGeometry(1.3, 0.65, 8, 1);
    geometry.add(g);
    const m = new THREE.MeshBasicMaterial({ color: palette('vermilion'), side: THREE.DoubleSide });
    materials.add(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x + 0.65, y + 3.2, z);
    root.add(mesh);
    flags.push(mesh);
  };
  const wallTown = (id: 'xiyou' | 'sanguo') => {
    const p = layout.places[id],
      base = 0.65,
      w = p.width,
      d = p.depth,
      high = id === 'xiyou' ? 2.8 : 2.1;
    // Open south gate is actual geometry, rather than a dark painted rectangle.
    box(p.x - w / 4 - 1.3, base, p.z + d / 2, w / 2 - 2.6, high, 0.7, mat.wall);
    box(p.x + w / 4 + 1.3, base, p.z + d / 2, w / 2 - 2.6, high, 0.7, mat.wall);
    box(p.x, base + high - 0.6, p.z + d / 2, 5.2, 0.6, 0.7, mat.wall);
    box(p.x - w / 4 - 1.3, base, p.z - d / 2, w / 2 - 2.6, high, 0.7, mat.wall);
    box(p.x + w / 4 + 1.3, base, p.z - d / 2, w / 2 - 2.6, high, 0.7, mat.wall);
    box(p.x, base + high - 0.6, p.z - d / 2, 5.2, 0.6, 0.7, mat.wall);
    for (const sign of [-1, 1]) box(p.x + (sign * w) / 2, base, p.z, 0.7, high, d, mat.wall);
    for (let x = -w / 2; x <= w / 2; x += 1.2)
      for (const sign of [-1, 1]) {
        if (Math.abs(x) < 2.8) continue;
        box(p.x + x, base + high, p.z + (sign * d) / 2, 0.65, 0.4, 0.85, mat.wall);
      }
    for (let z = -d / 2; z <= d / 2; z += 1.2)
      for (const sign of [-1, 1])
        box(p.x + (sign * w) / 2, base + high, p.z + z, 0.85, 0.4, 0.65, mat.wall);
    for (const sign of [-1, 1])
      for (const end of [-1, 1])
        house(p.x + (sign * w) / 2, p.z + (end * d) / 2, 3.1, 2.5, 1.7, true, 0, base + high);
    house(p.x, p.z + d / 2, 6.3, 3.4, 2.2, true, 0, base + high);
    house(p.x, p.z - d / 2, 4.8, 2.8, 1.6, true, 0, base + high);
    for (let x = -w / 2 + 3; x < w / 2; x += 4.5)
      for (const sign of [-1, 1]) {
        if (Math.abs(x) < 4) continue;
        box(p.x + x, base, p.z + (sign * d) / 2 + 0.08, 0.45, high, 0.98, mat.wall);
      }
    flag(p.x - 4, p.z + d / 2, base + high);
    flag(p.x + 4, p.z + d / 2, base + high);
  };
  wallTown('xiyou');
  wallTown('sanguo');
  for (const p of plan.buildings) build(p);
  // Low courtyard walls tie wings and gateways into actual urban blocks.
  for (const c of plan.courts) {
    if (c.site) continue;
    for (const side of [-1, 1]) box(c.x + (side * c.w) / 2, 0.65, c.z, 0.12, 0.48, c.d, mat.white);
    box(c.x, 0.65, c.z - c.d / 2, c.w, 0.48, 0.12, mat.white);
  }
  const ls = layout.places.shuihu,
    jl = layout.places.honglou;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 22; i++)
      box(ls.x + sign * 10.5, 0.55, ls.z - 6 + i * 0.58, 0.15, 1.65, 0.15, mat.wood);
    house(ls.x + sign * 10.2, ls.z + 4, 2.8, 2.2, 1.15, false, 0, 2.05);
    flag(ls.x + sign * 7, ls.z + 6, 0.65);
  }
  for (let i = 0; i < 4; i++) {
    const x = ls.x + 7 + i * 3.1,
      z = ls.z + 8 + i * 0.7;
    box(x, 0.13, z, 1.25, 0.18, 7.5, mat.wood);
    for (let j = 0; j < 9; j++) box(x, 0.3, z - 3.5 + j * 0.85, 1.25, 0.04, 0.08, mat.dark);
    for (const side of [-1, 1]) box(x + side * 0.55, -0.6, z + 3, 0.09, 0.9, 0.09, mat.wood);
  }
  for (const id of scrollIds) {
    const p = layout.places[id];
    anchors.set(id, new THREE.Vector3(p.x, 0.65, p.z));
  }
  // Stone bridges follow actual channels. Arched decks are joined to the banks.
  const bridge = (x: number, z: number, angle: number, length: number, timber = false) => {
    const start = Math.max(
      0.5,
      terrainHeight(x - (Math.cos(angle) * length) / 2, z - (Math.sin(angle) * length) / 2),
    );
    const end = Math.max(
      0.5,
      terrainHeight(x + (Math.cos(angle) * length) / 2, z + (Math.sin(angle) * length) / 2),
    );
    const deck = (t: number) =>
      start + (end - start) * t + (timber ? 0.35 : 1.25) * Math.sin(Math.PI * t);
    const bridgeMaterial = timber ? mat.wood : mat.wall;
    const pos: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    const point = (along: number, side: number, y: number) => [
      x + Math.cos(angle) * along - Math.sin(angle) * side,
      y,
      z + Math.sin(angle) * along + Math.cos(angle) * side,
    ];
    for (let j = 0; j <= 28; j++) {
      const t = j / 28,
        along = (t - 0.5) * length,
        y = deck(t);
      for (const side of [-1, 1]) pos.push(...point(along, side * 1.0, y));
      uv.push(t, 0, t, 1);
      if (j < 28) {
        const k = j * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
      if (j % 4 === 0)
        for (const side of [-1, 1]) {
          const p = point(along, side * 1.05, y);
          box(p[0], p[1], p[2], 0.18, 0.64, 0.18, bridgeMaterial);
          box(p[0], p[1] + 0.64, p[2], 0.26, 0.1, 0.26, mat.white);
        }
    }
    // Two continuous arched stone fascias below the deck, plus curved parapets.
    for (const side of [-1, 1])
      for (const band of [0, 1]) {
        const offset = pos.length / 3;
        for (let j = 0; j <= 28; j++) {
          const t = j / 28,
            y = deck(t),
            along = (t - 0.5) * length;
          pos.push(
            ...point(along, side * 1.035, y + (band ? 0.35 : -0.46)),
            ...point(along, side * 1.035, y + (band ? 0.52 : 0.01)),
          );
          uv.push(t, 0, t, 1);
          if (j < 28) {
            const k = offset + j * 2;
            if (side === 1) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
            else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
          }
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    geometry.add(g);
    root.add(new THREE.Mesh(g, bridgeMaterial));
  };
  for (const [x, z, angle, length, timber = 0] of layout.bridges)
    bridge(x, z, angle, length, !!timber);
  // Each silhouette is a shared, Blender-reduced Studio tree, rooted in this mesh.
  const treePlaces: { x: number; z: number; scale: number; type: number }[] = [
    ...plan.trees.filter((p) => waterDistance(p.x, p.z) > 0),
  ];
  const plant = (x: number, z: number, scale: number, type = 0) => {
    if (waterDistance(x, z) < 1.4 || townDistance(x, z) < 1.8 || terrainHeight(x, z) > 32) return;
    if (cultivationWeight(x, z) > 0.88 && random() > 0.18) return;
    if (scrollRoads.some((r) => distanceToPath(x, z, r.samples) < 1.3)) return;
    treePlaces.push({ x, z, scale, type });
  };
  for (const [px, pz, h, rx, rz] of layout.peaks) {
    for (let k = 0; k < (h > 28 ? 21 : 12); k++) {
      const a = random() * Math.PI * 2,
        r = Math.sqrt(random());
      plant(px + Math.cos(a) * r * rx, pz + Math.sin(a) * r * rz, 2.3 + random() * 2.6);
    }
  }
  // Orchards and woodland sit on authored folds between cultivated plains, never an even grid.
  for (const [gx, gz, rx, rz] of layout.groves)
    for (let k = 0; k < 22; k++) {
      const angle = random() * Math.PI * 2,
        r = Math.sqrt(random());
      plant(
        gx + Math.cos(angle) * rx * r,
        gz + Math.sin(angle) * rz * r,
        1.8 + random() * 1.7,
        k % 7 === 0 ? 1 : 0,
      );
    }
  // Broken bank-side tree ribbons leave stretches of reed and open shore between groves.
  for (const river of scrollRivers)
    for (let i = 3; i < river.samples.length - 3; i += 6) {
      const [x, z] = river.samples[i],
        a = river.samples[i - 1],
        b = river.samples[i + 1];
      if (Math.sin(x * 0.14 + z * 0.11) < -0.12) continue;
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      const side = i % 2 ? -1 : 1,
        offset = (river.width + 1.5 + random() * 1.5) * side;
      plant(
        x - (dz / len) * offset,
        z + (dx / len) * offset,
        1.6 + random() * 1.6,
        i % 8 === 0 ? 1 : 0,
      );
    }
  for (let i = 0; i < 40; i++) {
    const a = random() * Math.PI * 2;
    plant(
      jl.x + Math.cos(a) * (17 + random() * 8),
      jl.z + Math.sin(a) * (13 + random() * 6),
      1.7 + random() * 1.2,
      2,
    );
  }
  const gardenCount = plan.trees.filter((p) => waterDistance(p.x, p.z) > 0).length;
  const forest = new THREE.InstancedMesh(farTree, mat.leaf, treePlaces.length - gardenCount);
  const gardens = new THREE.InstancedMesh(tree, mat.leaf, gardenCount);
  const transform = new THREE.Object3D();
  for (let i = 0; i < treePlaces.length; i++) {
    const p = treePlaces[i];
    transform.position.set(p.x, terrainHeight(p.x, p.z) - 0.08, p.z);
    transform.rotation.y = random() * Math.PI * 2;
    transform.scale.set(p.scale * 0.76, p.scale, p.scale * 0.76);
    transform.updateMatrix();
    const instance = i < gardenCount ? gardens : forest,
      index = i < gardenCount ? i : i - gardenCount;
    instance.setMatrixAt(index, transform.matrix);
    const tint =
      p.type === 1
        ? gold.clone().lerp(paper, 0.15)
        : p.type === 2
          ? palette('accent-honglou').lerp(paper, 0.47)
          : jade.clone().lerp(palette('scene-mist'), 0.04 + random() * 0.12);
    instance.setColorAt(index, tint);
  }
  forest.instanceMatrix.needsUpdate = true;
  forest.computeBoundingSphere();
  gardens.instanceMatrix.needsUpdate = true;
  gardens.computeBoundingSphere();
  // Cull woods by area in close/portrait views instead of drawing the entire world's trees.
  const forestChunks: THREE.InstancedMesh[] = [];
  for (const [source, start, count] of [
    [gardens, 0, gardenCount],
    [forest, gardenCount, treePlaces.length - gardenCount],
  ] as const) {
    const areas = new Map<string, number[]>();
    for (let i = 0; i < count; i++) {
      const p = treePlaces[start + i],
        key = `${Math.floor(p.x / 54)},${Math.floor(p.z / 54)}`;
      const list = areas.get(key) ?? [];
      list.push(i);
      areas.set(key, list);
    }
    for (const list of areas.values()) {
      const chunk = new THREE.InstancedMesh(source.geometry, source.material, list.length),
        tint = new THREE.Color();
      list.forEach((index, i) => {
        source.getMatrixAt(index, transform.matrix);
        source.getColorAt(index, tint);
        chunk.setMatrixAt(i, transform.matrix);
        chunk.setColorAt(i, tint);
      });
      chunk.instanceMatrix.needsUpdate = true;
      chunk.computeBoundingSphere();
      root.add(chunk);
      forestChunks.push(chunk);
    }
    source.dispose();
  }
  // Reeds belong to irregular shoals in the same terrain, instead of a dotted lake perimeter.
  for (const [wx, wz, rx, rz] of layout.wetlands)
    for (let i = 0; i < 32; i++) {
      const a = random() * Math.PI * 2,
        r = Math.sqrt(random()) * 0.8,
        x = wx + Math.cos(a) * rx * r,
        z = wz + Math.sin(a) * rz * r;
      const base = terrainHeight(x, z);
      if (base < 0.08) continue;
      for (let k = 0; k < 3; k++) {
        const h = 1.1 + random() * 0.95,
          px = x + k * 0.12,
          pz = z + k * 0.07;
        box(px, base, pz, 0.045, h, 0.045, mat.ochre);
        box(px, base + h * 0.75, pz, 0.11, 0.3, 0.08, mat.wood);
      }
    }
  // Combine structures by pigment, keeping many buildings to a handful of draws.
  const contourMaterial = new THREE.LineBasicMaterial({
    color: ink,
    transparent: true,
    opacity: 0.34,
  });
  materials.add(contourMaterial);
  for (const [material, items] of buckets) {
    const g = mergeGeometries(items, false);
    items.forEach((item) => item.dispose());
    if (g) {
      geometry.add(g);
      root.add(new THREE.Mesh(g, material));
      const edges = new THREE.EdgesGeometry(g, 32);
      geometry.add(edges);
      root.add(new THREE.LineSegments(edges, contourMaterial));
    }
  }
  // All ground paths are part of the terrain's own pigment/route texture. No offset ribbons.
  const contactGeometry = new THREE.CircleGeometry(0.7, 10);
  contactGeometry.rotateX(-Math.PI / 2);
  geometry.add(contactGeometry);
  const contactMaterial = new THREE.MeshBasicMaterial({
    color: ink,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });
  materials.add(contactMaterial);
  const contacts = new THREE.InstancedMesh(contactGeometry, contactMaterial, treePlaces.length);
  treePlaces.forEach((p, i) => {
    transform.position.set(p.x, terrainHeight(p.x, p.z) + 0.08, p.z);
    transform.rotation.set(0, 0, 0);
    transform.scale.setScalar(p.scale * 0.5);
    transform.updateMatrix();
    contacts.setMatrixAt(i, transform.matrix);
  });
  contacts.instanceMatrix.needsUpdate = true;
  contacts.computeBoundingSphere();
  root.add(contacts);
  // A single unbroken plane under the carved terrain: river/lake junctions never overlap.
  const waterGeo = new THREE.PlaneGeometry(east - west, south - north);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate((west + east) / 2, 0.025, (north + south) / 2);
  geometry.add(waterGeo);
  const waterMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: vertex,
    uniforms: {
      uTime: { value: 0 },
      uWater: { value: palette('accent-shuihu').lerp(paper, 0.35) },
      uPaper: { value: paper },
      uRipple: { value: new THREE.Vector3(999, 999, -100) },
    },
    fragmentShader: `
    uniform float uTime;uniform vec3 uWater,uPaper,uRipple;varying vec3 vWorld,vNormal,vColor;varying vec2 vUv;varying float vHeight;${pigment}
    void main(){
      float n=noise(vWorld.xz*.3);float wave=sin(vWorld.x*.15+vWorld.z*5.8+uTime*.5+n*3.);
      float strokes=smoothstep(.94,.995,wave)*smoothstep(.4,.75,noise(vWorld.xz*vec2(.8,.15)))*.22;
      float longStroke=0.;
      float d=distance(vWorld.xz,uRipple.xy),age=uTime-uRipple.z;
      float ripple=(1.-smoothstep(0.,6.,age))*smoothstep(.85,.97,sin(d*5.-age*4.))*(1.-smoothstep(age*1.6,age*1.6+1.,d));
      vec3 depth=mix(uWater*.87,uWater,noise(vWorld.xz*.07)*.65+.2);
      vec3 c=mix(depth,uPaper,strokes+longStroke+max(0.,ripple)*.3);
      c=mix(c,uPaper,(1.-smoothstep(-290.,-65.,vWorld.z))*.3);
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`,
  });
  materials.add(waterMat);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'One stable flowing river and lake surface';
  root.add(waterMesh);
  const boats: THREE.Group[] = [];
  const boatHull = new THREE.ConeGeometry(0.7, 4.2, 4);
  boatHull.rotateZ(Math.PI / 2);
  boatHull.scale(1, 0.4, 0.8);
  geometry.add(boatHull);
  for (let i = 0; i < 17; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boatHull, mat.wood);
    boat.add(hull);
    const sailGeo = new THREE.PlaneGeometry(1.5, 2.2);
    geometry.add(sailGeo);
    const sail = new THREE.Mesh(sailGeo, mat.white);
    sail.position.set(0, 1.55, 0);
    boat.add(sail);
    const navigable = scrollRivers.filter((r) => r.width > 2);
    const r = navigable[i % navigable.length];
    boat.userData.route = r.samples;
    boat.userData.phase = 0.1 + (i / 17) * 0.8;
    root.add(boat);
    boats.push(boat);
  }
  // Ink birds, low drifting mist, smoke and banners animate from one frozen clock.
  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.7, 0.15, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.15, 0], 3),
  );
  geometry.add(birdGeometry);
  const birdMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.65 });
  materials.add(birdMat);
  const birds: THREE.LineSegments[] = [];
  for (let i = 0; i < 15; i++) {
    const bird = new THREE.LineSegments(birdGeometry, birdMat);
    bird.userData.phase = i;
    root.add(bird);
    birds.push(bird);
  }
  const mistMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPaper: { value: paper } },
    vertexShader: vertex,
    fragmentShader:
      `uniform float uTime;uniform vec3 uPaper;varying vec2 vUv;${pigment}void main(){vec2 p=(vUv-.5)*2.;float n=noise(vUv*vec2(10.,3.)+uTime*.015);float a=(1.-smoothstep(.1,1.,dot(p,p)))*(.18+.25*n);gl_FragColor=vec4(uPaper,a);#include <colorspace_fragment>}`.replace(
        '#include',
        '\n#include',
      ),
  });
  materials.add(mistMaterial);
  const mistGeo = new THREE.PlaneGeometry(1, 1);
  geometry.add(mistGeo);
  const mist: THREE.Mesh[] = [];
  for (const [x, z, width, depth, altitude] of layout.mist) {
    const m = new THREE.Mesh(mistGeo, mistMaterial);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = (random() - 0.5) * 0.4;
    m.scale.set(width, depth, 1);
    m.position.set(x, altitude, z);
    m.userData.x = x;
    m.userData.z = z;
    m.userData.phase = random() * 6;
    root.add(m);
    mist.push(m);
  }
  let disposed = false;
  const wind = new THREE.Vector2();
  const tick = (time: number) => {
    if (disposed) return;
    waterMat.uniforms.uTime.value = time;
    mistMaterial.uniforms.uTime.value = time;
    mist.forEach((m) => {
      m.position.x = m.userData.x + Math.sin(time * 0.025 + m.userData.phase) * 7 + wind.x;
      m.position.z = m.userData.z + Math.sin(time * 0.018 + m.userData.phase) * 2 + wind.y;
    });
    boats.forEach((boat, i) => {
      const path = boat.userData.route as number[][];
      const t = (boat.userData.phase + time * 0.0014) % 1;
      const at = t * (path.length - 1),
        j = Math.min(path.length - 2, Math.floor(at)),
        a = path[j],
        b = path[j + 1];
      boat.position.set(
        THREE.MathUtils.lerp(a[0], b[0], at - j),
        0.4 + Math.sin(time * 0.7 + i) * 0.035,
        THREE.MathUtils.lerp(a[1], b[1], at - j),
      );
      boat.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    });
    birds.forEach((bird, i) => {
      bird.position.set(
        -10 + i * 3 + Math.sin(time * 0.025) * 28,
        25 + Math.sin(time * 0.2 + i) * 0.3,
        -58 - i * 1.4 + ((time * 0.18) % 40),
      );
      bird.scale.y = 0.55 + Math.sin(time * 3.8 + i) * 0.3;
    });
    flags.forEach((flag, i) => {
      const p = flag.geometry.getAttribute('position');
      for (let j = 0; j < p.count; j++) p.setZ(j, Math.sin(p.getX(j) * 4 + time * 2 + i) * 0.12);
      p.needsUpdate = true;
    });
  };
  tick(0);
  return {
    artRecipe: 'planar-crags-triplanar-continuous-fields-v3',
    root,
    anchors,
    buildingCount,
    treeCount: treePlaces.length,
    cloudCount: mist.length,
    water: waterMesh,
    tick,
    pointAt: (x: number, z: number) => wind.set(x * 0.008, z * 0.008),
    disturb: (point: THREE.Vector3, time: number) => {
      waterMat.uniforms.uRipple.value.set(point.x, point.z, time);
    },
    cloudPosition: () => `${mist[0].position.x.toFixed(3)},${mist[0].position.z.toFixed(3)}`,
    dispose: () => {
      disposed = true;
      root.removeFromParent();
      forestChunks.forEach((chunk) => chunk.dispose());
      contacts.dispose();
      geometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      earth.dispose();
      grain.dispose();
      routes.dispose();
    },
  };
}
