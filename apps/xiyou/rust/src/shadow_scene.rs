//! Isolated five-person trial; shares the live terrain and native puppet files.
use super::*;
use bevy::{
    animation::AnimationTargetId,
    asset::RenderAssetUsages,
    mesh::{Indices, MeshTag, PrimitiveTopology},
};
#[path = "shadow_fx.rs"]
mod fx;
use cfgcn_game_core::{
    Point, map_surface_height,
    shadow_combat::{self as combat, Trial, TrialInput},
};
const EYE: Vec3 = Vec3::new(0., 14., -15.);
#[derive(Resource, Default)]
struct FrameStats {
    frames: std::collections::VecDeque<f32>,
    simulation_ms: f32,
    warmup: f32,
}
#[derive(serde::Serialize, Default)]
struct FrameReport {
    samples: usize,
    fps: f32,
    p95_ms: f32,
    max_ms: f32,
    over_50: usize,
    simulation_ms: f32,
    entities: usize,
    effects: usize,
    cells: usize,
}
impl FrameStats {
    fn report(&self) -> FrameReport {
        let mut values: Vec<_> = self.frames.iter().copied().collect();
        values.sort_by(f32::total_cmp);
        let n = values.len();
        FrameReport {
            samples: n,
            fps: if n > 0 {
                1000. * n as f32 / values.iter().sum::<f32>().max(0.001)
            } else {
                0.
            },
            p95_ms: values
                .get((n as f32 * 0.95) as usize)
                .copied()
                .unwrap_or(0.),
            max_ms: values.last().copied().unwrap_or(0.),
            over_50: values.iter().filter(|x| **x > 50.).count(),
            simulation_ms: self.simulation_ms,
            ..default()
        }
    }
}

#[derive(Resource)]
struct Battle(Trial);
impl Default for Battle {
    fn default() -> Self {
        let mut trial = Trial::default();
        trial.paused = true;
        Self(trial)
    }
}
#[derive(Resource)]
struct Loads(Vec<Handle<Gltf>>);
#[derive(serde::Deserialize)]
struct Profile {
    id: String,
    center: f32,
    walk_period: f32,
    walk_distance: f32,
    height: f32,
    weapon_size: [f32; 2],
    weapon_tip: [f32; 3],
}
fn profiles() -> &'static Vec<Profile> {
    static PROFILES: std::sync::OnceLock<Vec<Profile>> = std::sync::OnceLock::new();
    PROFILES.get_or_init(|| {
        serde_json::from_str(include_str!("../../art/shadow-actions-v6/runtime.json"))
            .expect("native runtime metadata")
    })
}
#[derive(Component, Clone, Copy)]
struct Puppet {
    key: u32,
    asset: usize,
}
#[derive(Component, Clone)]
struct Set {
    puppet: Puppet,
    graph: Handle<AnimationGraph>,
    nodes: HashMap<String, AnimationNodeIndex>,
}
#[derive(Component)]
struct Player {
    puppet: Puppet,
    graph: Handle<AnimationGraph>,
    nodes: HashMap<String, AnimationNodeIndex>,
    weights: HashMap<String, f32>,
    seeks: HashMap<String, f32>,
}
#[derive(Component)]
struct Weapon(u32);
#[derive(Resource)]
struct TrialArt {
    sets: Vec<(Handle<WorldAsset>, Set)>,
    population: HashMap<u32, Entity>,
    ring: Handle<Mesh>,
    orb: Handle<Mesh>,
    staff: Handle<Mesh>,
    dragon: Handle<Mesh>,
    brushes: [Handle<Mesh>; 5],
    emblems: [Handle<Mesh>; 6],
    paints: Vec<Handle<paint::PaintedMaterial>>,
    effect_pool: Vec<Entity>,
    active_effects: usize,
}
#[derive(Component)]
struct Effect;
#[derive(Default)]
struct WeaponTrack {
    token: u32,
    points: std::collections::VecDeque<Vec3>,
}
#[derive(Resource, Default)]
struct WeaponTracks([WeaponTrack; 5]);

