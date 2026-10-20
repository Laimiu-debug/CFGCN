use cfgcn_game_core::{Input, Journey, JourneyCheckpoint, Phase, Point, Run};

fn main() {
    for seed in [1, 7, 42, 0x65786a71] {
        let mut r = Run::new_journey(seed, JourneyCheckpoint::default());
        let mut stages = vec![];
        let mut completed_at = None;
        for _ in 0..20000 {
            let j = r.journey.as_ref().expect("journey");
            if j.world.as_ref().is_some_and(|w| w.events == 31) {
                if completed_at.is_none() {
                    completed_at = Some(r.elapsed);
                }
                if r.master.z < 24. {
                    break;
                }
            }
            if r.phase == Phase::Lost {
                panic!(
                    "seed {seed} failed chapter {} at {:.1}s monk={:.1} wukong={:.1} dragon={:.1} ranks={:?}/{:?}/{:?}",
                    j.chapter,
                    r.elapsed,
                    r.master_hp,
                    r.hp,
                    j.dragon_hp,
                    j.monk,
                    j.wukong,
                    j.dragon
                );
            }
            if r.phase == Phase::Won {
                stages.push((j.chapter, r.elapsed, r.kills, r.level));
                assert!(j.checkpoint.valid());
                if j.chapter == 3 {
                    break;
                }
                r.step(
                    0.,
                    Input {
                        action: 6,
                        ..Default::default()
                    },
                );
                continue;
            }
            if r.phase == Phase::Paused {
                r.step(
                    0.,
                    Input {
                        action: 3,
                        ..Default::default()
                    },
                );
                continue;
            }
            if r.phase == Phase::Upgrade {
                if j.recipient.is_none() {
                    r.step(
                        0.,
                        Input {
                            action: 8,
                            member: (r.level % if j.dragon_joined { 3 } else { 2 }) as u8,
                            ..Default::default()
                        },
                    );
                }
                let j = r.journey.as_ref().unwrap();
                let member = j.recipient.unwrap() as usize;
                let desired =
                    if r.master_hp < 70. || r.hp < 50. || (j.dragon_joined && j.dragon_hp < 70.) {
                        4
                    } else {
                        0
                    };
                let index = j.offers[member]
                    .iter()
                    .position(|id| *id == desired)
                    .unwrap_or(0);
                r.choose(index);
                continue;
            }
            let mut target = if let Some(w) = &j.world {
                if completed_at.is_some() {
                    Point::new(0., 18.)
                } else if !j.joined {
                    j.seal_point()
                } else if w.events & 2 == 0 {
                    Point::new((r.elapsed * 0.5).sin() * 2., 30.)
                } else if !j.dragon_defeated {
                    Point::new((r.elapsed * 0.5).sin() * 2., 83.)
                } else if !j.dragon_joined {
                    j.seal_point()
                } else {
                    j.exit_point()
                }
            } else if j.exit_open {
                Journey::EXIT
            } else {
                Point::new(
                    (r.elapsed * 0.55).sin() * 3.,
                    18. + (r.elapsed * 0.55).cos() * 3.,
                )
            };
            let leader = r.leader_point();
            if let Some(zone) = j
                .zones
                .iter()
                .find(|z| z.delay > 0. && leader.distance(z.pos) < z.radius + 0.8)
            {
                let dx = leader.x - zone.pos.x;
                let dz = leader.z - zone.pos.z;
                let d = (dx * dx + dz * dz).sqrt();
                let (x, z) = if d < 0.01 {
                    (if leader.x < 0. { -1. } else { 1. }, 0.)
                } else {
                    (dx / d, dz / d)
                };
                target = Point::new(
                    zone.pos.x + x * (zone.radius + 1.5),
                    zone.pos.z + z * (zone.radius + 1.5),
                );
            }
            let dx = target.x - leader.x;
            let dz = target.z - leader.z;
            let distance = (dx * dx + dz * dz).sqrt().max(1.);
            r.step(
                0.05,
                Input {
                    x: dx / distance,
                    z: dz / distance,
                    action: 7,
                    freeze: true,
                    clone: true,
                    ..Default::default()
                },
            );
        }
        println!(
            "journey seed={seed} completed={stages:?} monk_hp={:.0} wukong_hp={:.0}",
            r.master_hp, r.hp
        );
        assert_eq!(stages.len(), 2, "both introductory routes complete");
        assert!(
            completed_at.is_some(),
            "continuous world must be completable"
        );
        assert!(
            r.master.z < 24.,
            "party can return to Five Elements Mountain after crossing"
        );
        assert_ne!(r.phase, Phase::Won);
        println!(
            "continuous seed={seed} completed_at={completed_at:?} returned_z={} events={:?} links={:?}",
            r.master.z,
            r.journey.as_ref().unwrap().world,
            r.journey.as_ref().unwrap().links.count
        );
        assert!(r.journey.as_ref().unwrap().dragon_joined);
    }
}
