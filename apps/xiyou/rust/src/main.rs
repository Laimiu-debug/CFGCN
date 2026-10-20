use bevy::{
    asset::AssetMetaCheck, light::CascadeShadowConfigBuilder, prelude::*,
    world_serialization::WorldInstanceReady,
};
use cfgcn_game_core::{EffectKind, EnemyKind, Input, Phase, PickupKind, Run};
use std::collections::{HashMap, VecDeque};
#[cfg(feature = "crowd-benchmark")]
mod benchmark;
mod crowd;
mod expedition_scene;
mod ink_fx;
mod journey_scene;
mod motion;
mod paint;
mod palette;
mod river_scene;
mod shadow_scene;
mod spell_fx;
#[derive(Resource, Default)]
struct BaseLoads {
    roots: Vec<Handle<Gltf>>,
    map_only: bool,
    requested_at: f32,
}
fn request_base(
    mut pending: ResMut<BaseLoads>,
    sim: Res<Simulation>,
    server: Res<AssetServer>,
    time: Res<Time<Real>>,
) {
    let map_only = sim.0.expedition.is_some();
    if !pending.roots.is_empty() && (!pending.map_only || map_only) {
        return;
    }
    #[cfg(target_arch = "wasm32")]
    browser_mark("app");
    pending.map_only = map_only;
    pending.requested_at = time.elapsed_secs();
    pending.roots = if map_only {
        vec!["shadow_wukong.glb"]
    } else {
        vec!["wukong.glb", "monk.glb", "wolf.glb"]
    }
    .iter()
    .map(|f| server.load(*f))
    .collect();
}

