"""Continuous elevated valley, verified Tripo meshes, baked static shade.
Foundation geometry is original. Source models remain immutable.
"""
import bpy, hashlib, json, math, re, struct, sys, random
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sys.path.insert(0,str(HERE))
from terrain_profile import terrain_height, river_center, river_width, valley_width, valley_center, t_smooth
OUT=ROOT/'apps/website/public/games/xiyou/assets'
LAYOUT=json.loads((HERE/'world-layout.json').read_text(encoding='utf-8'))
COMPOSITION=json.loads((HERE/'environment-composition.json').read_text(encoding='utf-8'))
TOKENS=dict(re.findall(r'--([\w-]+):\s*(#[a-fA-F0-9]{6});',(ROOT/'packages/ui/src/tokens.css').read_text(encoding='utf-8')))

def color(name):
    rgb=[int(TOKENS[name][i:i+2],16)/255 for i in (1,3,5)]
    return Vector([v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb])

def material(name,ground=False):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.94
    bsdf.inputs['Specular IOR Level'].default_value=.12
    if ground:
        node=mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image=bpy.data.images.load(str(HERE/'source/terrain-atlas-runtime.jpg'),check_existing=True)
        node.image.pack()
        mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value=(*color('accent-shuihu'),1)
        bsdf.inputs['Alpha'].default_value=.86
    return mat

def import_mesh(name):
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/f'{name}.glb'))
    imported=[o for o in bpy.context.scene.objects if o not in before]
    meshes=[o for o in imported if o.type=='MESH'];assert len(meshes)==1,name
    obj=meshes[0];obj.data.transform(obj.matrix_world);obj.parent=None;obj.matrix_world=Matrix.Identity(4)
    for other in imported:
        if other!=obj:bpy.data.objects.remove(other,do_unlink=True)
    return obj

