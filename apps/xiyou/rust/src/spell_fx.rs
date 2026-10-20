//! Bounded three-dimensional brush strokes. Ground circles only carry warnings.
//! These are VFX ribbon meshes, not replacement modeled characters or props.
use super::*;
use bevy::{
    asset::RenderAssetUsages,
    mesh::{Indices, MeshTag, PrimitiveTopology},
};
const MAX_STROKES: usize = 96;

#[derive(Component, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Stroke(u8, u32, u8);
#[derive(Resource)]
pub struct SpellArt {
    meshes: [Handle<Mesh>; 5],
    paints: [Handle<paint::PaintedMaterial>; 4],
    live: HashMap<Stroke, Entity>,
    spare: Vec<Entity>,
}
impl SpellArt {
    pub fn counts(&self) -> [usize; 2] {
        [self.live.len(), self.spare.len()]
    }
}
// Five reusable surfaces: staff sweep, petal, comet, silk and upright water.
// No per-frame mesh or material allocations.
pub(super) fn surface(kind: usize) -> Mesh {
    let mut positions = vec![];
    let mut uv = vec![];
    let mut indices = vec![];
    let sections = 20;
    for i in 0..=sections {
        let t = i as f32 / sections as f32;
        for side in [-1., 1.] {
            let p = match kind {
                0 | 4 => {
                    let angle = (t - 0.5) * 2.55;
                    let radius = 1.
                        + side
                            * (if kind == 4 { 0.16 } else { 0.085 })
                            * (t * std::f32::consts::PI).sin().max(0.04);
                    Vec3::new(
                        angle.sin() * radius,
                        (t * std::f32::consts::PI).sin() * 0.10
                            + if kind == 4 {
                                angle.cos() * radius * 1.35
                            } else {
                                0.
                            },
                        angle.cos() * radius * if kind == 4 { 0.25 } else { 1. },
                    )
                }
                1 => Vec3::new(
                    side * 0.30 * (t * std::f32::consts::PI).sin(),
                    t * t * 0.85,
                    t,
                ),
                2 => Vec3::new(
                    side * (1. - t).powf(0.55) * 0.15 + (t * 4.).sin() * t * 0.06,
                    t * 0.08,
                    -t,
                ),
                _ => Vec3::new(side * 0.5, (t * std::f32::consts::PI).sin() * 0.05, t),
            };
            positions.push(p.to_array());
            uv.push([t, (side + 1.) * 0.5]);
        }
        if i < sections {
            let a = (i * 2) as u32;
            indices.extend_from_slice(&[a, a + 1, a + 2, a + 1, a + 3, a + 2]);
        }
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    );
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uv);
    mesh.insert_indices(Indices::U32(indices));
    mesh.compute_smooth_normals();
    mesh
}
fn pose(run: &Run, p: cfgcn_game_core::Point, y: f32, yaw: f32, scale: Vec3) -> Transform {
    Transform::from_xyz(p.x, floor_at(run, p.x, p.z) + y, p.z)
        .with_rotation(Quat::from_rotation_y(yaw))
        .with_scale(scale)
}
fn between(a: Vec3, b: Vec3, width: f32) -> Transform {
    let d = b - a;
    Transform::from_translation(a)
        .with_rotation(Quat::from_rotation_arc(Vec3::Z, d.normalize_or_zero()))
        .with_scale(Vec3::new(width, 1., d.length().max(0.001)))
}
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn sync(
    mut commands: Commands,
    sim: Res<Simulation>,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<paint::PaintedMaterial>>,
    mut art: Option<ResMut<SpellArt>>,
    mut visuals: Query<(
        &mut Stroke,
        &mut Mesh3d,
        &mut MeshMaterial3d<paint::PaintedMaterial>,
        &mut Transform,
        &mut MeshTag,
        &mut Visibility,
    )>,
) {
    if sim.0.expedition.is_some() {
        if let Some(art) = art.as_mut() {
            for (_, entity) in art.live.drain() {
                commands.entity(entity).despawn();
            }
            for entity in art.spare.drain(..) {
                commands.entity(entity).despawn();
            }
        }
        return;
    }
    if art.is_none() {
        commands.insert_resource(SpellArt {
            meshes: std::array::from_fn(|i| meshes.add(surface(i))),
            paints: std::array::from_fn(|i| {
                let token = ["gold", "accent-shuihu", "gold", "vermilion"][i];
                materials.add(paint::PaintedMaterial {
                    tint: series_color(token).to_linear(),
                    mist: series_color("scene-mist").to_linear(),
                    unlit: Vec4::new(1., -1., 0., 0.),
                    texture: (i < 3)
                        .then(|| server.load(format!("fx/{}.png", ["staff", "tide", "lotus"][i]))),
                    alpha: AlphaMode::Blend,
                    vat_texture: None,
                    vat_meta: Vec4::ZERO,
                    vat_lower: Vec4::ZERO,
                    vat_span: Vec4::ZERO,
                })
            }),
            live: HashMap::new(),
            spare: vec![],
        });
        return;
    }
    let art = art.as_mut().expect("created above");
    let run = &sim.0;
    let mut desired: HashMap<Stroke, (usize, usize, Transform, MeshTag)> =
        HashMap::with_capacity(MAX_STROKES);
    if run.phase == Phase::Menu {
        // Compile the shared ribbon pipeline at the menu, before the first hit.
        desired.insert(
            Stroke(255, 0, 0),
            (
                0,
                0,
                pose(run, run.master, 1., 0., Vec3::splat(0.001)),
                MeshTag::new(0),
            ),
        );
    }
    let mut add = |key, shape, pigment, transform, opacity: f32| {
        if desired.len() < MAX_STROKES && opacity > 0.015 {
            let crest = shape == 0 && pigment == 1;
            let pigment = if shape == 1 && matches!(pigment, 0 | 2) {
                2
            } else {
                pigment
            };
            desired.insert(
                key,
                (
                    if crest { 4 } else { shape },
                    pigment,
                    transform,
                    MeshTag::new((opacity.clamp(0., 1.) * 65535.).round() as u32),
                ),
            );
        }
    };
    let reduced = reduced_motion();
    let party = if let Some(j) = &run.journey {
        [
            (0, run.master, j.monk_facing),
            (1, run.hero, run.facing),
            (2, j.dragon_pos, j.dragon_facing),
        ]
        .into_iter()
        .filter(|(i, _, _)| j.available(*i))
        .collect::<Vec<_>>()
    } else {
        vec![(1, run.hero, run.facing)]
    };
    if run.phase != Phase::Menu {
        for (member, p, facing) in &party {
            let attack = match member {
                0 => run.journey.as_ref().map_or(0., |j| j.monk_attack) / 0.55,
                1 => run.attack / 0.28,
                _ => run.journey.as_ref().map_or(0., |j| j.dragon_attack) / 0.55,
            };
            if attack > 0. {
                let t = 1. - attack.clamp(0., 1.);
                let weight = (t * std::f32::consts::PI).sin().max(0.15);
                if *member == 1 {
                    // A tilted waist-high crescent follows the staff's stroke.
                    let yaw = *facing + if reduced { 0. } else { -1.0 + t * 2.2 };
                    add(
                        Stroke(0, 1, 0),
                        0,
                        0,
                        pose(run, *p, 1.15, yaw, Vec3::new(2.2, 2., 2.2)).with_rotation(
                            Quat::from_rotation_y(yaw) * Quat::from_rotation_z(-0.22),
                        ),
                        weight * 0.85,
                    );
                } else {
                    let petals = if *member == 0 { 5 } else { 3 };
                    for i in 0..petals {
                        let yaw = *facing + (i as f32 - (petals - 1) as f32 * 0.5) * 0.65;
                        let scale = if reduced { 1.2 } else { 0.5 + t * 2.5 };
                        add(
                            Stroke(0, u32::from(*member), i),
                            if *member == 0 { 1 } else { 0 },
                            usize::from(*member == 2),
                            pose(
                                run,
                                *p,
                                if *member == 0 { 1.25 } else { 0.6 },
                                yaw,
                                Vec3::new(scale, 1., scale),
                            ),
                            (1. - t) * 0.7,
                        );
                    }
                }
            }
        }
    }
    if let Some(j) = &run.journey {
        // Ward: draped upright silk around the body, rather than a floor circle.
        for (member, p, facing) in &party {
            let (ward, full, pigment) = if *member == 0 {
                (j.shield, 3. + j.monk[1] as f32 * 0.4, 0)
            } else if *member == 2 {
                (j.dragon_guard, 3. + j.dragon[2] as f32 * 0.4, 1)
            } else {
                (0., 1., 0)
            };
            if ward > 0. {
                let strength = if full - ward < 0.65 { 0.65 } else { 0.25 };
                for i in 0..3 {
                    let yaw = *facing + i as f32 * std::f32::consts::TAU / 3.;
                    add(
                        Stroke(1, u32::from(*member), i),
                        1,
                        pigment,
                        pose(run, *p, 0.5, yaw, Vec3::new(1.2, 2.1, 1.3)),
                        strength,
                    );
                }
            }
        }
        // Healing: petals rise alongside each recipient, leaving their feet clear.
        let heal = j.secondary[0];
        if heal > 19.15 {
            let t = ((20. - heal) / 0.85).clamp(0., 1.);
            for (member, p, _) in &party {
                for i in 0..4 {
                    let angle =
                        i as f32 * std::f32::consts::FRAC_PI_2 + if reduced { 0. } else { t * 0.5 };
                    add(
                        Stroke(2, u32::from(*member), i),
                        1,
                        if i % 2 == 0 { 0 } else { 2 },
                        pose(
                            run,
                            *p,
                            0.45 + if reduced { 0. } else { t * 1.8 },
                            angle,
                            Vec3::new(0.7, 0.85, 1.1),
                        ),
                        (1. - t) * 0.85,
                    );
                }
            }
        }
        // Golden bindings visibly travel from the raised palm to affected enemies.
        if j.primary[1] > 12. - j.wukong[1] as f32 {
            let t = ((13. - j.wukong[1] as f32 - j.primary[1]) / 0.65).clamp(0., 1.);
            let start = Vec3::new(
                run.hero.x,
                floor_at(run, run.hero.x, run.hero.z) + 1.65,
                run.hero.z,
            );
            for i in 0..3 {
                add(
                    Stroke(10, 1, i),
                    2,
                    0,
                    Transform::from_translation(start)
                        .with_rotation(
                            Quat::from_rotation_y(run.facing + i as f32 * 2.1)
                                * Quat::from_rotation_x(-0.35),
                        )
                        .with_scale(Vec3::new(1., 1., 0.8)),
                    (1. - t) * 0.9,
                );
            }
            let mut targets = run
                .enemies
                .iter()
                .filter(|e| e.frozen > 0. && e.pos.distance(run.hero) < 7.)
                .collect::<Vec<_>>();
            targets.sort_by(|a, b| {
                a.pos
                    .distance(run.hero)
                    .total_cmp(&b.pos.distance(run.hero))
            });
            for e in targets.into_iter().take(if reduced { 3 } else { 6 }) {
                let end = Vec3::new(e.pos.x, floor_at(run, e.pos.x, e.pos.z) + 1.1, e.pos.z);
                add(
                    Stroke(3, e.id, 0),
                    3,
                    0,
                    between(start, start.lerp(end, (t * 5.).min(1.)), 0.09),
                    (1. - t) * 0.9,
                );
                add(
                    Stroke(3, e.id, 1),
                    0,
                    0,
                    pose(run, e.pos, 1., run.facing, Vec3::new(0.7, 1., 0.7))
                        .with_rotation(Quat::from_rotation_x(std::f32::consts::FRAC_PI_2)),
                    (1. - t) * 0.8,
                );
            }
        }
        if j.secondary[1] > 19.3 - j.wukong[2] as f32 {
            let t = ((20. - j.wukong[2] as f32 - j.secondary[1]) / 0.7).clamp(0., 1.);
            for (id, p) in run.clone_points().iter().enumerate() {
                for i in 0..3 {
                    add(
                        Stroke(4, id as u32, i),
                        1,
                        0,
                        pose(run, *p, 0.4 + t, i as f32 * 2.1, Vec3::splat(1.1)),
                        (1. - t) * 0.8,
                    );
                }
            }
        }
        if j.dash > 0. {
            let p = j.dragon_pos;
            for i in 0..3 {
                let yaw = j.dragon_facing + (i as f32 - 1.) * 0.22;
                add(
                    Stroke(5, 0, i),
                    2,
                    if i == 1 { 2 } else { 1 },
                    pose(run, p, 0.55, yaw, Vec3::new(1.8, 1.2, 4.)),
                    0.8,
                );
            }
        }
        if j.links.remaining > 0. {
            let duration = match j.links.active {
                2 => 1.3,
                4 => 0.9,
                _ => 0.7,
            };
            let t = (1. - j.links.remaining / duration).clamp(0., 1.);
            let center = Vec3::new(
                j.links.center.x,
                floor_at(run, j.links.center.x, j.links.center.z) + 1.1,
                j.links.center.z,
            );
            for (member, p, _) in &party {
                if (j.links.active == 1 && *member == 2)
                    || (j.links.active == 3 && *member == 0)
                    || (j.links.active == 4 && *member == 1)
                {
                    continue;
                }
                let start = Vec3::new(p.x, floor_at(run, p.x, p.z) + 1.35, p.z);
                for i in 0..3 {
                    let at = |u: f32| {
                        start.lerp(center, u) + Vec3::Y * (u * std::f32::consts::PI).sin() * 1.5
                    };
                    add(
                        Stroke(6, u32::from(*member), i),
                        3,
                        usize::from(*member == 2),
                        between(at(i as f32 / 3.), at((i + 1) as f32 / 3.), 0.12),
                        (1. - t) * 0.9,
                    );
                }
            }
            if j.links.windup <= 0. {
                for i in 0..6 {
                    add(
                        Stroke(7, 0, i),
                        if j.links.active == 3 { 0 } else { 1 },
                        usize::from(j.links.active >= 3),
                        Transform::from_translation(
                            center + Vec3::Y * if reduced { 0. } else { t * 0.8 },
                        )
                        .with_rotation(Quat::from_rotation_y(i as f32 * std::f32::consts::TAU / 6.))
                        .with_scale(Vec3::new(2.8, 2., 2.8)),
                        (1. - t) * 0.9,
                    );
                }
            }
        }
    }
    for bolt in &run.bolts {
        add(
            Stroke(8, bolt.id, 0),
            2,
            usize::from(bolt.water),
            pose(
                run,
                bolt.pos,
                0.9,
                bolt.velocity.x.atan2(bolt.velocity.z),
                Vec3::new(1.8, 1., if bolt.evolved { 3. } else { 1.7 }),
            ),
            0.95,
        );
    }
    for e in run
        .effects
        .iter()
        .filter(|e| e.kind == EffectKind::Tide)
        .take(4)
    {
        let t = 1. - e.remaining / e.duration;
        for i in 0..3 {
            let radius = if reduced {
                e.radius * 0.65
            } else {
                e.radius * (0.35 + t * 0.6)
            };
            add(
                Stroke(11, e.id, i),
                0,
                1,
                pose(
                    run,
                    e.pos,
                    0.45 + if reduced {
                        0.
                    } else {
                        (t * std::f32::consts::PI).sin() * 0.8
                    },
                    i as f32 * 2.1,
                    Vec3::new(radius, 2., radius),
                )
                .with_rotation(
                    Quat::from_rotation_y(i as f32 * 2.1) * Quat::from_rotation_x(-0.18),
                ),
                (1. - t) * 0.6,
            );
        }
    }
    // Small hit marks receive a strict decoration budget, regardless of mob count.
    let leader = run.leader_point();
    let mut hits = run
        .effects
        .iter()
        .filter(|e| matches!(e.kind, EffectKind::Hit | EffectKind::Flame))
        .collect::<Vec<_>>();
    hits.sort_by(|a, b| a.pos.distance(leader).total_cmp(&b.pos.distance(leader)));
    for e in hits.into_iter().take(if reduced { 4 } else { 8 }) {
        let t = 1. - e.remaining / e.duration;
        for i in 0..2 {
            add(
                Stroke(9, e.id, i),
                2,
                if e.kind == EffectKind::Flame { 3 } else { 2 },
                pose(
                    run,
                    e.pos,
                    0.9 + if reduced { 0. } else { t * 0.65 },
                    i as f32 * 2.6 + e.id as f32,
                    Vec3::new(1., 1., 0.45 + t * 0.9),
                )
                .with_rotation(
                    Quat::from_rotation_y(i as f32 * 2.6 + e.id as f32)
                        * Quat::from_rotation_x(0.7),
                ),
                (1. - t) * 0.85,
            );
        }
    }
    let SpellArt { live, spare, .. } = &mut **art;
    live.retain(|key, entity| {
        if desired.contains_key(key) {
            true
        } else {
            if let Ok((_, _, _, _, _, mut visible)) = visuals.get_mut(*entity) {
                *visible = Visibility::Hidden;
            }
            if spare.len() < MAX_STROKES {
                spare.push(*entity);
            } else {
                commands.entity(*entity).despawn();
            }
            false
        }
    });
    for (key, (shape, pigment, transform, tag)) in desired {
        let mesh = art.meshes[shape].clone();
        let paint = art.paints[pigment].clone();
        let entity = art.live.get(&key).copied().or_else(|| art.spare.pop());
        let entity = if let Some(entity) = entity {
            if let Ok((mut current, mut m, mut p, mut t, mut clock, mut visible)) =
                visuals.get_mut(entity)
            {
                *current = key;
                if m.0 != mesh {
                    m.0 = mesh;
                }
                if p.0 != paint {
                    p.0 = paint;
                }
                *t = transform;
                *clock = tag;
                *visible = Visibility::Inherited;
            }
            entity
        } else {
            commands
                .spawn((key, Mesh3d(mesh), MeshMaterial3d(paint), transform, tag))
                .id()
        };
        art.live.insert(key, entity);
    }
}
