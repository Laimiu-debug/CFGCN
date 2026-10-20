//! Accepted Tripo enemies: shared 3D LODs and GPU vertex animation, no per-mob rig.
use super::*;
use bevy::{
    camera::primitives::Aabb,
    gltf::{GltfMaterial, GltfMesh},
    image::ImageLoaderSettings,
    mesh::MeshTag,
};
use std::collections::HashSet;

#[derive(serde::Deserialize)]
struct Metadata {
    data_width: u32,
    meshes: Vec<Clip>,
}
#[derive(serde::Deserialize)]
struct Clip {
    mesh: usize,
    base_pixel: u32,
    vertices: u32,
    frames: u32,
    lower: [f32; 3],
    span: [f32; 3],
}
struct Slot {
    mesh: Handle<Mesh>,
    paint: Handle<paint::PaintedMaterial>,
    bounds: Aabb,
}
#[derive(Resource, Default)]
pub struct Crowd {
    requested: bool,
    requested_at: f32,
    root: Handle<Gltf>,
    data: Handle<Image>,
    slots: Vec<Slot>,
    active: HashMap<u32, Entity>,
    spare: Vec<Entity>,
    ground: Option<cfgcn_game_core::TerrainGrid>,
    close: HashSet<u32>,
}
impl Crowd {
    pub fn timed_out(&self, now: f32) -> bool {
        self.requested && !self.ready() && now - self.requested_at > 60.
    }
    pub fn ready(&self) -> bool {
        self.slots.len() == 4
    }
    pub fn counts(&self) -> [usize; 2] {
        [self.active.len(), self.spare.len()]
    }
    pub fn detailed(&self, id: u32) -> bool {
        self.active.len() <= 64 || self.close.contains(&id)
    }
    pub fn failed(&self, server: &AssetServer) -> bool {
        [self.root.id().untyped(), self.data.id().untyped()]
            .iter()
            .any(|id| {
                matches!(
                    server.get_load_state(*id),
                    Some(bevy::asset::LoadState::Failed(_))
                )
            })
    }
}
#[derive(Component)]
pub struct CrowdActor;