def place(template,x,z,s=1.,angle=0.,stretch=(1.,1.,1.),bury=.25):
    obj=template.copy();obj.data=template.data;bpy.context.collection.objects.link(obj)
    obj.location=(x,-z,terrain_height(x,z)-bury)
    obj.scale=tuple(s*v for v in stretch)
    # Imported glTF objects use quaternion mode: writing Euler angles alone
    # silently left every old cliff facing across the road.
    obj.rotation_mode='XYZ';obj.rotation_euler.z=math.radians(angle)
    if template.name.startswith('Natural limestone'):
        rotation=obj.rotation_euler.to_matrix()
        points=[rotation@Vector((v.co.x*obj.scale.x,v.co.y*obj.scale.y,0.)) for v in list(template.data.vertices)[::max(1,len(template.data.vertices)//300)]]
        obj.location.z=min(terrain_height(x+p.x,z-p.y) for p in points)-bury
    return obj

def ground_mesh(name,z0,z1):
    if z0==58:
        zs=sorted(set([58.+i*1.5 for i in range(70) if 58.+i*1.5<162.]+[82.+i*.5 for i in range(43)]+[162.]))
    else:zs=[float(z) for z in range(z0,z1+1)]
    vertices=[]
    for z in zs:
        edge=valley_width(z)
        outer=sorted(set([48.,42.,36.,31.,27.,24.,edge+4.8,edge+3.2,edge+2.4,edge+1.4,edge+.9,edge+.3,edge]),reverse=True)
        xs=[-v for v in outer]+[(edge-.65)*i/18 for i in range(-18,19)]+list(reversed(outer))
        vertices.extend((x+valley_center(z),-z,terrain_height(x+valley_center(z),z)) for x in xs)
    faces=[];nx=len(xs)
    for j in range(len(zs)-1):
        for i in range(nx-1):
            a=j*nx+i;faces.append((a,a+nx,a+nx+1,a+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(material('Original earth wash',True))
    for face in mesh.polygons:face.use_smooth=True
    uv=mesh.uv_layers.new(name='Earth brush texture')
    for loop in mesh.loops:
        p=mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(p.x/13.+math.sin(p.y*.039)*.1,p.y/13.+math.sin(p.x*.043)*.1)
    return obj

def bake_ground(ground,casters):
    # Static sun shadows and sparse hemisphere AO use no runtime shadow pass.
    bpy.context.view_layer.update();verts=[];polys=[]
    for obj in casters:
        start=len(verts);verts.extend(obj.matrix_world@v.co for v in obj.data.vertices)
        polys.extend(tuple(start+i for i in p.vertices) for p in obj.data.polygons)
    bvh=BVHTree.FromPolygons(verts,polys,all_triangles=False)
    sun=Vector((-.65,.45,1.)).normalized()
    ambient=[Vector(v).normalized() for v in [(1,.3,1),(-.3,1,1),(-1,-.4,1),(.3,-1,1)]]
    attr=ground.data.color_attributes.new(name='Mineral wash and baked shade',type='FLOAT_COLOR',domain='POINT')
    for vertex,item in zip(ground.data.vertices,attr.data):
        x,y,h=vertex.co;z=-y;origin=vertex.co+Vector((0,0,.07))
        shade=sum(bvh.ray_cast(origin,(sun+Vector((j*.04,-j*.03,0))).normalized(),32)[0] is not None for j in [-1,0,1])/3
        ao=sum(bvh.ray_cast(origin,d,5)[0] is not None for d in ambient)/4
        bend=.9*math.sin(z*.06)+1.3*math.sin(z*.025)
        path=1-t_smooth(1.5,4.5,abs(x-bend))
        # Broad mineral-pigment masses, with quiet earth through the combat
        # spaces. The image texture supplies brush grain, not the whole scene.
        noise=.5+.18*math.sin(x*.23+z*.11)+.13*math.cos(z*.31-x*.17)+.08*math.sin(x*.57+z*.41)
        island=t_smooth(.36,.68,noise)
        dry=color('paper-shade').lerp(color('gold'),.10+noise*.08)
        green=color('paper-shade').lerp(color('accent-xiyou'),.58+island*.25)
        rgb=green.lerp(dry,path*.78)
        # Bare mineral toe, rather than an unmarked grassy plane at a clamp.
        slope=t_smooth(valley_width(z)-.65,valley_width(z)+.75,abs(x-valley_center(z)))
        ends=max(1-t_smooth(-5.,-2.,z),t_smooth(107.3,110.,z))
        rock=color('paper-shade').lerp(color('accent-shuihu'),.25+noise*.14)
        # Contours follow real elevation and vary by side, avoiding two equal
        # tan embankments that swallowed the previous battle camera.
        rgb=rgb.lerp(rock,max(slope,ends)*.92)
        wet=1-t_smooth(river_width(x),river_width(x)+2.4,abs(z-river_center(x)))
        rgb=rgb.lerp(color('paper-shade').lerp(color('accent-shuihu'),.52),wet*.65)
        # COLOR_0 is an explicit authoring payload: trail / mineral / wet
        # masks and baked illumination. The runtime and editable Blender
        # material read the same masks, never an ignored extra colour layer.
        mineral=max(slope,ends)
        shingle=wet*(1.-mineral)
        item.color=(path*.82,mineral,shingle,1.-.33*shade-.16*ao)

def preview_ground_material(ground):
    """Editable DCC preview of the exact four-way runtime atlas blend."""
    mat=ground.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links
    image=next(n.image for n in nodes if n.type=='TEX_IMAGE')
    nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value=.94;bsdf.inputs['Specular IOR Level'].default_value=.12
    links.new(bsdf.outputs[0],out.inputs['Surface'])
    attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Mineral wash and baked shade'
    separate=nodes.new('ShaderNodeSeparateColor');links.new(attr.outputs['Color'],separate.inputs[0])
    texcoord=nodes.new('ShaderNodeTexCoord');fraction=nodes.new('ShaderNodeVectorMath');fraction.operation='FRACTION'
    links.new(texcoord.outputs['UV'],fraction.inputs[0])
    swatches=[]
    for x,y in [(0.,.5),(.5,.5),(0.,0.),(.5,0.)]:
        mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY_ADD'
        mapping.inputs[1].default_value=(.48,.48,1.);mapping.inputs[2].default_value=(x+.01,y+.01,0.)
        links.new(fraction.outputs[0],mapping.inputs[0]);texture=nodes.new('ShaderNodeTexImage');texture.image=image
        links.new(mapping.outputs[0],texture.inputs['Vector']);swatches.append(texture.outputs['Color'])
    result=swatches[0]
    # The rock mask wins at the boundary; pebbles never wash over the cliff.
    for texture,channel in [(swatches[1],'Red'),(swatches[3],'Blue'),(swatches[2],'Green')]:
        mix=nodes.new('ShaderNodeMixRGB');links.new(separate.outputs[channel],mix.inputs[0])
        links.new(result,mix.inputs[1]);links.new(texture,mix.inputs[2]);result=mix.outputs[0]
    illumination=nodes.new('ShaderNodeMixRGB');illumination.blend_type='MULTIPLY';illumination.inputs[0].default_value=1.
    links.new(result,illumination.inputs[1]);links.new(attr.outputs['Alpha'],illumination.inputs[2])
    links.new(illumination.outputs[0],bsdf.inputs['Base Color'])

def stream():
    verts=[];faces=[];nx=96;ny=12
    for i in range(nx+1):
        x=-48.+i
        for j in range(ny+1):
            z=river_center(x)+(j/ny*2.-1.)*(river_width(x)+4.0)
            verts.append((x,-z,.12))
    for i in range(nx):
        for j in range(ny):
            a=i*(ny+1)+j;faces.append((a,a+1,a+ny+2,a+ny+1))
    mesh=bpy.data.meshes.new('Flowing jade stream');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('Flowing jade stream',mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(material('Depth coloured stream'));return obj

def build(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    river=name=='river_scene';z0,z1=(58,162) if river else (-24,58)
    ground=ground_mesh('Continuous valley ground',z0,z1);exports=[ground];casters=[]
    cliff=import_mesh('canyon_wall')
    # Continuous masses buried into the relief; no fence of freestanding props.
    for item in LAYOUT['cliffs']:
        x,z=item['x'],item['z']
        if (z>=58)!=river:continue
        sx,sy,sz=item['scale']
        o=place(cliff,x,z,1.,item['angle'],(sx,sz,sy),.6);exports.append(o);casters.append(o)
        # Tall imported masses stay outside the combat shelf. The continuous
        # mineral slope supplies the actual boundary and never moves at a seam.
        bpy.context.view_layer.update()
        if abs(x)>1:
            for v in o.data.vertices:
                p=o.matrix_world@v.co
                assert abs(p.x-valley_center(-p.y))>valley_width(-p.y)+.6,(name,'cliff enters playable ground',tuple(p))
    bpy.data.objects.remove(cliff,do_unlink=True)
    # These pines are bake-only. Runtime uses the same shared positions and LOD.
    pine=import_mesh('pine_tree')
    props=json.loads((HERE/'world-props.json').read_text(encoding='utf-8'))
    for group in ([2] if river else [0,1]):
        for x,z,s in props[group]:
            casters.append(place(pine,x,z,s,23+x*7+z*11,(1.,1.,.90+.15*math.sin(z*.7)),bury=.05))
    bpy.data.objects.remove(pine,do_unlink=True)
    shrub=import_mesh('mountain_shrub');rng=random.Random(880 if river else 450)
    # Groundcover belongs to a grove, not independent random leaf confetti.
    # Low and walk-through; collision remains exclusively the shared solids.
    for patch in COMPOSITION['groves']:
        if (patch['z']>=58)!=river:continue
        for i in range(patch['count']):
            angle=rng.uniform(0,math.tau);r=patch['radius']*math.sqrt(rng.random())
            x=patch['x']+math.cos(angle)*r;z=patch['z']+math.sin(angle)*r
            if abs(x-valley_center(z))>valley_width(z)-.5:continue
            if abs(z-river_center(x))<river_width(x)+2.8:continue
            o=place(shrub,x,z,rng.uniform(.55,1.25),rng.uniform(0,360),stretch=(1.,1.,.65),bury=.10)
            exports.append(o);casters.append(o)
    bpy.data.objects.remove(shrub,do_unlink=True)
    if river:exports.append(stream())
    # Shared runtime stones are bake-only here, so they cannot have a second,
    # independently placed invisible collision shape or a duplicate river mesh.
    stone=import_mesh('seal_stone')
    if river:
        for x,z,s,angle in COMPOSITION['river_shingle']:
            # Ankle-low shingle is passable visual dressing. Large river
            # boulders below still use the exact shared collision ellipses.
            o=place(stone,x,z,s,angle,stretch=(1.,.8,.12),bury=.06)
            exports.append(o);casters.append(o)
    for item in LAYOUT['stones']:
        if item['event'] or (item['z']>=58)!=river:continue
        sx,sy,sz=item['scale']
        casters.append(place(stone,item['x'],item['z'],1.,item['angle'],(sx,sz,sy),.05))
    bpy.data.objects.remove(stone,do_unlink=True)
    bake_ground(ground,casters)
    preview_ground_material(ground)
    if river:
        for obj in bpy.context.scene.objects:obj.location.y+=64
    bpy.ops.object.select_all(action='DESELECT')
    for o in exports:o.select_set(True)
    bpy.context.view_layer.objects.active=ground
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'source'/f'{name}.blend'))
    # glTF carries one supported albedo image; the game recreates the saved
    # Blender blend graph from COLOR_0. Do not ask glTF to export node mixing.
    ground.data.materials[0]=material('Original earth atlas, runtime masks',True)
    path=OUT/f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=79,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
    blob=path.read_bytes();gltf=json.loads(blob[20:20+struct.unpack_from('<I',blob,12)[0]])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
    assert triangles<=25000 and len(blob)<1600000,(name,triangles,len(blob))
    manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    modules=[e for e in manifest['assets'] if e['asset'] in ['canyon_wall','pine_tree','mountain_shrub','seal_stone']]
    entry={'asset':name,'origin':'tripo-studio-blender-composition','source_blend':f'{name}.blend',
      'studio_modules':[{k:e[k] for k in ['asset','studio_project','source_file','source_sha256','runtime_sha256'] if k in e} for e in modules],
      'foundation':'Original continuous elevation, curved river, baked static shadows; Studio rocks and pines',
      'terrain_profile':'packages/game-core/data/xiyou-terrain.json','world_layout':'apps/xiyou/art/world-layout.json','environment_composition':'apps/xiyou/art/environment-composition.json','ground_painting':'apps/xiyou/art/terrain-atlas.json','ground_masks':'COLOR_0.r=trail,g=mineral,b=shingle,a=baked illumination',
      'triangles':triangles,'bones':0,'clips':[],'bytes':len(blob),'triangle_budget':25000,'byte_budget':1600000,'texture_max':768,'joint_budget':0,'primitive_budget':5}
    manifest['assets']=[e for e in manifest['assets'] if e['asset']!=name]+[entry]
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CFGCN_VALLEY '+json.dumps(entry));return entry

if __name__=='__main__':
    for name in ['mountain_world','river_scene']:build(name)
