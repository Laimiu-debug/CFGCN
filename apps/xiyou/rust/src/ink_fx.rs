//! Painted mineral-pigment spells, silk links and radius-accurate ink warnings.
use super::*;
use bevy::mesh::MeshTag;

#[derive(Component, Clone, Copy, PartialEq, Eq, Hash)]
pub struct InkKey(u8, u32);
#[derive(Resource)]
pub struct InkArt {
    plane: Handle<Mesh>,
    shadow: Handle<Mesh>,
    paints: Vec<Handle<paint::PaintedMaterial>>,
    entities: HashMap<InkKey, Entity>,
}
fn tag(progress: f32) -> MeshTag {
    MeshTag::new((progress.clamp(0., 1.) * 65535.).round() as u32)
}
fn ground(x: f32, z: f32, radius: f32, height: f32, angle: f32) -> Transform {
    Transform::from_xyz(x, height, z)
        .with_scale(Vec3::splat(radius))
        .with_rotation(Quat::from_rotation_y(angle))
}
#[allow(clippy::too_many_arguments)]
pub fn sync(
    mut commands: Commands,
    sim: Res<Simulation>,
    crowd: Res<crowd::Crowd>,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<paint::PaintedMaterial>>,
    mut art: Option<ResMut<InkArt>>,
    mut entities: Query<(
        &InkKey,
        &mut Transform,
        &mut MeshTag,
        &mut MeshMaterial3d<paint::PaintedMaterial>,
    )>,
) {
    if sim.0.expedition.is_some() {
        if let Some(art) = art.as_mut() {
            for (_, entity) in art.entities.drain() {
                commands.entity(entity).despawn();
            }
        }
        return;
    }
    if art.is_none() {
        let mut paints = vec![];
        // One shared material per motif and semantic role; no frame allocations.
        for (texture, token, alpha, kind) in [
            (Some("lotus"), "paper-raised", 0.60, 1.),
            (Some("staff"), "paper", 0.62, 2.),
            (Some("tide"), "paper", 0.72, 3.),
            (Some("warning"), "vermilion", 1., 4.),
            (None, "ink", 0.55, 5.),
            (None, "gold", 0.94, 6.),
            (None, "gold", 0.80, 7.),
            (None, "accent-shuihu", 0.72, 6.),
            (Some("tide"), "paper", 0.30, 3.),
        ] {
            paints.push(materials.add(paint::PaintedMaterial {
                tint: series_color(token).with_alpha(alpha).to_linear(),
                texture: texture.map(|name| server.load(format!("fx/{name}.png"))),
                mist: series_color("scene-mist").to_linear(),
                unlit: Vec4::new(1., kind, 0., 0.),
                alpha: AlphaMode::Blend,
                vat_texture: None,
                vat_meta: Vec4::ZERO,
                vat_lower: Vec4::ZERO,
                vat_span: Vec4::ZERO,
            }));
        }
        commands.insert_resource(InkArt {
            plane: meshes.add(Plane3d::default().mesh().size(2., 2.).subdivisions(16)),
            shadow: meshes.add(Plane3d::default().mesh().size(2., 2.)),
            paints,
            entities: HashMap::new(),
        });
        return;
    }
    let art = art.as_mut().expect("initialized above");
    let run = &sim.0;
    if run.expedition.is_some() {
        for (_, entity) in art.entities.drain() {
            commands.entity(entity).despawn();
        }
        return;
    }
    let elevated = run.journey.is_some();
    for handle in &art.paints {
        if let Some(mut paint) = materials.get_mut(handle) {
            paint.unlit.w = if elevated { 1. } else { 0. };
        }
    }
    let mut desired = HashMap::new();
    let mut add = |kind, id, material: usize, transform, progress| {
        desired.insert(InkKey(kind, id), (material, transform, tag(progress)));
    };
    let party = if let Some(j) = &run.journey {
        vec![(0, run.master), (1, run.hero), (2, j.dragon_pos)]
            .into_iter()
            .filter(|(i, _)| j.available(*i))
            .collect::<Vec<_>>()
    } else {
        vec![(0, run.master), (1, run.hero)]
    };
    for (i, p) in &party {
        add(
            0,
            u32::from(*i),
            4,
            ground(p.x, p.z, 0.85, 0.015, 0.).with_scale(Vec3::new(0.7, 1., 0.95)),
            0.,
        );
    }
    for e in &run.enemies {
        if e.hp <= 0. {
            continue;
        }
        // Keep contact detail around the party; hundreds of distant shadow
        // entities cost more CPU than the shared 3D crowd itself.
        if !e.boss && !crowd.detailed(e.id) {
            continue;
        }
        add(
            1,
            e.id,
            4,
            ground(e.pos.x, e.pos.z, if e.boss { 1.5 } else { 0.6 }, 0.01, 0.),
            0.,
        );
        if e.frozen > 0. && e.boss {
            add(
                2,
                e.id,
                5,
                ground(e.pos.x, e.pos.z, if e.boss { 1.7 } else { 0.85 }, 0.10, 0.),
                0.,
            );
        }
        if e.boss && e.windup > 0. && !run.journey.as_ref().is_some_and(|j| j.chapter == 3) {
            add(
                3,
                e.id,
                3,
                ground(e.strike.x, e.strike.z, 3.8, 0.055, 0.),
                1. - e.windup / 1.05,
            );
        }
    }
    if !matches!(run.phase, Phase::Menu) {
        let p = run.leader_point();
        let facing = run.journey.as_ref().map_or(run.facing, |j| match j.leader {
            0 => j.monk_facing,
            2 => j.dragon_facing,
            _ => run.facing,
        });
        add(4, 0, 5, ground(p.x, p.z, 1.25, 0.06, facing), 0.);
    }
    if let Some(j) = &run.journey {
        for zone in &j.zones {
            add(
                8,
                zone.id,
                3,
                ground(zone.pos.x, zone.pos.z, zone.radius, 0.06, 0.),
                1. - zone.delay / 1.05,
            );
        }
    }
    for (key, mut transform, mut clock, mut material) in &mut entities {
        if let Some((index, target, progress)) = desired.get(key) {
            *transform = *target;
            if clock.value != progress.value {
                clock.value = progress.value;
            }
            if material.0 != art.paints[*index] {
                material.0 = art.paints[*index].clone();
            }
        }
    }
    art.entities.retain(|key, entity| {
        if desired.contains_key(key) {
            true
        } else {
            commands.entity(*entity).despawn();
            false
        }
    });
    for (key, (index, transform, clock)) in desired {
        let mesh = if index == 4 {
            art.shadow.clone()
        } else {
            art.plane.clone()
        };
        let material = art.paints[index].clone();
        art.entities.entry(key).or_insert_with(|| {
            commands
                .spawn((
                    key,
                    Mesh3d(mesh),
                    MeshMaterial3d(material),
                    transform,
                    clock,
                ))
                .id()
        });
    }
}
