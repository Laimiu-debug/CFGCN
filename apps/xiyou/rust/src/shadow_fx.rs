//! Body-height brushwork and real contact sparks; friendly fields have no floor wash.
use super::*;
use bevy::mesh::VertexAttributeValues;
type Draw = (Handle<Mesh>, usize, Transform, f32);
const LIMIT: usize = 192;
// Original reusable silhouette meshes: crescent, lotus petal, wave crest,
// earth splinter, scripture ornament and nine-tooth rake wake. Shared once.
pub(super) fn emblem(kind: usize) -> Mesh {
    let mut points = vec![];
    let mut uv = vec![];
    let mut indices = vec![];
    let mut ribbon = |path: &dyn Fn(f32, f32) -> Vec3| {
        let base = points.len() as u32;
        for i in 0..=24 {
            let t = i as f32 / 24.;
            for side in [-1., 1.] {
                points.push(path(t, side).to_array());
                uv.push([t, (side + 1.) * 0.5]);
            }
            if i < 24 {
                let a = base + i * 2;
                indices.extend([a, a + 1, a + 2, a + 1, a + 3, a + 2]);
            }
        }
    };
    match kind {
        0 => ribbon(&|t, side| {
            let a = -1.35 + t * 2.7;
            let r = 1. + side * 0.14 * (t * std::f32::consts::PI).sin();
            Vec3::new(a.sin() * r, a.cos() * r, 0.)
        }),
        1 => ribbon(&|t, side| {
            Vec3::new(
                0.10 * (t * std::f32::consts::PI).sin()
                    + side * 0.26 * (t * std::f32::consts::PI).sin(),
                t,
                0.,
            )
        }),
        2 => ribbon(&|t, side| {
            Vec3::new(
                t * 2. - 1.,
                0.6 * (t * std::f32::consts::PI).sin()
                    + 0.12 * (t * 9.).sin()
                    + side * 0.12 * (t * std::f32::consts::PI).sin(),
                0.10 * (t * std::f32::consts::PI).sin(),
            )
        }),
        3 => ribbon(&|t, side| Vec3::new(side * 0.17 * (t * std::f32::consts::PI).sin(), t, 0.)),
        4 => {
            for row in 0..3 {
                let y = row as f32 * 0.28;
                ribbon(&|t, side| {
                    Vec3::new(
                        -0.35 + t * 0.7,
                        y + (t * std::f32::consts::TAU).sin() * 0.055 + side * 0.025,
                        0.,
                    )
                });
            }
            ribbon(&|t, side| Vec3::new(0.04 + side * 0.025, t * 0.85 - 0.12, 0.));
        }
        _ => {
            for tooth in 0..9 {
                let x = (tooth as f32 - 4.) * 0.18;
                ribbon(&|t, side| {
                    Vec3::new(
                        x + side * 0.028 * (t * std::f32::consts::PI).sin(),
                        t,
                        0.08 * (t * std::f32::consts::PI).sin(),
                    )
                });
            }
        }
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    );
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, points);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uv);
    mesh.insert_indices(Indices::U32(indices));
    mesh.compute_smooth_normals();
    mesh
}

pub(super) fn surface(kind: usize) -> Mesh {
    let mut mesh = spell_fx::surface(kind);
    if let Some(VertexAttributeValues::Float32x3(points)) =
        mesh.attribute_mut(Mesh::ATTRIBUTE_POSITION)
    {
        for pair in points.chunks_exact_mut(2) {
            let a = Vec3::from_array(pair[0]);
            let b = Vec3::from_array(pair[1]);
            let center = (a + b) * 0.5;
            pair[0] = (center + (a - center) * 2.2).to_array();
            pair[1] = (center + (b - center) * 2.2).to_array();
        }
    }
    mesh.compute_smooth_normals();
    mesh
}

