//! Distance-driven gait and masked upper-body actions, on the accepted Studio rigs.
use super::*;
use bevy::animation::AnimationTargetId;
use serde::Deserialize;
#[derive(Deserialize)]
struct Stride {
    stride: f32,
    max_cycles: f32,
}
#[derive(Deserialize)]
struct Profiles {
    monk: Stride,
    wukong: Stride,
    white_dragon: Stride,
}
fn stride(kind: u8) -> &'static Stride {
    static PROFILES: std::sync::LazyLock<Profiles> = std::sync::LazyLock::new(|| {
        serde_json::from_str(include_str!("../../art/motion-profile.json"))
            .expect("checked party motion profile")
    });
    match kind {
        1 => &PROFILES.monk,
        4 => &PROFILES.white_dragon,
        _ => &PROFILES.wukong,
    }
}

pub const CLIP_COUNT: usize = 9;
pub fn graph(
    gltf: &Gltf,
    graphs: &mut Assets<AnimationGraph>,
) -> (Handle<AnimationGraph>, [AnimationNodeIndex; CLIP_COUNT]) {
    let mut graph = AnimationGraph::new();
    let nodes = std::array::from_fn(|i| {
        let (clip, mask) = match i {
            5..=7 => (i - 3, 1), // Moving actions exclude the pelvis and legs.
            8 => (1, 2),         // The gait supplies just those legs.
            _ => (i, 0),
        };
        graph.add_clip_with_mask(
            gltf.animations
                .get(clip)
                .unwrap_or(&gltf.animations[2])
                .clone(),
            mask,
            1.,
            graph.root,
        )
    });
    (graphs.add(graph), nodes)
}

pub fn lower_body(name: &str) -> bool {
    [
        "root", "hips", "body", "thigh.", "shin.", "foot.", "fore.", "hind.", "knee.", "hoof.",
    ]
    .iter()
    .any(|prefix| name == *prefix || name.starts_with(prefix))
}

#[allow(clippy::too_many_arguments)]
pub fn attach(
    event: On<WorldInstanceReady>,
    mut commands: Commands,
    children: Query<&Children>,
    clips: Query<&Clips>,
    targets: Query<(&AnimationTargetId, &Name)>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    sources: Res<Assets<AnimationClip>>,
    mut players: Query<&mut AnimationPlayer>,
) {
    let Ok(set) = clips.get(event.entity) else {
        return;
    };
    let Some(mut graph) = graphs.get_mut(&set.graph) else {
        return;
    };
    for entity in children.iter_descendants(event.entity) {
        if let Ok((id, name)) = targets.get(entity) {
            graph.add_target_to_mask_group(*id, if lower_body(name.as_str()) { 0 } else { 1 });
        }
    }
    let durations = std::array::from_fn(|i| {
        graph
            .get(set.nodes[i])
            .and_then(|node| match &node.node_type {
                bevy::animation::graph::AnimationNodeType::Clip(handle) => {
                    sources.get(handle).map(AnimationClip::duration)
                }
                _ => None,
            })
            .unwrap_or(0.6)
    });
    for entity in children.iter_descendants(event.entity) {
        if let Ok(mut player) = players.get_mut(entity) {
            player.play(set.nodes[0]).repeat().set_speed(0.);
            commands.entity(entity).insert((
                AnimationGraphHandle(set.graph.clone()),
                Animator {
                    root: event.entity,
                    clip: 0,
                    nodes: set.nodes,
                    link_sequence: 0,
                    cooldowns: [0.; 2],
                    cast_left: 0.,
                    cast_clip: 3,
                    elapsed: 0.,
                    weights: std::array::from_fn(|i| if i == 0 { 1. } else { 0. }),
                    durations,
                    distance: 0.,
                    gait_phase: 0.,
                    locomotion: 0.,
                    position: None,
                },
            ));
        }
    }
}