pub fn run() {
    let mut simulation = Simulation::default();
    simulation.0.step(
        0.,
        Input {
            action: 11,
            ..default()
        },
    );
    App::new()
        .insert_resource(simulation)
        .init_resource::<Battle>()
        .init_resource::<FrameStats>()
        .init_resource::<WeaponTracks>()
        .insert_resource(ClearColor(series_color("paper")))
        .insert_resource(GlobalAmbientLight {
            color: series_color("paper"),
            brightness: 500.,
            ..default()
        })
        .add_plugins(
            DefaultPlugins
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "西游 · 五人皮影演武".into(),
                        canvas: Some("#xiyou-canvas".into()),
                        fit_canvas_to_parent: true,
                        prevent_default_event_handling: true,
                        focused: false,
                        ..default()
                    }),
                    ..default()
                })
                .set(AssetPlugin {
                    meta_check: AssetMetaCheck::Never,
                    ..default()
                }),
        )
        .add_plugins(MaterialPlugin::<paint::PaintedMaterial>::default())
        .init_resource::<paint::PaintCache>()
        .init_resource::<expedition_scene::MapAtlas>()
        .add_systems(Startup, start)
        .add_systems(
            Update,
            (step, expedition_scene::stream, load, sync, animate, publish).chain(),
        )
        .add_systems(Last, paint::convert)
        .add_systems(Last, sample_weapons)
        .add_systems(
            PostUpdate,
            detach_weapon
                .after(bevy::app::AnimationSystems)
                .before(bevy::transform::TransformSystems::Propagate),
        )
        .run();
}
fn start(mut commands: Commands, server: Res<AssetServer>) {
    commands.insert_resource(Loads(
        profiles()
            .iter()
            .map(|p| server.load(format!("shadow/{}.glb", p.id)))
            .collect(),
    ));
    commands.spawn((
        Camera3d::default(),
        bevy::core_pipeline::tonemapping::Tonemapping::Reinhard,
        Msaa::Off,
        FollowCamera::default(),
        Transform::from_translation(EYE).looking_at(Vec3::ZERO, Vec3::Y),
        DistanceFog {
            color: series_color("scene-mist"),
            falloff: FogFalloff::Linear {
                start: 32.,
                end: 110.,
            },
            ..default()
        },
    ));
    commands.spawn((
        DirectionalLight {
            illuminance: 8500.,
            color: series_color("paper-raised"),
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(-18., 30., -12.).looking_at(Vec3::ZERO, Vec3::Y),
    ));
}
#[allow(clippy::too_many_arguments)]
fn step(
    mut battle: ResMut<Battle>,
    mut sim: ResMut<Simulation>,
    time: Res<Time>,
    real: Res<Time<Real>>,
    mut stats: ResMut<FrameStats>,
    keys: Res<ButtonInput<KeyCode>>,
    art: Option<Res<TrialArt>>,
    atlas: Res<expedition_scene::MapAtlas>,
) {
    #[cfg(not(target_arch = "wasm32"))]
    let mut input = TrialInput::default();
    #[cfg(target_arch = "wasm32")]
    let mut input = serde_json::from_str::<TrialInput>(&browser_input()).unwrap_or_default();
    let axis = |positive, negative| {
        if keys.pressed(positive) {
            1.
        } else if keys.pressed(negative) {
            -1.
        } else {
            0.
        }
    };
    input.x = (input.x
        + axis(KeyCode::KeyD, KeyCode::KeyA)
        + axis(KeyCode::ArrowRight, KeyCode::ArrowLeft))
    .clamp(-1., 1.);
    input.z =
        (input.z + axis(KeyCode::KeyW, KeyCode::KeyS) + axis(KeyCode::ArrowUp, KeyCode::ArrowDown))
            .clamp(-1., 1.);
    let direction = combat::screen_direction(input.x, input.z);
    input.x = direction.x;
    input.z = direction.z;
    input.shadow_dodge |= keys.just_pressed(KeyCode::Space);
    for (slot, key) in [
        KeyCode::Digit1,
        KeyCode::Digit2,
        KeyCode::Digit3,
        KeyCode::Digit4,
    ]
    .iter()
    .enumerate()
    {
        if keys.just_pressed(*key) {
            input.shadow_cast = Some(slot);
        }
    }
    if keys.just_pressed(KeyCode::Escape) {
        input.action = if battle.0.paused { 3 } else { 2 };
    }
    if keys.just_pressed(KeyCode::KeyQ) {
        input.shadow_leader = Some((battle.0.leader + 1) % 5);
    }
    if art.is_some() && atlas.ready {
        stats.warmup += real.delta_secs();
    }
    let ready = art.is_some() && atlas.ready && stats.warmup > 0.8;
    let dt = if ready { time.delta_secs() } else { 0. };
    if ready && !battle.0.paused && dt > 0. {
        stats.frames.push_back(real.delta_secs() * 1000.);
        if stats.frames.len() > 600 {
            stats.frames.pop_front();
        }
    }
    let started = bevy::platform::time::Instant::now();
    battle.0.step(dt, input);
    stats.simulation_ms = started.elapsed().as_secs_f32() * 1000.;
    let p = battle.0.heroes[battle.0.leader].pos;
    sim.0.master = p;
    sim.0.hero = p;
    sim.0.elapsed = battle.0.elapsed;
}
fn ring() -> Mesh {
    let mut points = vec![];
    let mut uvs = vec![];
    let mut indices = vec![];
    for i in 0..=64 {
        let a = i as f32 * std::f32::consts::TAU / 64.;
        for r in [0.975, 1.] {
            points.push([a.cos() * r, 0., a.sin() * r]);
            uvs.push([a.cos() * 0.5 + 0.5, a.sin() * 0.5 + 0.5]);
        }
        if i < 64 {
            let j = i * 2;
            indices.extend([j, j + 1, j + 2, j + 1, j + 3, j + 2]);
        }
    }
    let normals = vec![[0., 1., 0.]; points.len()];
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, points)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_attribute(Mesh::ATTRIBUTE_UV_0, uvs)
    .with_inserted_indices(Indices::U32(indices))
}
#[allow(clippy::too_many_arguments)]
fn load(
    mut commands: Commands,
    loads: Res<Loads>,
    gltfs: Res<Assets<Gltf>>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<paint::PaintedMaterial>>,
    server: Res<AssetServer>,
    existing: Option<Res<TrialArt>>,
) {
    if existing.is_some() {
        return;
    }
    let Some(loaded) = loads
        .0
        .iter()
        .map(|h| gltfs.get(h))
        .collect::<Option<Vec<_>>>()
    else {
        return;
    };
    let mut sets = vec![];
    for (asset, gltf) in loaded.iter().enumerate() {
        let mut graph = AnimationGraph::new();
        let mut nodes = HashMap::new();
        for (name, clip) in &gltf.named_animations {
            let mask = if name.as_ref() == "WalkLower" {
                2
            } else if name.ends_with("_Upper") {
                1
            } else {
                0
            };
            let node = graph.add_clip_with_mask(clip.clone(), mask, 1., graph.root);
            nodes.insert(name.to_string(), node);
        }
        let idle = gltf
            .named_animations
            .get("Idle")
            .expect("native Idle")
            .clone();
        let node = graph.add_clip_with_mask(idle, 1, 1., graph.root);
        nodes.insert("__idle_upper".into(), node);
        sets.push((
            gltf.scenes[0].clone(),
            Set {
                puppet: Puppet { key: 0, asset },
                graph: graphs.add(graph),
                nodes,
            },
        ));
    }
    let mut paints = vec![];
    for (token, texture, kind, alpha) in [
        ("gold", Some("staff"), 2., 0.75),
        ("accent-shuihu", Some("tide"), 3., 0.75),
        ("gold", Some("lotus"), 1., 0.65),
        ("vermilion", Some("warning"), 4., 0.8),
        ("vermilion", None, 0., 1.),
        ("jade", None, 0., 0.9),
        ("gold", None, 0., 1.),
    ] {
        paints.push(materials.add(paint::PaintedMaterial {
            tint: series_color(token).with_alpha(alpha).to_linear(),
            texture: texture.map(|t| server.load(format!("fx/{t}.png"))),
            mist: series_color("paper").to_linear(),
            unlit: Vec4::new(1., kind, 0., 1.),
            alpha: AlphaMode::Blend,
            vat_texture: None,
            vat_meta: Vec4::ZERO,
            vat_lower: Vec4::ZERO,
            vat_span: Vec4::ZERO,
        }));
    }
    paints.push(materials.add(paint::PaintedMaterial {
        tint: Color::WHITE.to_linear(),
        texture: Some(server.load("shadow/wukong/weapon.png")),
        mist: series_color("paper").to_linear(),
        unlit: Vec4::new(1., 14., 0., 0.),
        alpha: AlphaMode::Mask(0.42),
        vat_texture: None,
        vat_meta: Vec4::ZERO,
        vat_lower: Vec4::ZERO,
        vat_span: Vec4::ZERO,
    }));
    for (token, texture) in [
        ("gold-ink", Some("staff")),
        ("accent-shuihu", Some("tide")),
        ("gold", Some("lotus")),
        ("ink", Some("staff")),
        ("paper", None),
        ("vermilion", None),
    ] {
        paints.push(materials.add(paint::PaintedMaterial {
            tint: series_color(token).to_linear(),
            texture: texture.map(|name| server.load(format!("fx/{name}.png"))),
            mist: series_color("paper").to_linear(),
            unlit: Vec4::new(1., -2., 0., 0.),
            alpha: AlphaMode::Blend,
            vat_texture: None,
            vat_meta: Vec4::ZERO,
            vat_lower: Vec4::ZERO,
            vat_span: Vec4::ZERO,
        }));
    }
    paints.push(materials.add(paint::PaintedMaterial {
        tint: Color::WHITE.to_linear(),
        texture: Some(server.load("fx/ultimate-dragon.png")),
        mist: series_color("paper").to_linear(),
        unlit: Vec4::new(1., 0., 0., 0.),
        alpha: AlphaMode::Blend,
        vat_texture: None,
        vat_meta: Vec4::ZERO,
        vat_lower: Vec4::ZERO,
        vat_span: Vec4::ZERO,
    }));
    commands.insert_resource(TrialArt {
        effect_pool: vec![],
        active_effects: 0,
        sets,
        population: HashMap::new(),
        ring: meshes.add(ring()),
        brushes: std::array::from_fn(|i| meshes.add(fx::surface(i))),
        emblems: std::array::from_fn(|i| meshes.add(fx::emblem(i))),
        orb: meshes.add(Sphere::new(0.16).mesh().ico(1).expect("orb mesh")),
        dragon: meshes.add(Rectangle::new(1., 1.)),
        staff: meshes.add(Rectangle::new(
            profiles()[1].weapon_size[0],
            profiles()[1].weapon_size[1],
        )),
        paints,
    });
}
fn attach(
    event: On<WorldInstanceReady>,
    mut commands: Commands,
    children: Query<&Children>,
    sets: Query<&Set>,
    targets: Query<(&AnimationTargetId, &Name)>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    players: Query<Entity, With<AnimationPlayer>>,
) {
    let Ok(set) = sets.get(event.entity) else {
        return;
    };
    let Some(mut graph) = graphs.get_mut(&set.graph) else {
        return;
    };
    for entity in children.iter_descendants(event.entity) {
        if let Ok((id, name)) = targets.get(entity) {
            let lower = name.as_str() == "pelvis"
                || ["thigh.", "shin.", "foot."]
                    .iter()
                    .any(|s| name.starts_with(s));
            graph.add_target_to_mask_group(*id, if lower { 0 } else { 1 });
            if name.as_str() == "weapon" && set.puppet.asset < 5 {
                commands.entity(entity).insert(Weapon(set.puppet.key));
            }
        }
        if players.contains(entity) {
            commands.entity(entity).insert((
                AnimationGraphHandle(set.graph.clone()),
                Player {
                    puppet: set.puppet,
                    graph: set.graph.clone(),
                    nodes: set.nodes.clone(),
                    weights: HashMap::new(),
                    seeks: HashMap::new(),
                },
            ));
        }
    }
}
fn at(p: Point) -> Vec3 {
    Vec3::new(p.x, map_surface_height(p.x, p.z) + 0.025, p.z)
}
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
fn sync(
    mut commands: Commands,
    battle: Res<Battle>,
    time: Res<Time>,
    tracks: Res<WeaponTracks>,
    art: Option<ResMut<TrialArt>>,
    mut roots: Query<&mut Transform, (With<Puppet>, Without<Camera3d>, Without<Effect>)>,
    mut cameras: Query<
        (&mut Transform, &mut FollowCamera),
        (With<Camera3d>, Without<Puppet>, Without<Effect>),
    >,
    mut effects: Query<
        (
            &mut Transform,
            &mut Mesh3d,
            &mut MeshMaterial3d<paint::PaintedMaterial>,
            &mut MeshTag,
            &mut Visibility,
        ),
        With<Effect>,
    >,
) {
    let Some(mut art) = art else {
        return;
    };
    let t = &battle.0;
    let rotation = Transform::from_translation(EYE)
        .looking_at(Vec3::ZERO, Vec3::Y)
        .rotation;
    let mut actors = vec![];
    for (i, h) in t.heroes.iter().enumerate() {
        if h.hp > 0. {
            actors.push((i as u32, i, h.pos, h.facing.x, 1.));
        }
    }
    for e in &t.enemies {
        actors.push((1000 + e.id, 5 + e.kind as usize, e.pos, e.facing.x, 0.9));
    }
    for e in &t.echoes {
        actors.push((20000 + e.id, 1, e.pos, 1., 0.8));
    }
    let live: Vec<_> = actors.iter().map(|a| a.0).collect();
    art.population.retain(|key, entity| {
        if live.contains(key) {
            true
        } else {
            commands.entity(*entity).despawn();
            false
        }
    });
    for (key, asset, p, facing, size) in actors {
        let transform = Transform::from_translation(at(p))
            .with_rotation(rotation)
            .with_scale(Vec3::new(
                if facing < 0. { size } else { -size },
                size,
                size,
            ));
        if let Some(entity) = art.population.get(&key) {
            if let Ok(mut root) = roots.get_mut(*entity) {
                *root = transform;
            }
        } else {
            let puppet = Puppet { key, asset };
            let parent = commands
                .spawn((puppet, transform, Visibility::Inherited))
                .id();
            let (scene, mut set) = art.sets[asset].clone();
            set.puppet = puppet;
            commands
                .spawn((
                    WorldAssetRoot(scene),
                    set,
                    Transform::from_xyz(-profiles()[asset].center, 0., 0.),
                ))
                .observe(attach)
                .insert(ChildOf(parent));
            art.population.insert(key, parent);
        }
    }
    let focus = at(t.heroes[t.leader].pos);
    for (mut camera, mut follow) in &mut cameras {
        let target = follow.focus.unwrap_or(focus).lerp(
            focus,
            if t.paused {
                0.
            } else {
                1. - (-12. * time.delta_secs()).exp()
            },
        );
        follow.focus = Some(target);
        camera.translation = target + EYE;
        camera.look_at(target, Vec3::Y);
    }
    if t.paused && t.elapsed > 0. && !art.effect_pool.is_empty() {
        return;
    }
    let mut desired = fx::compose(t, &art, rotation, &tracks);
    if t.elapsed == 0. {
        // Exercise blend and cutout pipelines during the ready pause. Tiny
        // transparent samples compile before the first visible skill release.
        for (mesh, paint) in [(&art.brushes[3], 8), (&art.staff, 7)] {
            desired.push((
                mesh.clone(),
                paint,
                Transform::from_translation(focus + Vec3::Y * 0.5).with_scale(Vec3::splat(0.0001)),
                0.,
            ));
        }
    }
    art.active_effects = desired.iter().filter(|d| d.3 > 0.025).count();
    for (index, (mesh, paint, transform, opacity)) in desired.iter().enumerate() {
        let material = art.paints[*paint].clone();
        if let Some(entity) = art.effect_pool.get(index) {
            if let Ok((mut target, mut target_mesh, mut target_material, mut tag, mut visible)) =
                effects.get_mut(*entity)
            {
                *target = *transform;
                target_mesh.0 = mesh.clone();
                target_material.0 = material;
                *tag = MeshTag::new((opacity.clamp(0., 1.) * 65535.) as u32);
                *visible = Visibility::Inherited;
            }
        } else {
            let entity = commands
                .spawn((
                    Effect,
                    Mesh3d(mesh.clone()),
                    MeshMaterial3d(material),
                    MeshTag::new((opacity.clamp(0., 1.) * 65535.) as u32),
                    *transform,
                    Visibility::Inherited,
                ))
                .id();
            art.effect_pool.push(entity);
        }
    }
    for entity in art.effect_pool.iter().skip(desired.len()) {
        if let Ok((_, _, _, _, mut visible)) = effects.get_mut(*entity) {
            *visible = Visibility::Hidden;
        }
    }
}
fn sample_weapons(
    battle: Res<Battle>,
    mut tracks: ResMut<WeaponTracks>,
    bones: Query<(&Weapon, &GlobalTransform)>,
) {
    if battle.0.paused {
        return;
    }
    for (i, h) in battle.0.heroes.iter().enumerate() {
        let active = h.cast.as_ref().filter(|cast| {
            let def = &combat::catalog()[i][cast.skill];
            let m = def.motion.as_ref().expect("motion");
            let weapon = def.clip.as_deref().is_some_and(|c| {
                c.contains("Staff")
                    || c.contains("Rake")
                    || c.contains("Spade")
                    || c.contains("Sword")
                    || c == "TwinCrescent"
            });
            weapon
                && def.clip.as_deref() != Some("ReturningStaff")
                && cast.time > m.windup_end - 0.12
                && cast.time < m.release_end + 0.06
        });
        let track = &mut tracks.0[i];
        if let Some(cast) = active {
            if cast.token != track.token {
                track.points.clear();
                track.token = cast.token;
            }
            if let Some((_, bone)) = bones.iter().find(|(weapon, _)| weapon.0 == i as u32) {
                let point = bone.transform_point(Vec3::from_array(profiles()[i].weapon_tip));
                if track
                    .points
                    .back()
                    .is_none_or(|p| p.distance(point) > 0.015)
                {
                    track.points.push_back(point);
                    if track.points.len() > 5 {
                        track.points.pop_front();
                    }
                }
            }
        } else {
            track.points.clear();
        }
    }
}
fn animate(
    battle: Res<Battle>,
    time: Res<Time>,
    mut players: Query<(&mut AnimationPlayer, &mut Player)>,
    sources: Res<Assets<AnimationClip>>,
    graphs: Res<Assets<AnimationGraph>>,
) {
    let t = &battle.0;
    if t.paused && t.elapsed > 0. {
        return;
    }
    for (mut player, mut anim) in &mut players {
        let p = anim.puppet;
        let profile = &profiles()[p.asset];
        let mut targets = HashMap::<String, f32>::new();
        let mut phase = t.elapsed;
        if p.key < 5 {
            let h = &t.heroes[p.key as usize];
            let moving = h.moving;
            if let Some(dodge) = &h.dodge {
                targets.insert("DodgeBack".into(), 1.);
                phase = dodge.time;
            } else if let Some(cast) = &h.cast {
                let def = &combat::catalog()[p.asset][cast.skill];
                let m = def.motion.as_ref().expect("motion");
                let clip = if moving {
                    m.upper_clip.clone().or_else(|| def.clip.clone())
                } else {
                    def.clip.clone()
                }
                .expect("clip");
                targets.insert(clip, 1.);
                phase = cast.time;
                if moving && m.upper_clip.is_some() {
                    targets.insert("WalkLower".into(), 1.);
                }
            } else if moving {
                targets.insert("__idle_upper".into(), 1.);
                targets.insert("WalkLower".into(), 1.);
            } else {
                targets.insert("Idle".into(), 1.);
            }
        } else if p.key < 20000 {
            let Some(e) = t.enemies.iter().find(|e| e.id + 1000 == p.key) else {
                continue;
            };
            if e.attack >= 0. {
                targets.insert(
                    ["SaberSlash", "AxeCleave", "BoneBolt"][e.kind as usize].into(),
                    1.,
                );
                phase = e.attack;
            } else {
                targets.insert("Walk".into(), 1.);
            }
        } else {
            targets.insert("StaffSweep".into(), 1.);
            phase = t.elapsed
                % combat::catalog()[1][0]
                    .motion
                    .as_ref()
                    .expect("staff")
                    .duration;
        }
        let nodes = anim.nodes.clone();
        for (name, node) in nodes {
            let desired = targets.get(&name).copied().unwrap_or(0.);
            let old = anim.weights.get(&name).copied().unwrap_or(0.);
            let weight =
                old + (desired - old).clamp(-time.delta_secs() / 0.09, time.delta_secs() / 0.09);
            anim.weights.insert(name.clone(), weight);
            if weight <= 0. {
                player.stop(node);
                continue;
            }
            let duration = graphs
                .get(&anim.graph)
                .and_then(|graph| graph.get(node))
                .and_then(|n| match &n.node_type {
                    bevy::animation::graph::AnimationNodeType::Clip(h) => {
                        sources.get(h).map(AnimationClip::duration)
                    }
                    _ => None,
                })
                .unwrap_or(1.);
            let seek = if matches!(name.as_str(), "Walk" | "WalkLower") {
                let distance = if p.key < 5 {
                    t.heroes[p.key as usize].gait
                } else {
                    t.enemies
                        .iter()
                        .find(|e| e.id + 1000 == p.key)
                        .map_or(t.elapsed, |e| e.gait)
                };
                (distance / profile.walk_distance.max(0.01)).fract() * profile.walk_period
            } else if matches!(name.as_str(), "Idle" | "__idle_upper") {
                if reduced_motion() {
                    0.
                } else {
                    t.elapsed % duration.max(0.01)
                }
            } else if desired > 0. {
                phase.min(duration - 0.0001)
            } else {
                // A fading previous strike retains its own pose. Seeking it
                // with the next strike's clock snapped elbows on every cast.
                anim.seeks.get(&name).copied().unwrap_or(0.)
            };
            anim.seeks.insert(name, seek);
            player
                .play(node)
                .repeat()
                .set_speed(0.)
                .set_weight(weight)
                .set_seek_time(seek.max(0.));
        }
    }
}
fn detach_weapon(battle: Res<Battle>, mut weapons: Query<(&Weapon, &mut Transform)>) {
    let t = &battle.0;
    for (weapon, mut transform) in &mut weapons {
        let detached = t
            .heroes
            .get(weapon.0 as usize)
            .and_then(|h| h.cast.as_ref())
            .is_some_and(|cast| {
                combat::catalog()[weapon.0 as usize][cast.skill]
                    .clip
                    .as_deref()
                    == Some("ReturningStaff")
                    && cast.time >= 0.595
                    && cast.time < 1.365
            });
        transform.scale = if detached { Vec3::ZERO } else { Vec3::ONE };
    }
}
fn publish(
    battle: Res<Battle>,
    art: Option<Res<TrialArt>>,
    atlas: Res<expedition_scene::MapAtlas>,
    time: Res<Time<Real>>,
    stats: Res<FrameStats>,
    mut last: Local<f32>,
) {
    if time.elapsed_secs() - *last < 0.08 {
        return;
    }
    *last = time.elapsed_secs();
    #[cfg(target_arch = "wasm32")]
    {
        #[derive(serde::Serialize)]
        struct State<'a> {
            trial: &'a Trial,
            ready: bool,
            performance: FrameReport,
        }
        let mut performance = stats.report();
        performance.entities = art.as_ref().map_or(0, |a| a.population.len());
        performance.effects = art.as_ref().map_or(0, |a| a.active_effects);
        performance.cells = atlas.count();
        if let Ok(value) = serde_json::to_string(&State {
            trial: &battle.0,
            ready: art.is_some() && atlas.ready && stats.warmup > 0.8,
            performance,
        }) {
            browser_shadow_state(&value);
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = (battle, art, atlas, stats);
}
