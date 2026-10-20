use cfgcn_game_core::{Input, Phase, Point, Run};

fn main() {
    for seed in [1, 7, 42, 0x65786a71] {
        let mut run = Run::new(seed);
        run.step(
            0.,
            Input {
                action: 1,
                ..Default::default()
            },
        );
        for _ in 0..18000 {
            if matches!(run.phase, Phase::Won | Phase::Lost) {
                break;
            }
            if run.phase == Phase::Upgrade {
                let desired = if run.hp < 65. || run.master_hp < 75. {
                    3
                } else if run.talents[0] < 3 {
                    0
                } else {
                    1
                };
                let choice = run.choices.iter().position(|n| *n == desired).unwrap_or(0);
                run.choose(choice);
            }
            let threat = run.enemies.iter().filter(|e| !e.boss).min_by(|a, b| {
                a.pos
                    .distance(run.master)
                    .total_cmp(&b.pos.distance(run.master))
            });
            let orb = run.orbs.iter().min_by(|a, b| {
                a.pos
                    .distance(run.hero)
                    .total_cmp(&b.pos.distance(run.hero))
            });
            let boss = run.enemies.iter().find(|e| e.boss);
            let mut target = if let Some(boss) = boss {
                if boss.windup > 0. && run.hero.distance(boss.strike) < 5. {
                    Point::new(boss.strike.x + 5., boss.strike.z)
                } else {
                    boss.pos
                }
            } else if let Some(enemy) = threat.filter(|e| e.pos.distance(run.master) < 5.) {
                enemy.pos
            } else if let Some(orb) = orb.filter(|o| o.pos.distance(run.master) < 10.) {
                orb.pos
            } else {
                Point::new(run.master.x, run.master.z + 2.)
            };
            if boss.is_none() {
                if let Some(enemy) = run.enemies.iter().min_by(|a, b| {
                    a.pos
                        .distance(run.hero)
                        .total_cmp(&b.pos.distance(run.hero))
                }) {
                    let dx = run.hero.x - enemy.pos.x;
                    let dz = run.hero.z - enemy.pos.z;
                    let distance = (dx * dx + dz * dz).sqrt().max(0.01);
                    if distance < run.range() - 0.5 {
                        target = Point::new(
                            enemy.pos.x + dx / distance * (run.range() - 0.1),
                            enemy.pos.z + dz / distance * (run.range() - 0.1),
                        );
                    }
                }
            }
            let dx = target.x - run.hero.x;
            let dz = target.z - run.hero.z;
            let distance = (dx * dx + dz * dz).sqrt().max(1.);
            run.step(
                0.05,
                Input {
                    x: dx / distance,
                    z: dz / distance,
                    freeze: run.enemies.iter().any(|e| e.pos.distance(run.hero) < 5.),
                    clone: true,
                    ..Default::default()
                },
            );
        }
        println!(
            "seed={seed} phase={:?} elapsed={:.1} kills={} level={} escort={:.0}% hero_hp={:.0} master_hp={:.0}",
            run.phase,
            run.elapsed,
            run.kills,
            run.level,
            run.progress() * 100.,
            run.hp,
            run.master_hp
        );
        assert_eq!(
            run.phase,
            Phase::Won,
            "escort strategy must be able to finish the trial"
        );
    }
}