pub fn request(
    mut crowd: ResMut<Crowd>,
    sim: Res<Simulation>,
    server: Res<AssetServer>,
    time: Res<Time<Real>>,
) {
    if crowd.requested || sim.0.expedition.is_some() {
        return;
    }
    *crowd = Crowd {
        requested: true,
        requested_at: time.elapsed_secs(),
        root: server.load("crowd.glb"),
        data: server
            .load_builder()
            .with_settings(|s: &mut ImageLoaderSettings| {
                s.is_srgb = false;
            })
            .load("crowd-vat.png"),
        slots: vec![],
        active: HashMap::new(),
        spare: vec![],
        ground: Some(cfgcn_game_core::TerrainGrid::default()),
        close: HashSet::new(),
    };
}
pub fn load(
    mut crowd: ResMut<Crowd>,
    gltfs: Res<Assets<Gltf>>,
    gltf_meshes: Res<Assets<GltfMesh>>,
    images: Res<Assets<Image>>,
    originals: Res<Assets<GltfMaterial>>,
    mut paints: ResMut<Assets<paint::PaintedMaterial>>,
) {
    if !crowd.requested || crowd.ready() || !images.contains(crowd.data.id()) {
        return;
    }
    let Some(gltf) = gltfs.get(&crowd.root) else {
        return;
    };
    let meta: Metadata = serde_json::from_str(include_str!("../../art/crowd-metadata.json"))
        .expect("validated crowd metadata");
    let mut slots = vec![];
    for clip in meta.meshes {
        let Some(mesh) = gltf.meshes.get(clip.mesh).and_then(|h| gltf_meshes.get(h)) else {
            return;
        };
        let primitive = &mesh.primitives[0];
        let Some(original) = primitive.material.as_ref().and_then(|h| originals.get(h)) else {
            return;
        };
        let lower = Vec3::from_array(clip.lower);
        let span = Vec3::from_array(clip.span);
        slots.push(Slot {
            mesh: primitive.mesh.clone(),
            paint: paints.add(paint::PaintedMaterial {
                tint: original.base_color.to_linear(),
                texture: original.base_color_texture.clone(),
                mist: series_color("scene-mist").to_linear(),
                unlit: Vec4::new(0., 10., 0., if clip.mesh % 2 == 1 { 1. } else { 0. }),
                vat_texture: Some(crowd.data.clone()),
                vat_meta: Vec4::new(
                    clip.base_pixel as f32,
                    clip.vertices as f32,
                    clip.frames as f32,
                    meta.data_width as f32,
                ),
                vat_lower: lower.extend(0.),
                vat_span: span.extend(0.),
                alpha: AlphaMode::Opaque,
            }),
            // Bound the entire animation, including a foot outside the rest pose.
            bounds: Aabb::from_min_max(lower, lower + span),
        });
    }
    crowd.slots = slots;
}
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn sync(
    mut commands: Commands,
    sim: Res<Simulation>,
    mut crowd: ResMut<Crowd>,
    mut rank: Local<Vec<(f32, u32)>>,
    mut near: Local<HashSet<u32>>,
    mut live: Local<HashSet<u32>>,
    mut query: Query<
        (
            &mut Transform,
            &mut Visibility,
            &mut MeshTag,
            &mut Mesh3d,
            &mut MeshMaterial3d<paint::PaintedMaterial>,
            &mut Aabb,
        ),
        With<CrowdActor>,
    >,
) {
    if !crowd.ready() {
        return;
    }
    let run = &sim.0;
    let leader = run.leader_point();
    rank.clear();
    rank.extend(run.enemies.iter().filter(|e| !e.boss).map(|e| {
        (
            (e.pos.x - leader.x).powi(2) + (e.pos.z - leader.z).powi(2),
            e.id,
        )
    }));
    let near_limit = if rank.len() <= 64 { 64 } else { 32 };
    if rank.len() > near_limit {
        rank.select_nth_unstable_by(31, |a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
        rank.truncate(near_limit);
    }
    near.clear();
    near.extend(rank.iter().map(|p| p.1));
    crowd.close.clone_from(&near);
    live.clear();
    for e in run.enemies.iter().filter(|e| !e.boss) {
        live.insert(e.id);
        let slot_index = if e.region == 2 { 2 } else { 0 } + usize::from(!near.contains(&e.id));
        let position = Vec3::new(
            e.pos.x,
            if run.journey.is_some() {
                crowd
                    .ground
                    .as_ref()
                    .expect("requested crowd terrain")
                    .sample(e.pos.x, e.pos.z)
            } else {
                0.
            },
            e.pos.z,
        );
        let size = match e.kind {
            EnemyKind::Swift => Vec3::new(0.6, 0.7, 0.9),
            EnemyKind::Brute => Vec3::splat(1.25),
            _ => Vec3::splat(0.85),
        };
        let size = if e.hit > 0. && !reduced_motion() {
            size * Vec3::new(1.08, 0.9, 1.08)
        } else {
            size
        };
        let mut bits = (e.id.wrapping_mul(2654435761) >> 16) & 65535;
        if e.frozen > 0. {
            bits |= 1 << 17;
        }
        if e.hit > 0. && !reduced_motion() {
            bits |= 1 << 18;
        }
        if e.windup > 0. {
            bits = (bits & !65535) | ((1. - e.windup / 1.05).clamp(0., 1.) * 65535.).round() as u32;
            bits |= 1 << 19;
        }
        if let Some(entity) = crowd.active.get(&e.id).copied() {
            if let Ok((mut t, mut v, mut tag, mut mesh, mut paint, mut bounds)) =
                query.get_mut(entity)
            {
                let d = position - t.translation;
                if d.length_squared() > 0.00001 {
                    t.rotation = Quat::from_rotation_y(d.x.atan2(d.z));
                    bits |= 1 << 16;
                } else if run.phase != Phase::Playing {
                    // Pausing holds the walking pose at the frozen shared time.
                    bits |= tag.value & (1 << 16);
                }
                t.translation = position;
                t.scale = size;
                if *v != Visibility::Inherited {
                    *v = Visibility::Inherited;
                }
                if tag.value != bits {
                    *tag = MeshTag::new(bits);
                }
                let slot = &crowd.slots[slot_index];
                if mesh.0 != slot.mesh {
                    mesh.0 = slot.mesh.clone();
                    paint.0 = slot.paint.clone();
                    *bounds = slot.bounds;
                }
            }
        } else {
            bits |= 1 << 16;
            let entity = crowd
                .spare
                .pop()
                .unwrap_or_else(|| commands.spawn_empty().id());
            let slot = &crowd.slots[slot_index];
            commands.entity(entity).insert((
                CrowdActor,
                Mesh3d(slot.mesh.clone()),
                MeshMaterial3d(slot.paint.clone()),
                Transform::from_translation(position).with_scale(size),
                Visibility::Inherited,
                MeshTag::new(bits),
                slot.bounds,
            ));
            crowd.active.insert(e.id, entity);
        }
    }
    let stale = crowd
        .active
        .keys()
        .filter(|id| !live.contains(id))
        .copied()
        .collect::<Vec<_>>();
    for id in stale {
        if let Some(entity) = crowd.active.remove(&id) {
            if crowd.spare.len() < 64 {
                commands.entity(entity).insert(Visibility::Hidden);
                crowd.spare.push(entity);
            } else {
                commands.entity(entity).despawn();
            }
        }
    }
}
