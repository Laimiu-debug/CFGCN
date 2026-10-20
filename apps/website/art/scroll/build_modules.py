"""Reuse accepted Studio roof / tree components, with editable Blender output.
No new generation; no changes to immutable Studio sources or legacy assets.
Run Blender --background --factory-startup --python this_file.
"""
from pathlib import Path
import bpy, bmesh, json, hashlib
from mathutils import Matrix, Vector
from math import sin,cos

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'apps/website/public/art/atlas/scroll'
OUT.mkdir(parents=True,exist_ok=True)
COMPONENTS=ROOT/'apps/website/art/source/scroll-component-sources.blend'
for relative,digest in [
    ('apps/website/art/source/raw/changan-studio-v31.glb','0fc0ab8e536ca9b9e37a631075459ffa63e1920e64ad6d865d838907bdbab59b'),
    ('apps/xiyou/art/source/raw/pine-tree-studio-v31-source.glb','a5a504d34c95c7ad0f7e28d915a62d249d9fdc7fef13bea571e7f2e43ef51d66')]:
    assert hashlib.sha256((ROOT/relative).read_bytes()).hexdigest()==digest, 'Immutable Studio source changed'
bpy.ops.wm.open_mainfile(filepath=str(COMPONENTS))
roof=bpy.data.objects.get('City gate Studio roof')
tree_source=ROOT/'apps/website/art/source/countryside/canopy.blend'
tree_input_sha=hashlib.sha256(tree_source.read_bytes()).hexdigest()
with bpy.data.libraries.load(str(tree_source),link=False) as (available,loaded):
    loaded.objects=['Living mountain tree from Studio']
tree=loaded.objects[0]
bpy.context.collection.objects.link(tree)
assert roof and tree, 'Existing processed Studio components required'
for obj in list(bpy.data.objects):
    if obj not in [roof,tree]: bpy.data.objects.remove(obj,do_unlink=True)

far=tree.copy();far.data=tree.data.copy();bpy.context.collection.objects.link(far)
report=[]
for obj,name,budget in [(roof,'roof',1000),(tree,'tree',740),(far,'tree-far',240)]:
    obj.data=obj.data.copy()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world=Matrix.Identity(4)
    low=[min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    high=[max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    divisor=high[0]-low[0] if name=='roof' else high[2]-low[2]
    obj.data.transform(Matrix.Scale(1/divisor,4)@Matrix.Translation((-(low[0]+high[0])/2,-(low[1]+high[1])/2,-low[2])))
    # Weld split normal / UV seams before decimation so foliage remains solid.
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00005)
    bm.to_mesh(obj.data);bm.free()
    bpy.context.view_layer.objects.active=obj
    if name.startswith('tree'):
        # Retain the Studio trunk/branches and compose a broader crown from its own
        # upper foliage lobes. This is an editable Blender derivative, not new generation.
        verts=[tuple(v.co) for v in obj.data.vertices]
        faces=[tuple(p.vertices) for p in obj.data.polygons]
        crown=bmesh.new();crown.from_mesh(obj.data)
        bmesh.ops.delete(crown,geom=[v for v in crown.verts if v.co.z<.6],context='VERTS')
        crown.verts.ensure_lookup_table();crown.verts.index_update()
        for angle,dx,dy,dz,scale in [(0,-.16,-.05,.12,.8),(2.1,.16,-.04,.13,.82),(4.2,0,.16,.13,.8)]:
            offset=len(verts)
            for v in crown.verts:
                p=v.co;verts.append((cos(angle)*p.x*scale-sin(angle)*p.y*scale+dx,sin(angle)*p.x*scale+cos(angle)*p.y*scale+dy,p.z*scale+dz))
            faces.extend(tuple(v.index+offset for v in f.verts) for f in crown.faces)
        crown.free()
        mesh=bpy.data.meshes.new(name+' Studio crown composition');mesh.from_pydata(verts,[],faces);mesh.update();obj.data=mesh
        # Close the canopy at map scale instead of reducing it to disconnected twigs.
        for vertex in obj.data.vertices:
            if vertex.co.z>.25: vertex.co += vertex.normal*.012
        remesh=obj.modifiers.new('Coherent foliage masses at atlas scale','REMESH')
        remesh.mode='VOXEL';remesh.voxel_size=.025;remesh.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        soften=obj.modifiers.new('Keep rounded ink foliage shoulders','SMOOTH')
        soften.factor=.45;soften.iterations=2;bpy.ops.object.modifier_apply(modifier=soften.name)
    dec=obj.modifiers.new('Preserve silhouette within homepage instance budget','DECIMATE')
    dec.ratio=(budget-8)/sum(len(p.vertices)-2 for p in obj.data.polygons)
    bpy.ops.object.modifier_apply(modifier=dec.name)
    obj.data.validate(verbose=False,clean_customdata=True)
    obj.data.update()
    obj.data.materials.clear()
    material=bpy.data.materials.new(name+' runtime palette supplied from shared tokens')
    material.diffuse_color=(.3,.4,.35,1)
    obj.data.materials.append(material)
    for face in obj.data.polygons: face.use_smooth=True
    obj.name=name
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_materials='NONE')
    report.append({'name':name,'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'apps/website/art/source/scroll-modules.blend'))
manifest={
    'method':'Existing Tripo Studio components, Blender silhouette LOD; runtime building structures and continuous terrain are authored geometry, not new Studio output.',
    'reference':'.local/art/ink-home-study-v1.png',
    'reference_sha256':'5446868861d8977d0837f8f55d2d17788d34f052af72000b46049413ff9be258',
    'roof_source':{'path':'apps/website/art/source/raw/changan-studio-v31.glb','sha256':'0fc0ab8e536ca9b9e37a631075459ffa63e1920e64ad6d865d838907bdbab59b','studio_project':'f52b6e5e-6dc2-493d-883a-334df4d5e975'},
    'tree_source':{'path':'apps/xiyou/art/source/raw/pine-tree-studio-v31-source.glb','sha256':'a5a504d34c95c7ad0f7e28d915a62d249d9fdc7fef13bea571e7f2e43ef51d66','studio_project':'87c9fabd-3ed8-4916-a29d-9d8107a6ce1e'},
    'editable_source':'apps/website/art/source/scroll-modules.blend','assets':report,
    'tree_component':{'path':tree_source.relative_to(ROOT).as_posix(),'sha256':tree_input_sha},
    'component_source':'apps/website/art/source/scroll-component-sources.blend',
    'component_source_sha256':hashlib.sha256(COMPONENTS.read_bytes()).hexdigest(),
    'scene_sources':[{'path':str(p),'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in [Path('apps/website/src/scroll-settlements.ts'),Path('apps/website/src/scroll-world.ts'),Path('apps/website/src/scroll-terrain.ts'),Path('apps/website/src/scroll-layout.json'),Path('apps/website/src/ScrollAtlas.tsx'),Path('apps/website/src/scroll-view.ts'),Path('scripts/build-scroll-textures.mjs'),Path('scripts/paint-scroll-surface.mjs')]],
    'status':'Homepage implementation based on user-approved composition; actual 3D art requires visual review.'}
if (OUT/'surface.json').exists():
    manifest['surface']={**json.loads((OUT/'surface.json').read_text(encoding='utf-8')),
                         'sha256':hashlib.sha256((OUT/'earth.webp').read_bytes()).hexdigest(),
                         'routes_sha256':hashlib.sha256((OUT/'routes.webp').read_bytes()).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('SCROLL_MODULES '+json.dumps(report))