fn elevated(p: Point, height: f32) -> Vec3 {
    at(p) + Vec3::Y * height
}
fn yaw(a: Point, b: Point) -> f32 {
    (b.x - a.x).atan2(b.z - a.z)
}
fn along(a: Vec3, b: Vec3, width: f32) -> Transform {
    let d = b - a;
    Transform::from_translation(a)
        .with_rotation(Quat::from_rotation_arc(Vec3::Z, d.normalize_or_zero()))
        .with_scale(Vec3::new(width, 1., d.length().max(0.02)))
}
fn color(owner: usize) -> usize {
    match owner {
        0 => 10,
        1 => 8,
        2 => 11,
        3 | 4 => 9,
        _ => 13,
    }
}
fn signature(
    s: &combat::Stroke,
    art: &TrialArt,
    view: Quat,
    add: &mut impl FnMut(&Handle<Mesh>, usize, Transform, f32),
) {
    let u = (1. - s.left / s.duration).clamp(0., 1.);
    let alpha = (1. - u).powf(0.7);
    let h = profiles()[s.owner.min(4)].height;
    let p = elevated(s.start, h * 0.55);
    let target = elevated(s.end, h * 0.52);
    let d = (target - p).normalize_or_zero();
    let local = view.inverse() * d;
    let angle = local.y.atan2(local.x) - std::f32::consts::FRAC_PI_2;
    if s.style == 10 {
        for j in 0..5 {
            let spread = (j as f32 - 2.) * 0.20;
            let q = p.lerp(target, (0.25 + u * 0.7).min(1.)) + view * Vec3::X * spread * (1. + u);
            add(
                &art.emblems[3],
                if j % 2 == 0 { 9 } else { 12 },
                Transform::from_translation(q)
                    .with_rotation(view * Quat::from_rotation_z(angle + spread))
                    .with_scale(Vec3::new(0.65, 0.85 + u * 0.4, 1.)),
                alpha,
            );
        }
        return;
    }
    match s.owner {
        0 => {
            let center = p.lerp(target, 0.25 + u * 0.35);
            for j in 0..5 {
                let turn = (j as f32 - 2.) * 0.55;
                let q = center + view * Vec3::new(turn.sin() * 0.25, -0.18, 0.);
                add(
                    &art.emblems[1],
                    10,
                    Transform::from_translation(q)
                        .with_rotation(view * Quat::from_rotation_z(turn * (0.5 + u)))
                        .with_scale(Vec3::splat(0.6 + u * 0.6)),
                    alpha * 0.9,
                );
            }
            for j in 0..3 {
                let theta = j as f32 * std::f32::consts::TAU / 3. + u * 0.7;
                let q = center
                    + view * Vec3::new(theta.sin() * (0.45 + u * 0.15), theta.cos() * 0.4, 0.06);
                add(
                    &art.emblems[4],
                    if j == 0 { 13 } else { 8 },
                    Transform::from_translation(q)
                        .with_rotation(view)
                        .with_scale(Vec3::splat(0.22)),
                    alpha * 0.75,
                );
            }
        }
        1 => {
            if s.style == 1 {
                add(
                    &art.brushes[3],
                    8,
                    along(p, p.lerp(target, (0.4 + u).min(1.)), 0.22),
                    alpha,
                );
                for side in [-1., 1.] {
                    let o = view * Vec3::X * side * 0.12;
                    add(
                        &art.brushes[3],
                        12,
                        along(p + o, p.lerp(target, 0.5 + u * 0.5) + o, 0.035),
                        alpha * 0.8,
                    );
                }
            } else {
                for j in 0..2 {
                    add(
                        &art.emblems[0],
                        if j == 0 { 8 } else { 12 },
                        Transform::from_translation(p + d * 0.4)
                            .with_rotation(
                                view * Quat::from_rotation_z(
                                    angle - 0.5 + u * 1.2 + j as f32 * 0.11,
                                ),
                            )
                            .with_scale(Vec3::splat(
                                (s.radius * 0.65).clamp(0.8, 1.8) * (1. + j as f32 * 0.05),
                            )),
                        alpha * if j == 0 { 0.95 } else { 0.55 },
                    );
                }
            }
            if s.style == 2 {
                let ground = elevated(s.end, 0.13);
                add(
                    &art.brushes[3],
                    8,
                    along(ground + Vec3::Y * 1.9, ground, 0.24),
                    alpha,
                );
                for j in 0..4 {
                    let a = j as f32 * 1.57;
                    let q = ground + view * Vec3::new(a.cos() * u * 0.7, u * (1. - u) * 1.5, 0.);
                    add(
                        &art.emblems[3],
                        11,
                        Transform::from_translation(q)
                            .with_rotation(view * Quat::from_rotation_z(a))
                            .with_scale(Vec3::splat(0.15)),
                        alpha,
                    );
                }
            }
        }
        2 => {
            let q = if s.style == 2 {
                elevated(s.end, 0.22 + 1.1 * (1. - u))
            } else {
                p.lerp(target, (0.2 + u * 0.75).min(1.))
            };
            add(
                &art.emblems[5],
                8,
                Transform::from_translation(q)
                    .with_rotation(view * Quat::from_rotation_z(angle))
                    .with_scale(Vec3::new(0.65, 1. + u * 0.8, 1.)),
                alpha,
            );
            for j in 0..5 {
                let x = (j as f32 - 2.) * 0.23;
                let q = elevated(s.end, 0.12)
                    + view
                        * Vec3::new(
                            x * (0.5 + u * 1.8),
                            u * (1. - u) * (1.5 + (j % 2) as f32),
                            0.,
                        );
                add(
                    &art.emblems[3],
                    11,
                    Transform::from_translation(q)
                        .with_rotation(view * Quat::from_rotation_z(x * 2. + u))
                        .with_scale(Vec3::new(0.7, 0.28 + (j % 2) as f32 * 0.15, 1.)),
                    alpha * 0.8,
                );
            }
        }
        3 => {
            for j in 0..3 {
                let delay = j as f32 * 0.11;
                let wave = (u - delay).max(0.);
                let q =
                    p.lerp(target, (0.2 + wave * 0.8).min(1.)) + Vec3::Y * (0.18 - j as f32 * 0.16);
                add(
                    &art.emblems[2],
                    if j == 1 { 12 } else { 9 },
                    Transform::from_translation(q)
                        .with_rotation(view * Quat::from_rotation_z(-0.15 + delay))
                        .with_scale(Vec3::new(0.8 + wave * 0.8, 0.75, 1.)),
                    alpha * if j == 1 { 0.65 } else { 0.9 },
                );
            }
            for j in 0..4 {
                let x = (j as f32 - 1.5) * 0.30;
                let q = target + view * Vec3::new(x * (0.4 + u), u * (1. - u) * 1.7, 0.);
                add(
                    &art.emblems[1],
                    9,
                    Transform::from_translation(q)
                        .with_rotation(view * Quat::from_rotation_z(x))
                        .with_scale(Vec3::splat(0.12)),
                    alpha * 0.8,
                );
            }
        }
        _ => {
            for j in 0..2 {
                let phase = (u - j as f32 * 0.12).max(0.);
                let q = p.lerp(target, 0.25 + phase * 0.65);
                add(
                    &art.emblems[0],
                    if j == 0 { 9 } else { 12 },
                    Transform::from_translation(q)
                        .with_rotation(
                            view * Quat::from_rotation_z(angle + if j == 0 { -0.65 } else { 0.65 }),
                        )
                        .with_scale(Vec3::splat(0.65 + phase * 0.8)),
                    alpha * if j == 0 { 0.95 } else { 0.75 },
                );
            }
        }
    }
}

