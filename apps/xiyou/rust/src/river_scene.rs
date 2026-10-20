//! Continuous-map streaming shares glTF roots and releases distant terrain.
use super::*;
#[derive(Component)]
pub struct MapKind(pub u8);
struct MapChunk {
    source: &'static str,
    root: Handle<Gltf>,
    entity: Option<Entity>,
    decorated: bool,
    requested: f32,
}
#[derive(Resource, Default)]
pub struct MapStreaming {
    chunks: [Option<MapChunk>; 2],
    foliage: Option<Handle<Gltf>>,
    stone: Option<Handle<Gltf>>,
}
impl MapStreaming {
    pub fn loaded(&self, i: usize) -> bool {
        self.chunks[i].as_ref().is_some_and(|c| c.entity.is_some())
    }
    pub fn failed(&self, server: &AssetServer, now: f32) -> bool {
        self.chunks.iter().flatten().any(|c| {
            matches!(
                server.get_load_state(c.root.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || c.entity.is_none() && now - c.requested > 60.
        })
    }
}
#[derive(Resource)]
pub struct RiverLoads {
    roots: Vec<Handle<Gltf>>,
    requested: f32,
}
#[derive(Resource)]
pub struct RiverArt {
    pub scenes: Vec<Handle<bevy::world_serialization::WorldAsset>>,
    pub animations: Vec<(
        Handle<AnimationGraph>,
        [AnimationNodeIndex; motion::CLIP_COUNT],
    )>,
    pub requested: f32,
}
#[allow(clippy::too_many_arguments)]
pub fn load(
    mut commands: Commands,
    sim: Res<Simulation>,
    server: Res<AssetServer>,
    gltfs: Res<Assets<Gltf>>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    mut maps: ResMut<MapStreaming>,
    pending: Option<Res<RiverLoads>>,
    river: Option<Res<RiverArt>>,
    time: Res<Time<Real>>,
) {
    if sim.0.expedition.is_some() {
        for chunk in &mut maps.chunks {
            if let Some(old) = chunk.take()
                && let Some(e) = old.entity
            {
                commands.entity(e).despawn();
            }
        }
        maps.foliage = None;
        maps.stone = None;
        return;
    }
    let z = sim.0.leader_point().z;
    if maps.foliage.is_none() {
        maps.foliage = Some(server.load("pine_tree.glb"));
    }
    if maps.stone.is_none() {
        maps.stone = Some(server.load("seal_stone.glb"));
    }
    let stone = maps
        .stone
        .as_ref()
        .and_then(|h| gltfs.get(h))
        .map(|g| g.scenes[0].clone());
    let foliage = maps
        .foliage
        .as_ref()
        .and_then(|h| gltfs.get(h))
        .map(|g| g.scenes[0].clone());
    let world = sim.0.journey.as_ref().is_some_and(|j| j.world.is_some());
    let trial = sim.0.journey.is_none() && sim.0.phase != Phase::Menu;
    for (i, file) in [
        if trial {
            "landscape.glb"
        } else {
            "mountain_world.glb"
        },
        "river_scene.glb",
    ]
    .iter()
    .enumerate()
    {
        let wanted = if i == 0 {
            !world || z < if maps.chunks[0].is_some() { 95. } else { 80. }
        } else {
            world && z > if maps.chunks[1].is_some() { 12. } else { 18. }
        };
        if maps.chunks[i].as_ref().is_some_and(|c| c.source != *file)
            && let Some(old) = maps.chunks[i].take()
            && let Some(e) = old.entity
        {
            commands.entity(e).despawn();
        }
        if wanted && maps.chunks[i].is_none() {
            maps.chunks[i] = Some(MapChunk {
                source: file,
                root: server.load(*file),
                entity: None,
                decorated: false,
                requested: time.elapsed_secs(),
            });
        }
        if !wanted
            && let Some(chunk) = maps.chunks[i].take()
            && let Some(e) = chunk.entity
        {
            commands.entity(e).despawn();
        }
        if let Some(chunk) = &mut maps.chunks[i]
            && chunk.entity.is_none()
            && server.is_loaded_with_dependencies(chunk.root.id())
            && let Some(g) = gltfs.get(&chunk.root)
        {
            chunk.entity = Some(
                commands
                    .spawn((
                        MapKind(i as u8),
                        WorldAssetRoot(g.scenes[0].clone()),
                        Transform::from_xyz(0., 0., if i == 1 { 64. } else { 0. }),
                    ))
                    .id(),
            );
        }
        if let Some(chunk) = &mut maps.chunks[i]
            && let Some(parent) = chunk.entity
            && !chunk.decorated
            && !trial
            && let Some(scene) = &foliage
            && let Some(stone) = &stone
        {
            for region in if i == 0 { 0..2 } else { 2..3 } {
                for (p, scale) in cfgcn_game_core::world_props(region) {
                    commands.spawn((
                        WorldAssetRoot(scene.clone()),
                        ChildOf(parent),
                        Transform::from_xyz(
                            p.x,
                            cfgcn_game_core::terrain_height(p.x, p.z) - 0.05,
                            p.z - if i == 1 { 64. } else { 0. },
                        )
                        .with_scale(Vec3::new(
                            scale,
                            scale * (0.90 + 0.15 * (p.z * 0.7).sin()),
                            scale,
                        ))
                        .with_rotation(Quat::from_rotation_y(
                            (23. + p.x * 7. + p.z * 11.).to_radians(),
                        )),
                    ));
                }
            }
            chunk.decorated = true;
            for body in cfgcn_game_core::WORLD_STONES
                .iter()
                .filter(|s| usize::from(s.pos.z >= 58.) == i)
            {
                commands.spawn((
                    WorldAssetRoot(stone.clone()),
                    ChildOf(parent),
                    journey_scene::Landmark {
                        chapter: if body.event == 128 {
                            0
                        } else if i == 0 {
                            2
                        } else {
                            3
                        },
                        kind: match body.event {
                            1 => 1,
                            2 => 4,
                            128 => 6,
                            _ => 0,
                        },
                    },
                    Transform::from_xyz(
                        body.pos.x,
                        cfgcn_game_core::terrain_height(body.pos.x, body.pos.z) - 0.05,
                        body.pos.z - if i == 1 { 64. } else { 0. },
                    )
                    .with_scale(Vec3::from_array(body.scale))
                    .with_rotation(Quat::from_rotation_y(body.angle.to_radians())),
                ));
            }
        }
    }
    let needs_river = world && (z > 18. || sim.0.journey.as_ref().is_some_and(|j| j.dragon_joined));
    if needs_river && river.is_none() && pending.is_none() {
        commands.insert_resource(RiverLoads {
            roots: ["white_dragon.glb", "river_dragon.glb", "riverling.glb"]
                .iter()
                .map(|f| server.load(*f))
                .collect(),
            requested: time.elapsed_secs(),
        });
    }
    if river.is_some() {
        return;
    }
    let Some(pending) = pending else {
        return;
    };
    let Some(loaded) = pending
        .roots
        .iter()
        .map(|h| gltfs.get(h))
        .collect::<Option<Vec<_>>>()
    else {
        return;
    };
    let scenes = loaded
        .iter()
        .map(|g| g.scenes[0].clone())
        .collect::<Vec<_>>();
    let mut animations = vec![];
    for g in loaded {
        animations.push(motion::graph(g, &mut graphs));
    }
    for (kind, asset) in [(4, 0), (5, 1)] {
        let (graph, nodes) = &animations[asset];
        commands
            .spawn((
                WorldAssetRoot(scenes[asset].clone()),
                Actor {
                    kind,
                    id: 0,
                    moving: false,
                },
                Clips {
                    graph: graph.clone(),
                    nodes: *nodes,
                },
                Transform::default(),
                Visibility::Hidden,
            ))
            .observe(motion::attach);
    }
    commands.insert_resource(RiverArt {
        scenes,
        animations,
        requested: pending.requested,
    });
    commands.remove_resource::<RiverLoads>();
}
pub fn sync(maps: Query<&MapKind>) {
    for kind in &maps {
        let _ = kind.0;
    }
}
