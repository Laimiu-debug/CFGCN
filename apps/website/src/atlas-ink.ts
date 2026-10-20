import * as THREE from 'three';

type Palette = (name: string) => THREE.Color;

// A light paper/ink finish preserves the source roof, rock, earth and foliage
// pigments. Ink painting is not a monochrome green replacement texture.
export function finishAtlasInInk(root: THREE.Object3D, palette: Palette) {
  const seen = new Set<THREE.Material>();
  const time = { value: 0 };
  let canopies = 0;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || seen.has(material)) continue;
      seen.add(material);
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey();
      material.roughness = 1;
      material.metalness = 0;
      const asset = material.userData.atlasAsset as string | undefined;
      const canopy = asset === 'pine';
      const movingLeaves = canopy || asset === 'canopy' || asset === 'shrub';
      if (movingLeaves) canopies++;
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        shader.uniforms.inkTime = time;
        shader.vertexShader =
          'uniform float inkTime; varying vec2 inkWorldPoint; varying float inkLocalHeight;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `vec4 inkPoint=vec4(transformed,1.);
          #ifdef USE_INSTANCING
            inkPoint=instanceMatrix*inkPoint;
          #endif
          inkPoint=modelMatrix*inkPoint;
          inkWorldPoint=inkPoint.xz;
          inkLocalHeight=position.y;
          ${
            movingLeaves
              ? `float inkCrown=smoothstep(${asset === 'shrub' ? '.25,.7' : '1.8,3.1'},position.y);
          float inkGust=sin(inkPoint.x*.21+inkPoint.z*.14+inkTime*.75)*.7+sin(inkPoint.z*.4-inkTime*1.05)*.3;
          transformed.x+=inkCrown*inkGust*.08;
          transformed.z+=inkCrown*sin(inkTime*.6+inkPoint.x*.13)*.035;`
              : ''
          }
          #include <project_vertex>`,
        );
        shader.fragmentShader =
          'uniform float inkTime; varying vec2 inkWorldPoint; varying float inkLocalHeight;\n' +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `float inkCloud=sin(inkWorldPoint.x*.018-inkTime*.026+sin(inkWorldPoint.y*.013)*1.3)*sin(inkWorldPoint.y*.024+inkTime*.018);
          outgoingLight*=1.-smoothstep(.05,.9,inkCloud)*.08;
          #include <opaque_fragment>`,
        );
        shader.uniforms.inkDark = { value: palette('ink').lerp(palette('gold-ink'), 0.16) };
        shader.uniforms.inkPaper = { value: palette('paper') };
        shader.uniforms.inkLeaf = {
          value: palette('jade').lerp(palette('scene-mist'), canopy ? 0.27 : 0.42),
        };
        shader.uniforms.inkStone = { value: palette('paper-shade').lerp(palette('gold'), 0.16) };
        shader.uniforms.inkWood = { value: palette('gold-ink') };
        shader.fragmentShader =
          'uniform vec3 inkDark,inkPaper,inkLeaf,inkStone,inkWood;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          ${
            canopy
              ? `vec3 pinePigment=mix(inkStone,inkWood,smoothstep(.55,1.1,inkLocalHeight));
          pinePigment=mix(pinePigment,inkLeaf,smoothstep(1.35,2.05,inkLocalHeight));
          diffuseColor.rgb=mix(pinePigment,diffuseColor.rgb,.12);`
              : ''
          }
          ${
            asset === 'canopy' || asset === 'shrub'
              ? `vec3 livingPigment=mix(inkWood,inkLeaf,smoothstep(.65,1.65,inkLocalHeight));
          diffuseColor.rgb=mix(diffuseColor.rgb,livingPigment,.38);`
              : ''
          }
          float inkLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec3 inkPigment=mix(inkDark,inkPaper,clamp(inkLuma,0.,1.));
          diffuseColor.rgb=mix(diffuseColor.rgb,inkPigment,.14);`,
        );
      };
      material.customProgramCacheKey = () => `${cacheKey}-shared-pigments-${asset ?? 'ground'}-v6`;
      material.needsUpdate = true;
    }
  });
  return {
    canopyMaterials: canopies,
    tick(seconds: number) {
      time.value = seconds;
    },
  };
}

// Connected land-use bands, shared by the terrain, module roots and infill.
// They describe illustrated countryside, not political or historical borders.
export function atlasHabitat(x: number, z: number, height: number) {
  const fold = Math.sin(x * 0.058 + Math.sin(z * 0.055) * 1.8);
  const ridge = Math.sin(z * 0.063 - x * 0.019 + Math.sin(x * 0.038));
  return THREE.MathUtils.smoothstep(height * 0.16 + fold * 0.65 + ridge * 0.55, 0.25, 1.7);
}

const groundPalettes = new WeakMap<
  Palette,
  {
    soil: THREE.Color;
    meadow: THREE.Color;
    forest: THREE.Color;
    stone: THREE.Color;
  }
>();
export function atlasGroundColor(x: number, z: number, height: number, palette: Palette) {
  let colors = groundPalettes.get(palette);
  if (!colors) {
    colors = {
      soil: palette('gold').lerp(palette('paper-shade'), 0.37),
      meadow: palette('jade').lerp(palette('paper-shade'), 0.5).lerp(palette('gold'), 0.1),
      forest: palette('jade').lerp(palette('gold-ink'), 0.17).lerp(palette('paper-shade'), 0.28),
      stone: palette('paper-shade').lerp(palette('ink'), 0.39),
    };
    groundPalettes.set(palette, colors);
  }
  const forest = atlasHabitat(x, z, height);
  const wash = Math.sin(x * 0.095 + Math.sin(z * 0.072) * 2) * Math.sin(z * 0.11 + x * 0.034);
  const color = colors.soil.clone().lerp(colors.meadow, 0.37 + wash * 0.19);
  color.lerp(colors.forest, forest * 0.7);
  return color.lerp(colors.stone, THREE.MathUtils.smoothstep(height, 13, 30) * 0.55);
}