fn ultimate(
    s: &combat::Stroke,
    art: &TrialArt,
    view: Quat,
    add: &mut impl FnMut(&Handle<Mesh>, usize, Transform, f32),
) {
    let u = (1. - s.left / s.duration).clamp(0., 1.);
    let alpha = (1. - u).powf(0.8);
    let direction = Vec3::new(s.end.x - s.start.x, 0., s.end.z - s.start.z).normalize_or_zero();
    let origin = elevated(s.start, 0.1);
    let right = Vec3::new(direction.z, 0., -direction.x);
    match s.owner {
        0 => {
            // One upright lotus opens around the caster at each real healing
            // pulse. Scripture ornaments spread to the actual rescue radius.
            let center = origin + Vec3::Y * 0.4;
            for j in 0..7 {
                let a = (j as f32 - 3.) * 0.34;
                add(
                    &art.emblems[1],
                    if j % 2 == 0 { 10 } else { 12 },
                    Transform::from_translation(center + view * Vec3::new(a.sin() * 0.6, 0., 0.))
                        .with_rotation(view * Quat::from_rotation_z(a * (0.75 + u)))
                        .with_scale(Vec3::new(1.6 + u, 2.3 + u * 0.4, 1.)),
                    alpha * 0.9,
                );
            }
            for j in 0..6 {
                let a = j as f32 * std::f32::consts::TAU / 6.;
                let radius = 1.4 + u * 3.2;
                add(
                    &art.emblems[4],
                    8,
                    Transform::from_translation(
                        center + Vec3::new(a.sin() * radius, 0.7 + u * 0.5, a.cos() * radius),
                    )
                    .with_rotation(view)
                    .with_scale(Vec3::splat(0.48)),
                    alpha,
                );
            }
        }
        1 => {
            let impact = origin + direction * 2.4;
            // A full staff silhouette descends; lifted shards spread away from
            // the impact. No camera shake or player translation is applied.
            add(
                &art.staff,
                7,
                Transform::from_translation(impact + Vec3::Y * (2.3 + (1. - u) * 1.5))
                    .with_rotation(view * Quat::from_rotation_z(-0.16 + u * 0.08))
                    .with_scale(Vec3::splat(2.7)),
                alpha,
            );
            for j in 0..9 {
                let a = j as f32 * std::f32::consts::TAU / 9.;
                let spread = Vec3::new(a.sin(), 0., a.cos());
                let q = impact
                    + spread * (0.5 + u * 2.2)
                    + Vec3::Y * (0.3 + (u * std::f32::consts::PI).sin() * 1.2);
                add(
                    &art.emblems[3],
                    if j % 2 == 0 { 11 } else { 8 },
                    Transform::from_translation(q)
                        .with_rotation(view * Quat::from_rotation_z(a + u))
                        .with_scale(Vec3::new(0.6, 0.7 + (j % 3) as f32 * 0.25, 1.)),
                    alpha,
                );
            }
            for side in [-1., 1.] {
                add(
                    &art.emblems[0],
                    8,
                    Transform::from_translation(impact + view * Vec3::X * side * u)
                        .with_rotation(view * Quat::from_rotation_z(side * 1.6))
                        .with_scale(Vec3::new(1.8 + u, 0.5, 1.)),
                    alpha * 0.8,
                );
            }
        }
        2 => {
            let q = origin + direction * (1.1 + u * (s.radius - 1.1));
            add(
                &art.emblems[5],
                8,
                Transform::from_translation(q + Vec3::Y * (0.5 + (1. - u) * 1.2))
                    .with_rotation(view)
                    .with_scale(Vec3::new(2.2, 1.7, 1.)),
                alpha,
            );
            for j in 0..9 {
                let side = (j as f32 - 4.) * 0.40;
                let h = 0.25 + (std::f32::consts::PI * u).sin() * (0.8 + (j % 3) as f32 * 0.18);
                add(
                    &art.emblems[3],
                    if j % 2 == 0 { 11 } else { 8 },
                    Transform::from_translation(q + right * side + Vec3::Y * h)
                        .with_rotation(view * Quat::from_rotation_z(side * 0.3))
                        .with_scale(Vec3::new(0.6, 0.8, 1.)),
                    alpha,
                );
            }
        }
        3 => {
            for j in 0..3 {
                let step = (0.22 + j as f32 * 0.19 + u * 0.35).min(1.);
                let q = origin.lerp(elevated(s.end, 0.1), step);
                add(
                    &art.emblems[2],
                    if j == 1 { 12 } else { 9 },
                    Transform::from_translation(q + Vec3::Y * (0.35 + u * 0.45))
                        .with_rotation(view)
                        .with_scale(Vec3::new(2.4 + u * 0.6, 1.8 - j as f32 * 0.2, 1.)),
                    alpha,
                );
                for side in [-1., 1.] {
                    add(
                        &art.emblems[1],
                        9,
                        Transform::from_translation(
                            q + right * side * (0.8 + u) + Vec3::Y * (1.3 + u),
                        )
                        .with_rotation(view * Quat::from_rotation_z(side * 0.45))
                        .with_scale(Vec3::new(0.23, 0.4, 1.)),
                        alpha * 0.8,
                    );
                }
            }
        }
        _ => {
            // The release mark is brief; the full dragon travels with the
            // colliding projectile below rather than remaining at the caster.
            add(
                &art.emblems[0],
                12,
                Transform::from_translation(origin + Vec3::Y * 1.2)
                    .with_rotation(view * Quat::from_rotation_z(u * 0.7))
                    .with_scale(Vec3::splat(0.8 + u)),
                alpha,
            );
        }
    }
}

