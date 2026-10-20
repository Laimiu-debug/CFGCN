use crate::*;
fn party(events: u8) -> Run {
    Run::new_journey(
        42,
        JourneyCheckpoint {
            chapter: 3,
            events,
            camp: 0,
            dragon_joined: events & 8 != 0,
            ..Default::default()
        },
    )
}
#[test]
fn boundaries_are_continuous_and_do_not_reset_the_party() {
    let mut r = party(3);
    r.master = Point::new(0., 57.9);
    r.hero = Point::new(3., 57.);
    r.journey.as_mut().unwrap().primary = [7., 8., 9.];
    r.xp = 2;
    r.elapsed = 123.;
    r.master_hp = 91.;
    r.step(
        0.05,
        Input {
            z: 1.,
            ..Default::default()
        },
    );
    let j = r.journey.as_ref().unwrap();
    assert_eq!(j.chapter, 3);
    assert!(r.master.z > 58. && r.master.z < 59.);
    assert_eq!(r.xp, 2);
    assert!(r.master_hp >= 91. && r.master_hp < 92.);
    assert!(r.elapsed > 123.);
    assert!(j.primary[0] > 6.9);
    r.step(
        0.05,
        Input {
            z: -1.,
            ..Default::default()
        },
    );
    assert_eq!(r.journey.as_ref().unwrap().chapter, 2);
    assert_ne!(r.phase, Phase::Won);
    assert!(r.journey.as_ref().unwrap().joined);
}
#[test]
fn region_population_is_local_bounded_and_boss_returns_home() {
    let mut r = party(3);
    r.master = Point::new(0., 83.);
    r.hero = Point::new(3., 82.);
    r.step(0., Input::default());
    assert!(
        r.enemies
            .iter()
            .any(|e| e.boss && e.region == 2 && e.home.z == 85.)
    );
    assert!(r.enemies.iter().all(|e| e.pos.z > 58.));
    r.master = Point::new(0., 44.);
    r.hero = r.master;
    let boss = r.enemies.iter_mut().find(|e| e.boss).unwrap();
    boss.pos.z = 65.;
    boss.windup = 1.;
    r.step(0.05, Input::default());
    let boss = r.enemies.iter().find(|e| e.boss).unwrap();
    assert!(boss.pos.z > 65.);
    assert_eq!(boss.windup, 0.);
    assert!(r.enemies.len() <= MAX_ENEMIES);
}
#[test]
fn followers_keep_personal_space_and_move_without_the_leader_moving() {
    let mut r = party(15);
    r.master = Point::new(0., 12.);
    r.hero = r.master;
    r.journey.as_mut().unwrap().dragon_pos = r.master;
    r.spawn_cd = 999.;
    for _ in 0..80 {
        r.step(0.05, Input::default());
    }
    let j = r.journey.as_ref().unwrap();
    assert!(r.hero.distance(r.master) > 2.5);
    assert!(j.dragon_pos.distance(r.master) > 2.5);
    assert!(j.dragon_pos.distance(r.hero) > 2.5);
    let before = r.hero;
    r.spawn(EnemyKind::Brute);
    let e = r.enemies.last_mut().unwrap();
    e.pos = Point::new(7., 18.);
    e.hp = 500.;
    for _ in 0..20 {
        r.step(0.05, Input::default());
    }
    assert!(r.hero.distance(before) > 0.5);
    assert!(r.journey.as_ref().unwrap().intentions.contains(&2));
}
#[test]
fn links_have_a_real_windup_damage_and_pause_freezes_every_timer() {
    let mut r = party(15);
    r.master = Point::new(0., 12.);
    r.hero = Point::new(1., 12.);
    r.journey.as_mut().unwrap().dragon_pos = Point::new(-2., 12.);
    r.spawn_cd = 999.;
    r.spawn(EnemyKind::Brute);
    let e = r.enemies.last_mut().unwrap();
    e.pos = Point::new(2., 12.);
    e.hp = 900.;
    e.max_hp = 900.;
    e.chant_mark = 2.;
    e.staff_mark = 0.25;
    r.attack = 0.2;
    let mut j = r.journey.take().unwrap();
    r.party_links(0., &mut j);
    assert_eq!(j.links.active, 1);
    assert!(j.links.windup > 0.);
    let hp = r.enemies[0].hp;
    r.party_links(0.1, &mut j);
    assert_eq!(r.enemies[0].hp, hp);
    r.journey = Some(j);
    r.phase = Phase::Paused;
    let before = serde_json::to_string(&r.journey).unwrap();
    r.step(1., Input::default());
    assert_eq!(serde_json::to_string(&r.journey).unwrap(), before);
    let mut j = r.journey.take().unwrap();
    r.party_links(0.3, &mut j);
    assert!(r.enemies[0].hp < hp - 50.);
    assert_eq!(j.links.count[0], 1);
    j.links.remaining = 0.;
    j.links.resonance = 100.;
    r.enemies[0].boss = true;
    r.party_links(0., &mut j);
    assert_eq!(j.links.active, 2);
    assert_eq!(j.links.resonance, 0.);
    r.party_links(0.7, &mut j);
    assert_eq!(j.links.count[1], 1);
    assert!(r.enemies[0].hp < hp - 170.);
    j.links.remaining = 0.;
    j.links.resonance = 100.;
    r.enemies.clear();
    r.party_links(1., &mut j);
    assert_eq!(j.links.resonance, 100.);
}
#[test]
fn milestones_persist_without_results_or_recruitment_rewards_repeating() {
    let mut r = party(15);
    r.master = Point::new(0., 102.);
    r.hero = Point::new(3., 101.);
    r.journey.as_mut().unwrap().stage_time = 31.;
    r.step(0., Input::default());
    let cp = r.journey.as_ref().unwrap().checkpoint;
    assert!(cp.valid());
    assert_eq!(cp.events, 31);
    assert_eq!(r.phase, Phase::Playing);
    let restored = Run::new_journey(42, cp);
    assert!(restored.journey.as_ref().unwrap().dragon_joined);
    assert_eq!(
        restored
            .journey
            .as_ref()
            .unwrap()
            .world
            .as_ref()
            .unwrap()
            .events,
        31
    );
    r.master = Journey::SEAL;
    r.step(
        0.,
        Input {
            action: 7,
            ..Default::default()
        },
    );
    assert!(!r.journey.as_ref().unwrap().reunion);
}
#[test]
fn companion_can_detour_past_the_visible_mountain_fingers() {
    let mut r = party(15);
    r.master = Point::new(0., 14.);
    r.hero = Point::new(-5., 30.);
    r.journey.as_mut().unwrap().dragon_pos = Point::new(5., 30.);
    r.spawn_cd = 999.;
    for _ in 0..180 {
        r.step(0.05, Input::default());
    }
    let j = r.journey.as_ref().unwrap();
    assert!(r.hero.distance(r.master) < 10.);
    assert!(j.dragon_pos.distance(r.master) < 10.);
    for body in j.world_obstacles() {
        assert!(!body.contains(r.hero, 0.37));
        assert!(!body.contains(j.dragon_pos, 0.37));
    }
}

