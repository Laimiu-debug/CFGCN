//! Feature-gated localhost-only synthetic load. Normal play never enters this.
use super::*;
#[derive(Resource, Default)]
pub struct Benchmark(pub usize);
#[derive(Resource, Default)]
pub struct MotionProbe(bool);
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnCrowdBenchmark)]
    fn browser_count() -> u32;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnMotionProbe)]
    fn browser_motion_enabled() -> bool;
    #[wasm_bindgen(js_namespace=window,js_name=cfgcnBenchmarkMotion)]
    fn browser_motion(value: &str);
}
pub fn setup(mut commands: Commands) {
    #[cfg(target_arch = "wasm32")]
    commands.insert_resource(MotionProbe(browser_motion_enabled()));
    #[cfg(target_arch = "wasm32")]
    let count = browser_count() as usize;
    #[cfg(not(target_arch = "wasm32"))]
    let count = 0;
    if [200, 500, 1000].contains(&count) {
        commands.insert_resource(Benchmark(count));
        commands.insert_resource(Simulation(Run::crowd_benchmark(count)));
    }
}
#[allow(clippy::too_many_arguments)]
pub fn motion(
    probe: Res<MotionProbe>,
    sim: Res<Simulation>,
    time: Res<Time<Real>>,
    actors: Query<(&Actor, &Transform, &Visibility)>,
    cameras: Query<&Transform, With<FollowCamera>>,
    animators: Query<(Entity, &Animator, &AnimationPlayer)>,
    bones: Query<(&Name, &Transform, &bevy::animation::AnimatedBy)>,
    spells: Option<Res<spell_fx::SpellArt>>,
) {
    if !probe.0 {
        return;
    }
    let party = animators
        .iter()
        .filter_map(|(player, a, _)| {
            let (actor, t, _) = actors.get(a.root).ok()?;
            let joints = bones
                .iter()
                .filter(|(name, _, by)| {
                    by.0 == player
                        && [
                            "root",
                            "hips",
                            "thigh.L",
                            "shin.L",
                            "foot.L",
                            "chest",
                            "hand.L",
                            "upper_arm.L",
                            "neck",
                            "fore.L",
                            "hoof.fore.L",
                        ]
                        .contains(&name.as_str())
                })
                .map(|(name, t, _)| {
                    (
                        name.as_str().to_string(),
                        (t.translation.to_array(), t.rotation.to_array()),
                    )
                })
                .collect::<std::collections::BTreeMap<_, _>>();
            [0, 1, 4].contains(&actor.kind).then(|| serde_json::json!({
            "kind":actor.kind,"position":t.translation.to_array(),"rotation":t.rotation.to_array(),
            "clip":a.clip,"gait":a.distance,"gait_phase":a.gait_phase,"locomotion":a.locomotion,"weights":a.weights,"joints":joints,
        }))
        })
        .collect::<Vec<_>>();
    let camera = cameras
        .iter()
        .next()
        .map(|t| (t.translation.to_array(), t.rotation.to_array()));
    let animation_players = animators.iter().filter_map(|(_, a, player)| {
        let (actor, _, visibility) = actors.get(a.root).ok()?;
        Some(serde_json::json!({"actor":[actor.kind,actor.id],"visible":*visibility != Visibility::Hidden,"tracks":player.playing_animations().count()}))
    }).collect::<Vec<_>>();
    let value = serde_json::json!({"elapsed":sim.0.elapsed,"dt":time.delta_secs(),"phase":sim.0.phase,"party":party,"camera":camera,"animation_players":animation_players,"spells":spells.map_or([0;2],|s|s.counts())});
    #[cfg(target_arch = "wasm32")]
    browser_motion(&value.to_string());
    #[cfg(not(target_arch = "wasm32"))]
    let _ = value;
}
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = window, js_name = cfgcnBenchmarkFrame)]
    pub fn frame(seconds: f32);
}