pub(super) fn compose(t: &Trial, art: &TrialArt, view: Quat, tracks: &WeaponTracks) -> Vec<Draw> {
    let mut desired = Vec::with_capacity(LIMIT);
    let reduced = reduced_motion();
    let mut add = |mesh: &Handle<Mesh>, paint, transform, opacity: f32| {
        if desired.len() < LIMIT && opacity > 0.025 {
            desired.push((mesh.clone(), paint, transform, opacity));
        }
    };
    // Ordinary weapon strikes communicate with the weapon and a short red
    // wind-up. Only heavy attacks and real persistent hazards need a floor rim.
    // The rim disappears at contact, rather than surviving the whole recovery.
    for e in &t.enemies {
        let release = combat::attack_release(e.kind);
        if e.attack >= 0. && e.attack < release {
            let weight = (e.attack / release).clamp(0., 1.);
            if e.kind != 0 {
                add(
                    &art.ring,
                    4,
                    Transform::from_translation(at(e.target) + Vec3::Y * 0.025)
                        .with_scale(Vec3::splat(combat::danger_radius(e.kind))),
                    1.,
                );
            }
            add(
                &art.brushes[0],
                13,
                Transform::from_translation(elevated(e.pos, 0.95))
                    .with_rotation(Quat::from_rotation_y(e.facing.x.atan2(e.facing.z)))
                    .with_scale(Vec3::new(0.7, 0.8, 0.7)),
                0.2 + weight * 0.45,
            );
        }
    }
    for f in t.fields.iter().filter(|f| f.kind == 10) {
        add(
            &art.ring,
            4,
            Transform::from_translation(at(f.start) + Vec3::Y * 0.035)
                .with_scale(Vec3::splat(f.radius)),
            1.,
        );
        for i in 0..3 {
            let a = i as f32 * std::f32::consts::TAU / 3.;
            let p = f.start;
            add(
                &art.brushes[1],
                13,
                Transform::from_translation(
                    elevated(p, 0.12) + Vec3::new(a.sin(), 0., a.cos()) * f.radius * 0.5,
                )
                .with_rotation(Quat::from_rotation_y(a))
                .with_scale(Vec3::new(0.28, 0.4, 0.25)),
                0.7,
            );
        }
    }
    // Read the native GLB's evaluated weapon-tip socket. These trailing marks
    // follow the actual staff/rake/sword rather than an unrelated floor orbit.
    for (i, track) in tracks.0.iter().enumerate() {
        let points: Vec<_> = track.points.iter().copied().collect();
        for (j, pair) in points.windows(2).enumerate() {
            let alpha = (j + 1) as f32 / points.len() as f32;
            add(
                &art.brushes[3],
                color(i),
                along(pair[0], pair[1], 0.075 + alpha * 0.055),
                alpha * 0.8,
            );
        }
    }
    for (i, h) in t.heroes.iter().enumerate() {
        if let Some(cast) = &h.cast {
            let m = combat::catalog()[i][cast.skill]
                .motion
                .as_ref()
                .expect("motion");
            let windup = (cast.time / m.windup_end.max(0.01)).clamp(0., 1.);
            if cast.time < m.windup_end {
                let side = if h.facing.x < 0. { 1. } else { -1. };
                let p = at(h.pos)
                    + view
                        * Vec3::new(
                            side * profiles()[i].height * 0.20,
                            profiles()[i].height * 0.67,
                            0.05,
                        );
                add(
                    &art.emblems[if i == 0 {
                        1
                    } else if i == 2 {
                        5
                    } else {
                        0
                    }],
                    color(i),
                    Transform::from_translation(p)
                        .with_rotation(view * Quat::from_rotation_z(-0.5 + windup * 0.7))
                        .with_scale(Vec3::splat(0.12 + windup * 0.18)),
                    windup * 0.65,
                );
            }
        }
        if let Some(dodge) = &h.dodge {
            let u = dodge.time / 0.45;
            for j in 0..2 {
                let d = Vec3::new(dodge.direction.x, 0., dodge.direction.z);
                let p = at(h.pos) - d * (0.25 + j as f32 * 0.22) + Vec3::Y * 0.25;
                add(
                    &art.emblems[2],
                    11,
                    Transform::from_translation(p)
                        .with_rotation(view)
                        .with_scale(Vec3::new(0.22, 0.28, 0.3)),
                    (1. - u) * 0.4,
                );
            }
        }
    }
    // Projectiles have a visible leading form and tapering trail in real space.
    for b in &t.bolts {
        let pigment = color(b.owner);
        if b.kind == 7 {
            let local = view.inverse() * Vec3::new(b.direction.x, 0., b.direction.z);
            let angle = local.y.atan2(local.x);
            add(
                &art.dragon,
                14,
                Transform::from_translation(elevated(b.pos, 1.45))
                    .with_rotation(view * Quat::from_rotation_z(angle))
                    .with_scale(Vec3::splat(3.4)),
                (b.ttl / 0.2).clamp(0., 1.),
            );
            let tail = elevated(b.pos, 0.9) - Vec3::new(b.direction.x, 0., b.direction.z) * 2.3;
            add(
                &art.brushes[3],
                9,
                along(tail, elevated(b.pos, 1.2), 0.55),
                0.85,
            );
        } else if b.kind == 2 {
            let u = (b.age / 0.77).clamp(0., 1.);
            let blend = ((u - 0.45) / 0.5).clamp(0., 1.);
            let blend = blend * blend * (3. - 2. * blend);
            let height = profiles()[1].height
                * (0.74 + 0.2 * blend + 0.42 * (std::f32::consts::PI * u).sin().max(0.).powf(0.75));
            let angle = (1.4 - 1.05 * blend + std::f32::consts::TAU * u * u * (3. - 2. * u))
                * if t.heroes[b.owner].facing.x < 0. {
                    -1.
                } else {
                    1.
                };
            add(
                &art.staff,
                7,
                Transform::from_translation(at(b.pos) + view * Vec3::Y * height)
                    .with_rotation(view * Quat::from_rotation_z(angle)),
                1.,
            );
        } else {
            let y = if b.owner < 5 {
                profiles()[b.owner].height * 0.62
            } else {
                1.1
            };
            add(
                &art.brushes[if b.kind == 5 { 4 } else { 2 }],
                pigment,
                Transform::from_translation(elevated(b.pos, y))
                    .with_rotation(Quat::from_rotation_y(b.direction.x.atan2(b.direction.z)))
                    .with_scale(Vec3::new(1.1, 0.7, 1.6)),
                1.,
            );
            if b.owner >= 5 {
                add(
                    &art.orb,
                    4,
                    Transform::from_translation(elevated(b.pos, y)).with_scale(Vec3::splat(0.8)),
                    1.,
                );
            } else {
                let local = view.inverse() * Vec3::new(b.direction.x, 0., b.direction.z);
                let angle = local.y.atan2(local.x) - std::f32::consts::FRAC_PI_2;
                add(
                    &art.emblems[match b.owner {
                        0 => 4,
                        2 => 5,
                        3 => 2,
                        _ => 0,
                    }],
                    pigment,
                    Transform::from_translation(elevated(b.pos, y))
                        .with_rotation(view * Quat::from_rotation_z(angle))
                        .with_scale(Vec3::splat(if b.owner == 0 { 0.45 } else { 0.65 })),
                    1.,
                );
            }
        }
    }
    // Main skill strokes use the actual caster and event direction. A thrust
    // travels forward, a slam descends, lotus opens upright and water crests rise.
    for s in t
        .strokes
        .iter()
        .filter(|s| s.style >= 20)
        .chain(t.strokes.iter().filter(|s| s.style < 20))
        .filter(|s| !matches!(s.kind, 7 | 9))
    {
        if s.style >= 20 {
            ultimate(s, art, view, &mut add);
            continue;
        }
        let u = (1. - s.left / s.duration).clamp(0., 1.);
        let alpha = (1. - u).sqrt();
        let pigment = color(s.owner);
        let h = profiles()[s.owner.min(4)].height;
        let angle = yaw(s.start, s.end);
        let length = s.start.distance(s.end).clamp(0.8, 4.5);
        let rotation = Quat::from_rotation_y(angle);
        if matches!(s.style, 0..=3 | 9 | 10) && !matches!(s.kind, 4 | 5 | 8) {
            signature(s, art, view, &mut add);
            continue;
        }
        if s.kind == 4 || s.style == 4 {
            for i in 0..3 {
                let a = i as f32 * std::f32::consts::TAU / 3.;
                add(
                    &art.brushes[1],
                    10,
                    Transform::from_translation(elevated(s.end, 0.5 + u * 0.5))
                        .with_rotation(Quat::from_rotation_y(a))
                        .with_scale(Vec3::new(0.8, 1.3, 0.8)),
                    alpha,
                );
            }
        } else if matches!(s.style, 5 | 7) || matches!(s.kind, 5 | 8) {
            add(
                &art.brushes[3],
                pigment,
                along(elevated(s.start, h * 0.62), elevated(s.end, h * 0.66), 0.16),
                alpha * 0.9,
            );
            for i in 0..2 {
                add(
                    &art.brushes[1],
                    pigment,
                    Transform::from_translation(elevated(s.end, h * 0.48))
                        .with_rotation(Quat::from_rotation_y(i as f32 * std::f32::consts::PI))
                        .with_scale(Vec3::new(0.8, 1.4, 0.8)),
                    alpha,
                );
            }
        } else if s.style == 2 {
            let impact = elevated(s.end, 0.25);
            add(
                &art.brushes[3],
                pigment,
                along(impact + Vec3::Y * (1.8 - u), impact, 0.42),
                alpha,
            );
            for i in 0..3 {
                add(
                    &art.brushes[1],
                    pigment,
                    Transform::from_translation(impact)
                        .with_rotation(rotation * Quat::from_rotation_y((i as f32 - 1.) * 0.6))
                        .with_scale(Vec3::new(0.65, 1.2, 0.6 + u)),
                    alpha,
                );
            }
        } else if s.style == 6 {
            add(
                &art.brushes[4],
                pigment,
                Transform::from_translation(elevated(s.start, 0.65))
                    .with_rotation(rotation)
                    .with_scale(Vec3::new(0.9, 0.9, 0.6)),
                alpha,
            );
        } else if s.style == 3 {
            for i in 0..3 {
                let q = rotation * Quat::from_rotation_y((i as f32 - 1.) * 0.65);
                add(
                    &art.brushes[1],
                    10,
                    Transform::from_translation(elevated(s.start, h * 0.55))
                        .with_rotation(q)
                        .with_scale(Vec3::new(1., 1.3, 0.8 + length * u * 0.5)),
                    alpha,
                );
            }
        } else if matches!(s.style, 1 | 10) || s.kind == 2 {
            let end = elevated(s.start, h * 0.57)
                .lerp(elevated(s.end, h * 0.53), (0.35 + u * 0.7).min(1.));
            add(
                &art.brushes[3],
                pigment,
                along(
                    elevated(s.start, h * 0.57),
                    end,
                    if s.style == 10 { 0.42 } else { 0.22 },
                ),
                alpha,
            );
        } else {
            let wave = s.style == 9 || matches!(s.owner, 3 | 4);
            let radius = length * if wave { 0.55 } else { 0.75 };
            let turn = if reduced { 0. } else { -0.3 + u * 0.6 };
            add(
                &art.brushes[if wave { 4 } else { 0 }],
                pigment,
                Transform::from_translation(elevated(s.start, h * if wave { 0.2 } else { 0.57 }))
                    .with_rotation(
                        rotation * Quat::from_rotation_y(turn) * Quat::from_rotation_z(-0.18),
                    )
                    .with_scale(Vec3::new(radius, if wave { 0.9 } else { 1.8 }, radius)),
                alpha,
            );
        }
    }
    // Friendly persistent areas show a small standing source object. Their
    // mechanical radius remains unchanged; none receive a filled floor disc.
    for f in t.fields.iter().filter(|f| f.kind != 10) {
        let pigment = color(f.owner);
        let a = (f.id as f32 * 0.83).sin();
        if f.kind == 2 {
            add(
                &art.orb,
                6,
                Transform::from_translation(elevated(f.start, 0.8)),
                1.,
            );
            add(
                &art.brushes[3],
                8,
                along(elevated(f.start, 0.15), elevated(f.start, 0.7), 0.08),
                1.,
            );
        } else if f.kind == 8 {
            for i in 0..2 {
                let offset =
                    Vec3::new((a + i as f32).sin() * 0.55, 0., (a - i as f32).cos() * 0.55);
                add(
                    &art.brushes[3],
                    9,
                    along(
                        elevated(f.start, 1.6) + offset,
                        elevated(f.start, 0.85) + offset,
                        0.07,
                    ),
                    0.75,
                );
            }
        } else {
            add(
                &art.brushes[1],
                pigment,
                Transform::from_translation(elevated(f.start, 0.12))
                    .with_rotation(Quat::from_rotation_y(a))
                    .with_scale(Vec3::new(0.5, 0.7, 0.5)),
                0.75,
            );
        }
    }
    for (i, h) in t.heroes.iter().enumerate() {
        if h.shield > 0. || h.beads > 0 {
            if h.beads == 0 {
                let height = profiles()[i].height;
                for side in [-1., 1.] {
                    let a =
                        at(h.pos) + view * Vec3::new(side * height * 0.22, height * 0.36, -0.06);
                    let b =
                        at(h.pos) + view * Vec3::new(side * height * 0.20, height * 0.65, -0.06);
                    add(
                        &art.brushes[3],
                        if i == 4 { 9 } else { 10 },
                        along(a, b, 0.035),
                        0.8,
                    );
                }
                continue;
            }
            let count = h.beads.min(4);
            for j in 0..count {
                let a = if reduced { 0. } else { t.elapsed * 1.5 }
                    + j as f32 * std::f32::consts::TAU / count as f32;
                add(
                    &art.orb,
                    if i == 4 { 1 } else { 6 },
                    Transform::from_translation(
                        elevated(h.pos, profiles()[i].height * 0.55)
                            + Vec3::new(a.cos() * 0.48, a.sin() * 0.12, a.sin() * 0.48),
                    )
                    .with_scale(Vec3::splat(0.65)),
                    1.,
                );
            }
        }
    }
    // Contact sparks only exist after actual damage. Bound their count before
    // decorative details can compete with warnings or principal skill strokes.
    for s in t
        .strokes
        .iter()
        .rev()
        .filter(|s| matches!(s.kind, 7 | 9))
        .take(10)
    {
        let u = (1. - s.left / s.duration).clamp(0., 1.);
        for i in 0..2 {
            let transform = Transform::from_translation(elevated(s.start, 1.1))
                .with_rotation(
                    view * Quat::from_rotation_z(0.55 + i as f32 * 1.57)
                        * Quat::from_rotation_x(std::f32::consts::FRAC_PI_2),
                )
                .with_scale(Vec3::new(0.12, 1., 0.7 + u * 0.25));
            add(
                &art.brushes[3],
                if s.kind == 7 { 13 } else { 8 },
                transform,
                1. - u,
            );
        }
    }
    desired
}