fn series_color(name: &str) -> Color {
    let (_, [r, g, b, a]) = palette::COLORS
        .iter()
        .find(|(key, _)| *key == name)
        .expect("shared color token must exist");
    Color::srgba_u8(*r, *g, *b, *a)
}
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnReadInput)]
    fn browser_input() -> String;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnState)]
    fn browser_state(value: &str);
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnError)]
    fn browser_error(value: &str);
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnMark)]
    fn browser_mark(value: &str);
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnReducedMotion)]
    fn browser_reduced_motion() -> bool;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnMapSurvey)]
    fn browser_map_survey() -> bool;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnSkillTrial)]
    fn browser_skill_trial() -> bool;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnShadowState)]
    fn browser_shadow_state(value: &str);
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnReadChartRequest)]
    fn browser_chart_request() -> String;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnChart)]
    fn browser_chart(value: &str);
}
fn reduced_motion() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        browser_reduced_motion()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}
#[derive(Resource, Default)]
struct Simulation(Run);
#[derive(Resource, Default)]
struct Clock(f32);
#[derive(Resource, Default)]
struct Ready(bool);
#[derive(Resource, Default)]
struct FrameMetrics {
    samples: VecDeque<f32>,
}
#[cfg(target_arch = "wasm32")]
#[derive(serde::Serialize)]
struct ClientSnapshot {
    #[serde(flatten)]
    run: cfgcn_game_core::Snapshot,
    performance: PerformanceSnapshot,
}
#[cfg(target_arch = "wasm32")]
#[derive(serde::Serialize)]
struct PerformanceSnapshot {
    map_cells: usize,
    map_meshes: usize,
    map_built: usize,
    map_released: usize,
    map_peak: usize,
    benchmark: usize,
    crowd_instances: usize,
    crowd_pool: usize,
    skeletal_enemies: usize,
    spell_strokes: usize,
    spell_pool: usize,
    terrain_chunks: [bool; 2],
    stream_waiting: bool,
    mean_fps: f32,
    frame_p95_ms: f32,
    sampled_frames: usize,
    enemies: usize,
    clones: usize,
    party_members: usize,
}
#[derive(Component, Default)]
struct FollowCamera {
    focus: Option<Vec3>,
    elapsed: f32,
}
#[derive(Component)]
struct Actor {
    kind: u8,
    id: u32,
    moving: bool,
}
#[derive(Component)]
struct Clips {
    graph: Handle<AnimationGraph>,
    nodes: [AnimationNodeIndex; motion::CLIP_COUNT],
}
#[derive(Component)]
struct Animator {
    root: Entity,
    clip: usize,
    nodes: [AnimationNodeIndex; motion::CLIP_COUNT],
    link_sequence: u32,
    cooldowns: [f32; 2],
    cast_left: f32,
    cast_clip: usize,
    elapsed: f32,
    weights: [f32; motion::CLIP_COUNT],
    durations: [f32; 5],
    distance: f32,
    gait_phase: f32,
    locomotion: f32,
    position: Option<Vec3>,
}
#[derive(Component)]
struct OrbVisual(u32);
#[derive(Component, Clone, Copy, PartialEq, Eq, Hash)]
struct CombatVisual(u8, u32);
#[derive(Resource, Default)]
struct CombatPopulation(HashMap<CombatVisual, Entity>);
#[derive(Resource, Default)]
struct Population {
    enemies: HashMap<u32, Entity>,
    orbs: HashMap<u32, Entity>,
}
#[derive(Resource)]
struct Art {
    map_only: bool,
    scenes: Vec<Handle<bevy::world_serialization::WorldAsset>>,
    animations: Vec<(
        Handle<AnimationGraph>,
        [AnimationNodeIndex; motion::CLIP_COUNT],
    )>,
    orb: Handle<Mesh>,
    gold: Handle<StandardMaterial>,
    peach: Handle<StandardMaterial>,
    red: Handle<StandardMaterial>,
    bar: Handle<Mesh>,
}
fn main() {
    #[cfg(target_arch = "wasm32")]
    if browser_skill_trial() {
        shadow_scene::run();
        return;
    }
    let mut app = App::new();
    let mut simulation = Simulation::default();
    #[cfg(target_arch = "wasm32")]
    if browser_map_survey() {
        let mut input = serde_json::from_str::<Input>(&browser_input()).unwrap_or_default();
        input.action = 11;
        simulation.0.step(0., input);
    }
    app.insert_resource(ClearColor(series_color("scene-mist")))
        .insert_resource(GlobalAmbientLight {
            color: series_color("paper"),
            brightness: 500.,
            ..default()
        })
        .insert_resource(simulation)
        .init_resource::<BaseLoads>()
        .init_resource::<crowd::Crowd>()
        .init_resource::<Clock>()
        .init_resource::<Population>()
        .init_resource::<Ready>()
        .init_resource::<FrameMetrics>()
        .init_resource::<CombatPopulation>()
        .init_resource::<paint::PaintCache>()
        .add_plugins(
            DefaultPlugins
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "西游 · 西行初志".into(),
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
        .add_systems(Last, paint::convert)
        .init_resource::<river_scene::MapStreaming>()
        .init_resource::<expedition_scene::MapAtlas>()
        .add_systems(
            Update,
            (
                sample_frame,
                request_base,
                crowd::request,
                journey_scene::setup,
                setup,
                river_scene::load,
                expedition_scene::stream,
                check_assets,
                crowd::load,
                simulate,
                crowd::sync,
                sync_world,
                sync_combat,
                ink_fx::sync,
                spell_fx::sync,
                motion::animate,
                journey_scene::sync,
                river_scene::sync,
                publish,
            )
                .chain(),
        );
    #[cfg(feature = "crowd-benchmark")]
    app.init_resource::<benchmark::Benchmark>()
        .init_resource::<benchmark::MotionProbe>()
        .add_systems(Startup, benchmark::setup)
        .add_systems(Last, benchmark::motion);
    app.run();
}
#[allow(clippy::too_many_arguments)]
fn setup(
    mut commands: Commands,
    pending: Res<BaseLoads>,
    sim: Res<Simulation>,
    gltfs: Res<Assets<Gltf>>,
    existing: Option<Res<Art>>,
    actors: Query<Entity, With<Actor>>,
    mut environment_ready: Local<bool>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if existing
        .as_ref()
        .is_some_and(|art| !art.map_only || sim.0.expedition.is_some())
        || pending.roots.is_empty()
        || pending.map_only && sim.0.expedition.is_none()
    {
        return;
    }
    let Some(loaded) = pending
        .roots
        .iter()
        .map(|h| gltfs.get(h))
        .collect::<Option<Vec<_>>>()
    else {
        return;
    };
    let mut scenes = loaded
        .iter()
        .map(|g| g.scenes[0].clone())
        .collect::<Vec<_>>();
    #[cfg(target_arch = "wasm32")]
    browser_mark("character_roots");
    let mut animations = vec![];
    for gltf in &loaded {
        animations.push(motion::graph(gltf, &mut graphs));
    }
    if pending.map_only {
        // The map uses one flat Wukong sample at the survey traveller's slot.
        // Legacy battle rigs are still requested only on an explicit exit.
        scenes = vec![scenes[0].clone(); 3];
        animations = vec![animations[0].clone(); 3];
    }
    for entity in &actors {
        commands.entity(entity).despawn();
    }
    for kind in if pending.map_only {
        vec![1]
    } else {
        vec![0, 1]
    } {
        let (graph, nodes) = &animations[kind];
        commands
            .spawn((
                WorldAssetRoot(scenes[kind].clone()),
                Actor {
                    kind: kind as u8,
                    id: 0,
                    moving: false,
                },
                Clips {
                    graph: graph.clone(),
                    nodes: *nodes,
                },
                Transform::from_xyz(0., 0., if kind == 0 { 3. } else { 0. }),
            ))
            .observe(motion::attach);
    }
    for id in 0..if pending.map_only { 0 } else { 2 } {
        let (graph, nodes) = &animations[0];
        commands
            .spawn((
                WorldAssetRoot(scenes[0].clone()),
                Actor {
                    kind: 3,
                    id,
                    moving: true,
                },
                Clips {
                    graph: graph.clone(),
                    nodes: *nodes,
                },
                Transform::from_scale(Vec3::splat(0.85)),
                Visibility::Hidden,
            ))
            .observe(motion::attach);
    }
    if !*environment_ready {
        *environment_ready = true;
        commands.spawn((
            Camera3d::default(),
            bevy::core_pipeline::tonemapping::Tonemapping::Reinhard,
            Msaa::Off,
            FollowCamera::default(),
            Transform::from_xyz(0., 22., -21.).looking_at(Vec3::new(0., 0., 5.), Vec3::Y),
            DistanceFog {
                color: series_color("scene-mist"),
                falloff: FogFalloff::Linear {
                    start: 28.,
                    end: 105.,
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
            CascadeShadowConfigBuilder {
                num_cascades: 1,
                maximum_distance: 48.,
                ..default()
            }
            .build(),
        ));
    }
    let gold = materials.add(StandardMaterial {
        base_color: series_color("gold"),
        unlit: true,
        ..default()
    });
    let red = materials.add(StandardMaterial {
        base_color: series_color("vermilion"),
        unlit: true,
        ..default()
    });
    let orb = meshes.add(Sphere::new(0.16).mesh().ico(1).expect("valid icosphere"));
    let peach = materials.add(StandardMaterial {
        base_color: series_color("vermilion"),
        unlit: true,
        ..default()
    });
    let bar = meshes.add(Cuboid::new(1., 0.12, 0.12));
    commands.insert_resource(Art {
        map_only: pending.map_only,
        scenes,
        animations,
        orb,
        gold,
        peach,
        red,
        bar,
    });
}
#[allow(clippy::too_many_arguments)]
fn check_assets(
    server: Res<AssetServer>,
    pending: Res<BaseLoads>,
    art: Option<Res<Art>>,
    river: Option<Res<river_scene::RiverArt>>,
    sim: Res<Simulation>,
    time: Res<Time<Real>>,
    mut ready: ResMut<Ready>,
    maps: Res<river_scene::MapStreaming>,
    crowd: Res<crowd::Crowd>,
    atlas: Res<expedition_scene::MapAtlas>,
) {
    #[cfg(target_arch = "wasm32")]
    if pending.roots.iter().any(|root| {
        matches!(
            server.get_load_state(root.id()),
            Some(bevy::asset::LoadState::Failed(_))
        )
    }) || !pending.roots.is_empty()
        && time.elapsed_secs() - pending.requested_at > 60.
        && pending
            .roots
            .iter()
            .any(|root| !server.is_loaded_with_dependencies(root.id()))
    {
        browser_error("CHARACTER_ASSET_UNAVAILABLE");
    }
    if let Some(art) = art {
        #[cfg(target_arch = "wasm32")]
        if maps.failed(&server, time.elapsed_secs()) {
            browser_error("MAP_ASSET_UNAVAILABLE");
        }
        #[cfg(target_arch = "wasm32")]
        if sim.0.expedition.is_some() && atlas.failed(&server) {
            browser_error("MAP_SURVEY_ASSET_UNAVAILABLE");
        }
        ready.0 = (sim.0.expedition.is_some() || crowd.ready() && !art.map_only)
            && art
                .scenes
                .iter()
                .all(|scene| server.is_loaded_with_dependencies(scene.id()));
        let z = sim.0.leader_point().z;
        #[cfg(target_arch = "wasm32")]
        if sim.0.expedition.is_none()
            && (crowd.failed(&server) || crowd.timed_out(time.elapsed_secs()))
        {
            browser_error("CROWD_ASSET_UNAVAILABLE");
        }
        ready.0 &= if sim.0.expedition.is_some() {
            atlas.ready
        } else if sim.0.journey.as_ref().is_some_and(|j| j.world.is_some()) && z >= 58. {
            maps.loaded(1)
        } else {
            maps.loaded(0)
        };
        if sim.0.expedition.is_none()
            && sim
                .0
                .journey
                .as_ref()
                .is_some_and(|j| j.dragon_joined || z >= 58.)
        {
            ready.0 &= river.as_ref().is_some_and(|r| {
                r.scenes
                    .iter()
                    .all(|s| server.is_loaded_with_dependencies(s.id()))
            });
        }
        #[cfg(target_arch = "wasm32")]
        for scene in &art.scenes {
            if let Some(bevy::asset::LoadState::Failed(error)) = server.get_load_state(scene.id()) {
                browser_error(&format!("Asset load failed: {error}"));
            }
        }
        #[cfg(target_arch = "wasm32")]
        if let Some(river) = river.as_ref() {
            for scene in &river.scenes {
                if let Some(bevy::asset::LoadState::Failed(error)) =
                    server.get_load_state(scene.id())
                {
                    browser_error(&format!("River asset load failed: {error}"));
                }
            }
            if !ready.0 && time.elapsed_secs() - river.requested > 60. {
                browser_error("RIVER_ASSET_TIMEOUT");
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        let _ = &time;
    }
}
fn simulate(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    ready: Res<Ready>,
    mut sim: ResMut<Simulation>,
    maps: Res<river_scene::MapStreaming>,
    river: Option<Res<river_scene::RiverArt>>,
    #[cfg(feature = "crowd-benchmark")] benchmark: Res<benchmark::Benchmark>,
) {
    if !ready.0 {
        return;
    }
    #[cfg(feature = "crowd-benchmark")]
    if benchmark.0 > 0 {
        sim.0.step_crowd_benchmark(time.delta_secs(), benchmark.0);
        return;
    }
    #[cfg(target_arch = "wasm32")]
    let mut input = serde_json::from_str::<Input>(&browser_input()).unwrap_or_default();
    #[cfg(not(target_arch = "wasm32"))]
    let mut input = Input::default();
    input.x += (i32::from(keys.pressed(KeyCode::KeyD) || keys.pressed(KeyCode::ArrowRight))
        - i32::from(keys.pressed(KeyCode::KeyA) || keys.pressed(KeyCode::ArrowLeft)))
        as f32;
    // The camera looks along +Z, so screen-right points toward world -X.
    input.x = -input.x;
    input.z += (i32::from(keys.pressed(KeyCode::KeyW) || keys.pressed(KeyCode::ArrowUp))
        - i32::from(keys.pressed(KeyCode::KeyS) || keys.pressed(KeyCode::ArrowDown)))
        as f32;
    input.freeze |= keys.just_pressed(KeyCode::Space);
    input.clone |= keys.just_pressed(KeyCode::KeyE);
    if keys.just_pressed(KeyCode::KeyQ) {
        input.action = 7;
    }
    if keys.just_pressed(KeyCode::Escape) {
        input.action = if sim.0.phase == Phase::Paused { 3 } else { 2 };
    }
    if sim.0.phase == Phase::Upgrade {
        for (i, key) in [KeyCode::Digit1, KeyCode::Digit2, KeyCode::Digit3]
            .iter()
            .enumerate()
        {
            if keys.just_pressed(*key) {
                input.action = 4;
                input.choice = i as u8;
            }
        }
    }
    if sim.0.phase == Phase::Playing && sim.0.journey.is_some() {
        for (member, key) in [KeyCode::Digit1, KeyCode::Digit2, KeyCode::Digit3]
            .iter()
            .enumerate()
        {
            if keys.just_pressed(*key) {
                input.action = 10;
                input.member = member as u8;
            }
        }
    }
    if sim.0.journey.as_ref().is_some_and(|j| j.world.is_some()) {
        let z = sim.0.leader_point().z;
        let waiting = z > 55. && z < 58. && input.z > 0. && (!maps.loaded(1) || river.is_none())
            || (58. ..61.).contains(&z) && input.z < 0. && !maps.loaded(0);
        if waiting {
            // An explicit road-loading hold freezes combat as well. Never
            // silently pin one movement axis while enemies keep attacking.
            if input.action == 2 {
                sim.0.step(
                    0.,
                    Input {
                        action: 2,
                        ..default()
                    },
                );
            }
            return;
        }
    }
    sim.0.step(time.delta_secs(), input);
}
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
fn sync_world(
    mut commands: Commands,
    time: Res<Time>,
    sim: Res<Simulation>,
    art: Option<Res<Art>>,
    river: Option<Res<river_scene::RiverArt>>,
    mut pop: ResMut<Population>,
    crowd: Res<crowd::Crowd>,
    mut actors: Query<(&mut Actor, &mut Transform, &mut Visibility), Without<FollowCamera>>,
    mut cameras: Query<(&mut Transform, &mut FollowCamera), (Without<Actor>, Without<OrbVisual>)>,
    mut orbs: Query<(&OrbVisual, &mut Transform), (Without<Actor>, Without<FollowCamera>)>,
) {
    let Some(art) = art else {
        return;
    };
    let run = &sim.0;
    for (mut actor, mut t, mut v) in &mut actors {
        let old = t.translation;
        let old_rotation = t.rotation;
        match actor.kind {
            0 => {
                let captive = run
                    .journey
                    .as_ref()
                    .is_some_and(|j| j.chapter == 2 && !j.joined);
                *v = if run.wukong_active() || captive {
                    Visibility::Inherited
                } else {
                    Visibility::Hidden
                };
                let pos = if captive {
                    cfgcn_game_core::Journey::SEAL
                } else {
                    run.hero
                };
                t.translation = Vec3::new(pos.x, floor_at(run, pos.x, pos.z), pos.z);
                t.rotation = Quat::from_rotation_y(run.facing);
            }
            1 => {
                t.translation = Vec3::new(
                    run.master.x,
                    floor_at(run, run.master.x, run.master.z),
                    run.master.z,
                );
                if let Some(journey) = &run.journey {
                    t.rotation = Quat::from_rotation_y(journey.monk_facing);
                }
            }
            2 => {
                if let Some(enemy) = run.enemies.iter().find(|e| e.id == actor.id) {
                    let target = Vec3::new(
                        enemy.pos.x,
                        floor_at(run, enemy.pos.x, enemy.pos.z),
                        enemy.pos.z,
                    );
                    let d = target - t.translation;
                    if d.length_squared() > 0.00001 {
                        t.rotation = Quat::from_rotation_y(d.x.atan2(d.z));
                    }
                    t.translation = target;
                    let size = match enemy.kind {
                        EnemyKind::Wolf => Vec3::splat(0.85),
                        EnemyKind::Swift => Vec3::new(0.6, 0.7, 0.9),
                        EnemyKind::Brute => Vec3::splat(1.25),
                        EnemyKind::Boss => Vec3::splat(if enemy.region == 2 { 1.3 } else { 1.85 }),
                    };
                    t.scale = if enemy.hit > 0. && !reduced_motion() {
                        size * Vec3::new(1.08, 0.9, 1.08)
                    } else {
                        size
                    };
                }
            }
            3 => {
                *v = if run.clone_time > 0. {
                    Visibility::Inherited
                } else {
                    Visibility::Hidden
                };
                let p = run.clone_points()[actor.id as usize];
                t.translation = Vec3::new(p.x, floor_at(run, p.x, p.z) + 0.03, p.z);
                t.rotation = Quat::from_rotation_y(run.facing);
            }
            4 => {
                if let Some(j) = &run.journey {
                    *v = if j.dragon_joined {
                        Visibility::Inherited
                    } else {
                        Visibility::Hidden
                    };
                    t.translation = Vec3::new(
                        j.dragon_pos.x,
                        floor_at(run, j.dragon_pos.x, j.dragon_pos.z),
                        j.dragon_pos.z,
                    );
                    t.rotation = Quat::from_rotation_y(j.dragon_facing);
                } else {
                    *v = Visibility::Hidden;
                }
            }
            5 => {
                if let Some(j) = &run.journey {
                    let waiting = j.chapter == 3 && j.dragon_defeated && !j.dragon_joined;
                    let spirit = j.dragon_joined && j.dragon_guard > 1.5 && !reduced_motion();
                    *v = if waiting || spirit {
                        Visibility::Inherited
                    } else {
                        Visibility::Hidden
                    };
                    let p = if waiting {
                        j.seal_point()
                    } else {
                        j.dragon_pos
                    };
                    t.translation = Vec3::new(
                        p.x,
                        floor_at(run, p.x, p.z) + if spirit { 1.2 } else { 0. },
                        p.z,
                    );
                    t.scale = Vec3::splat(if spirit { 0.6 } else { 0.9 });
                    t.rotation = Quat::from_rotation_y(j.dragon_facing);
                } else {
                    *v = Visibility::Hidden;
                }
            }
            _ => {}
        }
        let travel = (t.translation - old).xz();
        actor.moving = travel.length_squared() > 0.0000001;
        if actor.moving && [0, 1, 3, 4].contains(&actor.kind) {
            // Auto attacks may aim at a nearby enemy for one simulation tick.
            // Feet must still face their actual travel, rather than flicking
            // sideways / moonwalking every time Wukong strikes while running.
            t.rotation = Quat::from_rotation_y(travel.x.atan2(travel.y));
        }
        if run.phase != Phase::Playing {
            t.rotation = old_rotation;
        } else if [0, 1, 3, 4].contains(&actor.kind) && t.translation.distance_squared(old) < 4. {
            let desired_rotation = t.rotation;
            t.rotation =
                old_rotation.slerp(desired_rotation, 1. - (-12. * time.delta_secs()).exp());
        }
        if art.map_only && actor.kind == 1 {
            // A paper actor keeps its drawing plane parallel to the camera.
            // World travel and facing are independent: walking up/down must
            // never rotate the silhouette into an invisible edge. Tiny X
            // noise, pauses and long map teleports retain the last facing.
            if run.phase == Phase::Playing
                && travel.x.abs() > 0.0005
                && travel.length_squared() < 1.
            {
                t.scale.x = if travel.x < 0. { 1. } else { -1. };
            }
            t.rotation = Transform::from_xyz(0., 22., -24.)
                .looking_at(Vec3::ZERO, Vec3::Y)
                .rotation;
        }
    }
    for e in &run.enemies {
        if !e.boss && crowd.ready() {
            continue;
        }
        pop.enemies.entry(e.id).or_insert_with(|| {
            let river_enemy = e.region == 2;
            let (scene, (graph, nodes)) = if river_enemy {
                if let Some(river) = river.as_ref() {
                    let i = if e.boss { 1 } else { 2 };
                    (&river.scenes[i], &river.animations[i])
                } else {
                    (&art.scenes[2], &art.animations[2])
                }
            } else {
                (&art.scenes[2], &art.animations[2])
            };
            commands
                .spawn((
                    WorldAssetRoot(scene.clone()),
                    Actor {
                        kind: 2,
                        id: e.id,
                        moving: true,
                    },
                    Clips {
                        graph: graph.clone(),
                        nodes: *nodes,
                    },
                    Transform::from_xyz(e.pos.x, floor_at(run, e.pos.x, e.pos.z), e.pos.z)
                        .with_scale(Vec3::splat(if e.boss { 1.85 } else { 0.85 })),
                ))
                .observe(motion::attach)
                .id()
        });
    }
    pop.enemies.retain(|id, entity| {
        if run
            .enemies
            .iter()
            .any(|e| e.id == *id && (e.boss || !crowd.ready()))
        {
            true
        } else {
            commands.entity(*entity).despawn();
            false
        }
    });
    for o in &run.orbs {
        pop.orbs.entry(o.id).or_insert_with(|| {
            commands
                .spawn((
                    Mesh3d(art.orb.clone()),
                    MeshMaterial3d(if o.kind == PickupKind::Peach {
                        art.peach.clone()
                    } else {
                        art.gold.clone()
                    }),
                    Transform::from_xyz(o.pos.x, floor_at(run, o.pos.x, o.pos.z) + 0.35, o.pos.z),
                    OrbVisual(o.id),
                ))
                .id()
        });
    }
    pop.orbs.retain(|id, entity| {
        if run.orbs.iter().any(|o| o.id == *id) {
            true
        } else {
            commands.entity(*entity).despawn();
            false
        }
    });
    for (o, mut t) in &mut orbs {
        if let Some(orb) = run.orbs.iter().find(|orb| orb.id == o.0) {
            t.translation.x = orb.pos.x;
            t.translation.z = orb.pos.z;
            t.scale = Vec3::splat(if orb.kind == PickupKind::Peach {
                1.8
            } else if orb.value > 1 {
                1.4
            } else {
                1.
            });
        }
        t.translation.y = floor_at(run, t.translation.x, t.translation.z)
            + 0.32
            + if reduced_motion() {
                0.
            } else {
                (run.elapsed * 3. + o.0 as f32).sin() * 0.08
            };
    }
    for (mut t, mut follow) in &mut cameras {
        let lead = run.leader_point();
        let target = Vec3::new(lead.x, floor_at(run, lead.x, lead.z), lead.z + 3.);
        let reset = follow.focus.is_none() || run.elapsed < follow.elapsed;
        let previous = follow.focus.unwrap_or(target);
        let focus = if reset || previous.distance_squared(target) > 625. {
            target
        } else if run.phase == Phase::Playing {
            previous.lerp(target, 1. - (-5. * time.delta_secs()).exp())
        } else {
            previous
        };
        follow.focus = Some(focus);
        follow.elapsed = run.elapsed;
        // Both position and aim follow the same point. A raw look-at target
        // combined with a delayed position produced a pitch wobble on slopes.
        t.translation = focus + Vec3::new(0., 22., -24.);
        t.look_at(focus, Vec3::Y);
    }
}
fn floor_at(run: &Run, x: f32, z: f32) -> f32 {
    if run.expedition.is_some() {
        cfgcn_game_core::map_surface_height(x, z)
    } else if run.journey.is_some() {
        cfgcn_game_core::terrain_height(x, z)
    } else {
        0.
    }
}
// Physical pickups, projectiles and health bars share their meshes/materials.
// Painted spells and warnings are owned by ink_fx; no generic torus substitute.
fn sync_combat(
    mut commands: Commands,
    sim: Res<Simulation>,
    art: Option<Res<Art>>,
    crowd: Res<crowd::Crowd>,
    mut pop: ResMut<CombatPopulation>,
    mut visuals: Query<(&CombatVisual, &mut Transform)>,
) {
    let Some(art) = art else {
        return;
    };
    let run = &sim.0;
    let mut desired = HashMap::new();
    for (i, p) in run.orbit_points().iter().enumerate() {
        desired.insert(
            CombatVisual(1, i as u32),
            (
                art.orb.clone(),
                art.gold.clone(),
                Transform::from_xyz(p.x, floor_at(run, p.x, p.z) + 0.85, p.z)
                    .with_scale(Vec3::splat(1.4)),
            ),
        );
    }
    for enemy in &run.enemies {
        if matches!(enemy.kind, EnemyKind::Brute | EnemyKind::Boss)
            && (enemy.boss || crowd.detailed(enemy.id))
        {
            let width = if enemy.boss { 2.5 } else { 1.6 };
            desired.insert(
                CombatVisual(4, enemy.id),
                (
                    art.bar.clone(),
                    art.red.clone(),
                    Transform::from_xyz(
                        enemy.pos.x,
                        floor_at(run, enemy.pos.x, enemy.pos.z)
                            + if enemy.boss { 3.8 } else { 2.6 },
                        enemy.pos.z,
                    )
                    .with_scale(Vec3::new(
                        width * (enemy.hp / enemy.max_hp).clamp(0., 1.),
                        1.,
                        1.,
                    )),
                ),
            );
        }
    }
    for (key, mut transform) in &mut visuals {
        if let Some((_, _, target)) = desired.get(key) {
            *transform = *target;
        }
    }
    pop.0.retain(|key, entity| {
        if desired.contains_key(key) {
            true
        } else {
            commands.entity(*entity).despawn();
            false
        }
    });
    for (key, (mesh, material, transform)) in desired {
        pop.0.entry(key).or_insert_with(|| {
            commands
                .spawn((key, Mesh3d(mesh), MeshMaterial3d(material), transform))
                .id()
        });
    }
}
fn sample_frame(time: Res<Time<Real>>, mut metrics: ResMut<FrameMetrics>) {
    let seconds = time.delta_secs();
    #[cfg(all(feature = "crowd-benchmark", target_arch = "wasm32"))]
    benchmark::frame(seconds);
    if seconds.is_finite() && seconds > 0. {
        metrics.samples.push_back(seconds);
        if metrics.samples.len() > 120 {
            metrics.samples.pop_front();
        }
    }
}
#[allow(clippy::too_many_arguments)]
fn publish(
    time: Res<Time>,
    sim: Res<Simulation>,
    ready: Res<Ready>,
    metrics: Res<FrameMetrics>,
    mut clock: ResMut<Clock>,
    maps: Res<river_scene::MapStreaming>,
    river: Option<Res<river_scene::RiverArt>>,
    crowd: Res<crowd::Crowd>,
    pop: Res<Population>,
    spells: Option<Res<spell_fx::SpellArt>>,
    atlas: Res<expedition_scene::MapAtlas>,
    #[cfg(feature = "crowd-benchmark")] benchmark: Res<benchmark::Benchmark>,
) {
    clock.0 += time.delta_secs();
    if clock.0 < 0.1 {
        return;
    }
    clock.0 = 0.;
    #[cfg(target_arch = "wasm32")]
    {
        let mut frames = metrics.samples.iter().copied().collect::<Vec<_>>();
        frames.sort_by(f32::total_cmp);
        let sum = frames.iter().sum::<f32>();
        let performance = PerformanceSnapshot {
            map_cells: atlas.count(),
            map_meshes: atlas.mesh_count(),
            map_built: atlas.built,
            map_released: atlas.released,
            map_peak: atlas.peak,
            crowd_instances: crowd.counts()[0],
            crowd_pool: crowd.counts()[1],
            skeletal_enemies: pop.enemies.len(),
            spell_strokes: spells.as_ref().map_or(0, |s| s.counts()[0]),
            spell_pool: spells.as_ref().map_or(0, |s| s.counts()[1]),
            #[cfg(feature = "crowd-benchmark")]
            benchmark: benchmark.0,
            #[cfg(not(feature = "crowd-benchmark"))]
            benchmark: 0,
            terrain_chunks: [maps.loaded(0), maps.loaded(1)],
            stream_waiting: sim.0.journey.as_ref().is_some_and(|j| j.world.is_some()) && {
                let z = sim.0.leader_point().z;
                ((55. ..58.).contains(&z) && (!maps.loaded(1) || river.is_none()))
                    || ((58. ..61.).contains(&z) && !maps.loaded(0))
            },
            mean_fps: if sum > 0. {
                frames.len() as f32 / sum
            } else {
                0.
            },
            frame_p95_ms: frames
                .get(frames.len().saturating_sub(1) * 95 / 100)
                .copied()
                .unwrap_or(0.)
                * 1000.,
            sampled_frames: frames.len(),
            enemies: sim.0.enemies.len(),
            clones: if sim.0.clone_time > 0. { 2 } else { 0 },
            party_members: sim.0.journey.as_ref().map_or(2, |j| {
                1 + usize::from(j.joined) + usize::from(j.dragon_joined)
            }),
        };
        if let Ok(value) = serde_json::to_string(&ClientSnapshot {
            run: sim.0.snapshot(ready.0),
            performance,
        }) {
            browser_state(&value);
        }
        if sim.0.expedition.is_some()
            && let Ok([x, z, span]) = serde_json::from_str::<[f32; 3]>(&browser_chart_request())
            && x.is_finite()
            && z.is_finite()
            && x.abs() < 1_000_000.
            && z.abs() < 1_000_000.
            && (128. ..=1024.).contains(&span)
            && let Ok(value) = serde_json::to_string(&cfgcn_game_core::map_chart(x, z, span))
        {
            browser_chart(&value);
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = (
        &sim, &ready, &metrics, &maps, &river, &crowd, &pop, &spells, &atlas,
    );
}