pub fn animate(
    sim: Res<Simulation>,
    mut players: Query<(&mut AnimationPlayer, &mut Animator)>,
    roots: Query<(&Actor, &Transform, &Visibility)>,
) {
    let run = &sim.0;
    for (mut player, mut a) in &mut players {
        let Ok((actor, root, visibility)) = roots.get(a.root) else {
            continue;
        };
        if *visibility == Visibility::Hidden {
            // The two absent clones and dormant dragon spirit retain their
            // reusable rigs, but must not keep evaluating invisible skeletons.
            player.stop_all();
            a.weights = [0.; CLIP_COUNT];
            a.cast_left = 0.;
            a.cooldowns = [0.; 2];
            a.position = None;
            a.locomotion = 0.;
            a.elapsed = run.elapsed;
            continue;
        }
        if run.phase != Phase::Playing {
            continue;
        }
        let dt = (run.elapsed - a.elapsed).clamp(0., 0.05);
        if run.elapsed < a.elapsed {
            a.cast_left = 0.;
            a.cooldowns = [0.; 2];
            a.position = None;
        }
        a.elapsed = run.elapsed;
        let mut travel = 0.;
        if let Some(old) = a.position {
            // Ignore scene entry, recruitment and saved-checkpoint teleports.
            let step = (root.translation - old).xz().length();
            if step < 1.5 {
                travel = step;
                a.distance += step;
            }
        }
        let profile = stride(actor.kind);
        a.gait_phase =
            (a.gait_phase + (travel / profile.stride).min(dt * profile.max_cycles)).fract();
        // Ease arrivals instead of snapping on a one-frame movement flag.
        let moving = if dt > 0. {
            (travel / dt / 1.2).clamp(0., 1.)
        } else {
            a.locomotion
        };
        a.locomotion += (moving - a.locomotion).clamp(-dt / 0.14, dt / 0.10);
        a.position = Some(root.translation);
        let cooldowns = run.journey.as_ref().map_or_else(
            || {
                if actor.kind == 0 {
                    [run.freeze_cd, run.clone_cd]
                } else {
                    [0.; 2]
                }
            },
            |j| {
                let i = match actor.kind {
                    0 => 1,
                    1 => 0,
                    4 => 2,
                    _ => return [0.; 2],
                };
                [j.primary[i], j.secondary[i]]
            },
        );
        a.cast_left = (a.cast_left - dt).max(0.);
        if let Some(i) = (0..2).find(|i| cooldowns[*i] > a.cooldowns[*i] + 0.5) {
            a.cast_left = 0.55;
            a.cast_clip = 3 + i;
        }
        a.cooldowns = cooldowns;
        let link = run.journey.as_ref().filter(|j| {
            j.links.remaining > 0.
                && match j.links.active {
                    1 => [0, 1, 3].contains(&actor.kind),
                    2 => [0, 1, 3, 4].contains(&actor.kind),
                    3 => [0, 3, 4].contains(&actor.kind),
                    4 => [1, 4].contains(&actor.kind),
                    _ => false,
                }
        });
        let (clip, progress) = if a.cast_left > 0. {
            (a.cast_clip, 1. - a.cast_left / 0.55)
        } else if let Some(j) = link {
            let duration = match j.links.active {
                2 => 1.3,
                4 => 0.9,
                _ => 0.7,
            };
            (
                if j.links.active == 4 { 4 } else { 3 },
                1. - j.links.remaining / duration,
            )
        } else {
            let (remaining, duration) = match actor.kind {
                0 | 3 => (run.attack, 0.28),
                1 => (run.journey.as_ref().map_or(0., |j| j.monk_attack), 0.55),
                4 => (run.journey.as_ref().map_or(0., |j| j.dragon_attack), 0.55),
                2 => (
                    run.enemies
                        .iter()
                        .find(|e| e.id == actor.id)
                        .map_or(0., |e| e.windup),
                    1.05,
                ),
                _ => (0., 1.),
            };
            if remaining > 0. {
                (2, 1. - (remaining / duration).clamp(0., 1.))
            } else {
                (usize::from(actor.moving), 0.)
            }
        };
        let layered = clip >= 2 && a.locomotion > 0.05 && [0, 1, 3, 4].contains(&actor.kind);
        let selected = if layered { clip + 3 } else { clip };
        let mut target = [0.; CLIP_COUNT];
        target[selected] = 1.;
        if layered {
            target[8] = 1.;
        } else if clip < 2 {
            target[0] = 1. - a.locomotion;
            target[1] = a.locomotion;
        }
        for (i, desired) in target.iter().enumerate() {
            // Simulation time owns fades too: pause and upgrade freeze the exact pose.
            let delta = (*desired - a.weights[i]).clamp(-dt / 0.09, dt / 0.09);
            a.weights[i] += delta;
            if a.weights[i] <= 0. {
                player.stop(a.nodes[i]);
                continue;
            }
            let phase = match i {
                0 => {
                    if reduced_motion() {
                        0.
                    } else {
                        (run.elapsed / a.durations[0]).fract()
                    }
                }
                1 | 8 => a.gait_phase,
                _ => progress.clamp(0., 0.999),
            };
            let source = match i {
                5..=7 => i - 3,
                8 => 1,
                _ => i,
            };
            let active = player.play(a.nodes[i]);
            active.repeat().set_speed(0.).set_weight(a.weights[i]);
            if *desired > 0. || matches!(i, 0 | 1 | 8) {
                active.set_seek_time(phase * a.durations[source]);
            }
        }
        a.clip = clip;
        a.link_sequence = link.map_or(0, |j| j.links.sequence);
    }
}