#[test]
fn visible_gate_uses_shared_stone_bases_then_releases_the_same_space() {
    let locked = party(1).journey.unwrap();
    let unlocked = party(3).journey.unwrap();
    for i in -135..=135 {
        let p = Point::new(i as f32 / 10., 41.6);
        assert!(
            locked
                .world_obstacles()
                .iter()
                .any(|body| body.contains(p, 0.38)),
            "gap in visible gate at {}",
            p.x
        );
        assert!(
            !unlocked
                .world_obstacles()
                .iter()
                .any(|body| body.contains(p, 0.38)),
            "gate persists after guardian"
        );
    }
    // Near the narrow flank, the old 2.3m disk pushed characters away from
    // empty air beside a 1.66m-wide base. The body now fits the actual ellipse.
    assert!(
        !unlocked
            .world_obstacles()
            .iter()
            .any(|b| b.contains(Point::new(6.3, 24.2), 0.38))
    );
    let mut p = Point::new(10., 40.2);
    locked.bound(&mut p);
    assert_eq!(p, Point::new(10., 40.2));
}
#[test]
fn water_hit_and_staff_hit_chain_and_ward_chain_heals_only_real_injuries() {
    let mut r = party(15);
    r.master = Point::new(0., 12.);
    r.hero = Point::new(2., 12.);
    r.journey.as_mut().unwrap().dragon_pos = Point::new(-2., 12.);
    r.spawn(EnemyKind::Brute);
    let e = r.enemies.last_mut().unwrap();
    e.pos = Point::new(3., 12.);
    e.hp = 800.;
    e.max_hp = 800.;
    e.staff_mark = 0.25;
    e.tide_mark = 2.;
    let mut j = r.journey.take().unwrap();
    r.party_links(0., &mut j);
    assert_eq!(j.links.active, 3);
    r.party_links(0.4, &mut j);
    assert_eq!(j.links.count[2], 1);
    assert!(r.enemies[0].hp < 750.);
    j.links.remaining = 0.;
    j.shield = 3.;
    j.dragon_guard = 3.;
    r.party_links(0., &mut j);
    assert_ne!(j.links.active, 4);
    r.master_hp = 70.;
    j.links.remaining = 0.;
    r.party_links(0., &mut j);
    assert_eq!(j.links.active, 4);
    r.party_links(0.5, &mut j);
    assert!(r.master_hp >= 86.);
    assert_eq!(j.links.count[3], 1);
}
#[test]
fn interrupted_trio_refunds_resonance_and_does_not_report_an_empty_hit() {
    let mut r = party(15);
    r.master = Point::new(0., 12.);
    r.hero = Point::new(1., 12.);
    r.journey.as_mut().unwrap().dragon_pos = Point::new(-1., 12.);
    r.spawn(EnemyKind::Boss);
    r.enemies[0].pos = Point::new(2., 12.);
    let mut j = r.journey.take().unwrap();
    j.links.resonance = 100.;
    r.party_links(0., &mut j);
    assert_eq!(j.links.active, 2);
    assert_eq!(j.links.resonance, 0.);
    r.enemies.clear();
    r.party_links(0.2, &mut j);
    assert_eq!(j.links.resonance, 100.);
    assert_eq!(j.links.count[1], 0);
    assert_eq!(j.links.windup, 0.);
}
#[test]
fn old_completed_save_migrates_to_far_bank_and_infinite_play_stays_saveable() {
    let cp = JourneyCheckpoint {
        chapter: 4,
        ..Default::default()
    };
    assert!(cp.valid());
    let mut r = Run::new_journey(42, cp);
    let j = r.journey.as_ref().unwrap();
    assert!(j.joined && j.dragon_joined);
    assert_eq!(j.world.as_ref().unwrap().events, 31);
    assert_eq!(r.master.z, 102.);
    r.level = 70;
    r.next_xp = 211;
    r.xp = 1000;
    r.journey_level();
    assert_eq!(r.level, 70);
    assert_eq!(r.xp, 210);
    assert!(
        !JourneyCheckpoint {
            chapter: 2,
            events: 1,
            camp: 2,
            ..Default::default()
        }
        .valid()
    );
}
#[test]
fn resting_at_the_same_camp_saves_new_training() {
    let mut r = Run::new_journey(
        42,
        JourneyCheckpoint {
            chapter: 3,
            events: 15,
            camp: 2,
            dragon_joined: true,
            ..Default::default()
        },
    );
    r.level = 4;
    r.next_xp = 13;
    r.xp = 2;
    r.journey.as_mut().unwrap().monk[0] = 2;
    r.step(
        0.,
        Input {
            action: 7,
            ..Default::default()
        },
    );
    let cp = r.journey.as_ref().unwrap().checkpoint;
    assert_eq!(cp.camp, 2);
    assert_eq!(cp.level, 4);
    assert_eq!(cp.monk[0], 2);
    assert!(cp.valid());
}
