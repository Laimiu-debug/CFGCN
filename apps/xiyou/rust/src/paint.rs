//! A small matte illustration shader avoids compiling the full PBR feature graph.
use super::*;
use bevy::{
    asset::AssetId,
    mesh::MeshVertexBufferLayoutRef,
    pbr::{MaterialPipeline, MaterialPipelineKey},
    render::render_resource::{
        AsBindGroup, RenderPipelineDescriptor, SpecializedMeshPipelineError,
    },
    shader::ShaderRef,
};
#[derive(Asset, TypePath, AsBindGroup, Debug, Clone)]
pub struct PaintedMaterial {
    #[uniform(0)]
    pub tint: LinearRgba,
    #[texture(1)]
    #[sampler(2)]
    pub texture: Option<Handle<Image>>,
    #[uniform(0)]
    pub mist: LinearRgba,
    #[uniform(0)]
    pub unlit: Vec4,
    #[texture(5)]
    pub vat_texture: Option<Handle<Image>>,
    #[uniform(0)]
    pub vat_meta: Vec4,
    #[uniform(0)]
    pub vat_lower: Vec4,
    #[uniform(0)]
    pub vat_span: Vec4,
    pub alpha: AlphaMode,
}
impl Material for PaintedMaterial {
    fn vertex_shader() -> ShaderRef {
        "series_mesh.wesl".into()
    }
    fn fragment_shader() -> ShaderRef {
        "series_paint.wesl".into()
    }
    fn alpha_mode(&self) -> AlphaMode {
        self.alpha
    }
    fn enable_prepass() -> bool {
        false
    }
    fn enable_shadows() -> bool {
        false
    }
    fn specialize(
        _pipeline: &MaterialPipeline,
        descriptor: &mut RenderPipelineDescriptor,
        _layout: &MeshVertexBufferLayoutRef,
        _key: MaterialPipelineKey<Self>,
    ) -> Result<(), SpecializedMeshPipelineError> {
        // Illustrated foliage and cloth contain thin open surfaces. Keep
        // their reverse faces when replacing the original double-sided PBR.
        descriptor.primitive.cull_mode = None;
        Ok(())
    }
}
#[derive(Resource, Default)]
pub struct PaintCache(HashMap<AssetId<StandardMaterial>, AssetId<PaintedMaterial>>);
pub fn convert(
    mut commands: Commands,
    originals: Res<Assets<StandardMaterial>>,
    mut painted: ResMut<Assets<PaintedMaterial>>,
    mut cache: ResMut<PaintCache>,
    sim: Res<Simulation>,
    meshes: Query<(Entity, &MeshMaterial3d<StandardMaterial>, Option<&Name>)>,
) {
    // iter_mut emits AssetEvent::Modified even for untouched scenery. Only
    // obtain mutable water materials when their actual clock has changed.
    let clocks: Vec<_> = painted
        .iter()
        .filter_map(|(id, material)| {
            if !(material.unlit.y > 8.5 && material.unlit.y < 10.5) {
                return None;
            }
            let value = if material.unlit.y < 9.5 && reduced_motion() {
                0.
            } else {
                sim.0.elapsed
            };
            (material.unlit.z != value).then_some((id, value))
        })
        .collect();
    for (id, value) in clocks {
        if let Some(mut material) = painted.get_mut(id) {
            material.unlit.z = value;
        }
    }
    cache
        .0
        .retain(|source, id| originals.contains(*source) && painted.contains(*id));
    for (entity, material, name) in &meshes {
        let Some(source) = originals.get(&material.0) else {
            continue;
        };
        let handle = cache
            .0
            .get(&material.id())
            .and_then(|id| painted.get_strong_handle(*id))
            .unwrap_or_else(|| {
                let handle = painted.add(PaintedMaterial {
                    tint: source.base_color.to_linear(),
                    texture: source.base_color_texture.clone(),
                    mist: series_color(if sim.0.expedition.is_some() {
                        "paper"
                    } else {
                        "scene-mist"
                    })
                    .to_linear(),
                    unlit: Vec4::new(
                        if source.unlit { 1. } else { 0. },
                        if name.is_some_and(|n| n.as_str().starts_with("Ink scenery")) {
                            15.
                        } else if source.unlit && matches!(source.alpha_mode, AlphaMode::Mask(_)) {
                            14.
                        } else if name
                            .is_some_and(|n| n.as_str().starts_with("Continuous valley ground"))
                        {
                            11.
                        } else if name
                            .is_some_and(|n| n.as_str().starts_with("Living mountain tree"))
                        {
                            12.
                        } else if name
                            .is_some_and(|n| n.as_str().starts_with("Flowing jade stream"))
                        {
                            9.
                        } else {
                            0.
                        },
                        0.,
                        0.,
                    ),
                    alpha: source.alpha_mode,
                    vat_texture: None,
                    vat_meta: Vec4::ZERO,
                    vat_lower: Vec4::ZERO,
                    vat_span: Vec4::ZERO,
                });
                cache.0.insert(material.id(), handle.id());
                handle
            });
        commands
            .entity(entity)
            .remove::<MeshMaterial3d<StandardMaterial>>()
            .insert(MeshMaterial3d(handle));
    }
}
