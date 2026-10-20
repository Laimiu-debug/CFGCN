//! Party movement, character abilities and the Eagle Grief Stream encounter.
use crate::journey::TideZone;
use crate::*;

fn points(run: &Run, j: &Journey) -> [Point; 3] {
    [run.master, run.hero, j.dragon_pos]
}

impl Run {
    fn waymark(&self, j: &Journey, chapter: u8) -> JourneyCheckpoint {
        JourneyCheckpoint {
            version: 1,
            chapter,
            level: self.level,
            xp: self.xp,
            monk: j.monk,
            wukong: j.wukong,
            dragon: j.dragon,
            dragon_joined: j.dragon_joined,
            leader: j.leader,
            events: j.world.as_ref().map_or(0, |w| w.events),
            camp: j.world.as_ref().map_or(0, |w| w.camp),
        }
    }
    fn party_damage(&mut self, j: &mut Journey, member: usize, amount: f32) {
        if !j.available(member as u8) || j.hurt_cd[member] > 0. {
            return;
        }
        let reduction = (1. - j.monk[1] as f32 * 0.08)
            * if j.shield > 0. { 0.2 } else { 1. }
            * if j.dragon_guard > 0. { 0.55 } else { 1. };
        let damage = amount * reduction;
        match member {
            0 => {
                self.master_hp -= damage;
                self.master_hurt = 0.3;
            }
            1 => {
                self.hp -= damage;
                self.hurt = 0.3;
            }
            _ => {
                j.dragon_hp -= damage;
                j.dragon_hurt = 0.3;
            }
        }
        j.hurt_cd[member] = 0.65;
    }
    pub(crate) fn advance_party(&mut self, dt: f32, input: Input) {
        let mut j = self.journey.take().expect("journey mode");
        self.elapsed += dt;
        if let Some(w) = &mut j.world {
            w.rest_cd = (w.rest_cd - dt).max(0.);
        }
        for cd in &mut j.brain_cd {
            *cd = (*cd - dt).max(0.);
        }
        if j.chapter < 2 || (j.chapter == 2 && j.joined) || (j.chapter == 3 && j.dragon_joined) {
            j.stage_time += dt;
        }
        for timer in [
            &mut self.attack,
            &mut self.attack_cd,
            &mut self.spawn_cd,
            &mut self.clone_time,
            &mut self.hurt,
            &mut self.master_hurt,
            &mut j.monk_attack,
            &mut j.chant_cd,
            &mut j.healing_cd,
            &mut j.shield,
            &mut j.dragon_attack,
            &mut j.dragon_guard,
            &mut j.dragon_hurt,
            &mut j.dash,
            &mut j.hoof_cd,
            &mut j.wave_cd,
            &mut j.water_tick,
        ] {
            *timer = (*timer - dt).max(0.);
        }
        for timer in j
            .primary
            .iter_mut()
            .chain(j.secondary.iter_mut())
            .chain(j.hurt_cd.iter_mut())
        {
            *timer = (*timer - dt).max(0.);
        }
        for e in &mut self.effects {
            e.remaining -= dt;
        }
        self.effects.retain(|e| e.remaining > 0.);
        let x = if input.x.is_finite() {
            input.x.clamp(-1., 1.)
        } else {
            0.
        };
        let z = if input.z.is_finite() {
            input.z.clamp(-1., 1.)
        } else {
            0.
        };
        let magnitude = (x * x + z * z).sqrt().max(1.);
        let mut party = points(self, &j);
        let member = j.leader as usize;
        let old = party;
        let mut speed = match member {
            1 => 6.8,
            2 => 7.2 + j.dragon[1] as f32 * 0.22,
            _ => 5.5 + j.monk[3] as f32 * 0.18,
        };
        if j.water(party[member]) && member != 2 && j.dragon_guard <= 0. {
            speed *= 0.55;
        }
        if member == 2 && j.dash > 0. {
            speed *= 2.2;
        }
        let (mx, mz) = if member == 2 && j.dash > 0. && x.abs() + z.abs() < 0.01 {
            (j.dragon_facing.sin(), j.dragon_facing.cos())
        } else {
            (x / magnitude, z / magnitude)
        };
        party[member].x += mx * speed * dt;
        party[member].z += mz * speed * dt;
        j.bound(&mut party[member]);
        j.resolve_obstacles(&mut party[member]);
        let leader = party[member];
        for (i, point) in party.iter_mut().enumerate() {
            if i == member || !j.available(i as u8) {
                continue;
            }
            let (dx, dz) = match i {
                0 => (-4.5, -3.5),
                1 => (4.5, 2.),
                _ => (-5., 2.8),
            };
            let formation = Point::new(leader.x + dx, leader.z + dz);
            let threat = {
                self.enemies
                    .iter()
                    .filter(|e| e.hp > 0. && e.pos.distance(leader) < 13.)
                    .min_by(|a, b| a.pos.distance(*point).total_cmp(&b.pos.distance(*point)))
                    .map(|e| e.pos)
            };
            // Keep the companion's attack reach instead of walking into an enemy body.
            let mut target = threat.map_or(formation, |enemy| {
                let dx = point.x - enemy.x;
                let dz = point.z - enemy.z;
                let distance = (dx * dx + dz * dz).sqrt().max(0.01);
                let reach = if i == 0 {
                    4.
                } else if i == 1 {
                    3.
                } else {
                    3.5
                };
                Point::new(
                    enemy.x + dx / distance * reach,
                    enemy.z + dz / distance * reach,
                )
            });
            let danger = j
                .zones
                .iter()
                .find(|zone| zone.delay > 0. && (*point).distance(zone.pos) < zone.radius + 0.7);
            if let Some(zone) = danger {
                let dx = point.x - zone.pos.x;
                let dz = point.z - zone.pos.z;
                let d = (dx * dx + dz * dz).sqrt();
                let (ux, uz) = if d < 0.01 {
                    (if i == 0 { -1. } else { 1. }, 0.)
                } else {
                    (dx / d, dz / d)
                };
                target = Point::new(
                    zone.pos.x + ux * (zone.radius + 1.2),
                    zone.pos.z + uz * (zone.radius + 1.2),
                );
            }
            if point.distance(leader) > 15. && danger.is_none() {
                target = formation;
            }
            if j.brain_cd[i] <= 0. || danger.is_some() {
                j.goals[i] = j.route_waypoint(*point, target, i as u8);
                j.brain_cd[i] = 0.28 + i as f32 * 0.11;
                j.intentions[i] = if danger.is_some() {
                    3
                } else if threat.is_some() {
                    2
                } else if point.distance(leader) > 11. {
                    1
                } else {
                    0
                };
            }
            target = j.goals[i];
            if j.world.is_none()
                && i != 2
                && (point.z - 88.) * (target.z - 88.) < 0.
                && (point.x.abs() > 2. || target.x.abs() > 2.)
            {
                target = Point::new(0., if point.z < 88. { 87. } else { 95. });
            } else if j.water(target) && i != 2 {
                target.x = 0.;
            }
            // Personal space keeps independent companions from stacking on the leader.
            for (other, p) in old.iter().enumerate() {
                if other != i && j.available(other as u8) && point.distance(*p) < 2.2 {
                    let d = point.distance(*p).max(0.15);
                    point.x += (point.x - p.x) / d * dt * 3.;
                    point.z += (point.z - p.z) / d * dt * 3.;
                }
            }
            if (*point).distance(target)
                > if danger.is_some() {
                    0.2
                } else if threat.is_some() {
                    0.25
                } else {
                    0.6
                }
            {
                // Ease into short waypoints instead of full speed then a dead stop.
                (*point).towards(target, dt * (point.distance(target) * 4.).min(8.5));
            }
            if (*point).distance(leader) > 16. {
                (*point).towards(target, dt * 2.);
            }
            j.bound(&mut (*point));
            j.resolve_obstacles(point);
        }
        if !j.joined {
            party[1] = party[0];
        }
        for i in 0..3 {
            let dx = party[i].x - old[i].x;
            let dz = party[i].z - old[i].z;
            if dx.abs() + dz.abs() > 0.00001 {
                match i {
                    0 => j.monk_facing = dx.atan2(dz),
                    1 => self.facing = dx.atan2(dz),
                    _ => j.dragon_facing = dx.atan2(dz),
                }
            }
        }
        self.master = party[0];
        self.hero = party[1];
        j.dragon_pos = party[2];
        j.rescue_ready = (j.chapter == 2 && !j.joined
            || j.chapter == 3 && j.dragon_defeated && !j.dragon_joined)
            && leader.distance(j.seal_point()) < 3.;
        if input.action == 7 && j.rescue_ready {
            if j.chapter == 2 {
                j.joined = true;
                self.hero = Point::new(self.master.x + 1.8, self.master.z + 1.);
            } else {
                j.dragon_joined = true;
                j.stage_time = 0.;
                j.dragon_pos = Point::new(leader.x - 1.8, leader.z + 1.);
                self.boss_spawned = false;
                self.boss_defeated = false;
                j.start = self.waymark(&j, 3);
                j.checkpoint = j.start;
            }
            if j.world.is_some() {
                self.world_events(&mut j, input, leader);
                self.world_save(&mut j);
            }
            j.reunion = true;
            j.rescue_ready = false;
            self.enemies.clear();
            j.zones.clear();
            self.master_hp = 120.;
            self.hp = 100.;
            j.dragon_hp = 140.;
            self.phase = Phase::Paused;
            self.project_cooldowns(&j);
            self.journey = Some(j);
            return;
        }

        if j.world.is_some() {
            self.world_spawns(&mut j, leader);
            j.exit_open = j.dragon_joined;
        } else {
            let cap = match j.chapter {
                0 => 10,
                1 => 16,
                3 if !j.dragon_joined => 9,
                3 => 32,
                _ if !j.joined => 6,
                _ if self.boss_spawned => 28,
                _ => 27,
            };
            if self.spawn_cd <= 0. && !j.exit_open && self.enemies.len() < cap {
                let roll = self.random();
                let kind = if j.chapter >= 2 && j.joined && roll < 0.2 {
                    EnemyKind::Brute
                } else if j.chapter >= 1 && roll < 0.55 {
                    EnemyKind::Swift
                } else {
                    EnemyKind::Wolf
                };
                self.spawn(kind);
                self.spawn_cd = match j.chapter {
                    0 => 1.4,
                    1 => 0.95,
                    3 if !j.dragon_joined => 1.6,
                    3 => 0.7,
                    _ if !j.joined => 2.5,
                    _ => 0.65,
                };
            }
            if (j.chapter == 2 && j.joined && j.stage_time >= 60.
                || j.chapter == 3 && !j.dragon_joined && !j.dragon_defeated && self.elapsed >= 2.)
                && !self.boss_spawned
            {
                self.spawn(EnemyKind::Boss);
                if let Some(boss) = self.enemies.last_mut() {
                    let hp = if j.chapter == 3 { 1600. } else { 420. };
                    boss.hp = hp;
                    boss.max_hp = hp;
                    if j.chapter == 3 {
                        boss.pos = Point::new(2., 21.);
                    }
                }
                self.boss_spawned = true;
            }
            j.exit_open = match j.chapter {
                0 | 1 => j.stage_time >= j.duration(),
                3 => j.dragon_joined && j.stage_time >= j.duration(),
                _ => self.boss_defeated,
            };
        }
        self.wave = 1 + (j.stage_time / 20.) as u8;
        self.party_arts(dt, input, &mut j);
        self.party_links(dt, &mut j);
        self.party_enemies(dt, &mut j);
        self.separate_enemies(dt, Some(&j));

        let defeated = self
            .enemies
            .iter()
            .filter(|e| e.hp <= 0.)
            .map(|e| (e.pos, e.kind, e.region))
            .collect::<Vec<_>>();
        self.enemies.retain(|e| e.hp > 0.);
        for (pos, kind, region) in defeated {
            j.links.resonance =
                (j.links.resonance + if kind == EnemyKind::Boss { 25. } else { 6. }).min(100.);
            self.kills += 1;
            if kind == EnemyKind::Boss {
                if region == 2 || j.world.is_none() && j.chapter == 3 {
                    j.dragon_defeated = true;
                    j.trial_progress = 0.35;
                } else {
                    self.boss_defeated = true;
                }
            }
            self.drop_pickup(
                pos,
                match kind {
                    EnemyKind::Boss => 10,
                    EnemyKind::Brute => 4,
                    _ if j.chapter == 3 => 2,
                    _ => 1,
                },
                PickupKind::Wisdom,
            );
            if kind == EnemyKind::Brute || self.kills.is_multiple_of(15) {
                self.drop_pickup(pos, 1, PickupKind::Peach);
            }
        }
        if j.chapter == 3
            && !j.dragon_defeated
            && let Some(boss) = self.enemies.iter().find(|e| e.boss)
        {
            j.trial_progress = 0.05 + (1. - boss.hp / boss.max_hp) * 0.25;
        }
        if j.world.is_some() {
            self.world_events(&mut j, input, leader);
        }
        let party = points(self, &j);
        let mut gained = 0;
        let mut peaches = 0;
        for orb in &mut self.orbs {
            let target = party
                .iter()
                .enumerate()
                .filter(|(i, _)| j.available(*i as u8))
                .map(|(_, p)| *p)
                .min_by(|a, b| orb.pos.distance(*a).total_cmp(&orb.pos.distance(*b)))
                .expect("party leader");
            orb.attracted |= orb.pos.distance(target) < 5.5 + j.monk[3] as f32;
            if orb.attracted {
                orb.pos.towards(target, dt * 14.);
            }
            if orb.pos.distance(target) < 0.75 {
                match orb.kind {
                    PickupKind::Wisdom => gained += orb.value,
                    PickupKind::Peach => peaches += orb.value,
                }
                orb.value = 0;
            }
        }
        self.orbs.retain(|o| o.value > 0);
        self.xp += gained;
        self.master_hp = (self.master_hp + peaches as f32 * 16.).min(120.);
        self.hp = (self.hp + peaches as f32 * 16.).min(100.);
        j.dragon_hp = (j.dragon_hp + peaches as f32 * 16.).min(140.);
        if j.chapter == 2 {
            j.exit_open |= self.boss_defeated;
        }
        let clear = j.world.is_none()
            && j.exit_open
            && party[j.leader as usize].distance(j.exit_point()) < 3.;
        let failed = self.master_hp <= 0.
            || j.joined && self.hp <= 0.
            || j.dragon_joined && j.dragon_hp <= 0.;
        self.project_cooldowns(&j);
        self.journey = Some(j);
        self.journey_level();
        if failed {
            self.master_hp = self.master_hp.max(0.);
            self.hp = self.hp.max(0.);
            self.journey.as_mut().expect("journey").dragon_hp =
                self.journey.as_ref().expect("journey").dragon_hp.max(0.);
            self.phase = Phase::Lost;
        } else if clear && self.phase == Phase::Playing {
            self.phase = Phase::Won;
            let cp = self.waymark(
                self.journey.as_ref().expect("journey"),
                self.journey.as_ref().expect("journey").chapter + 1,
            );
            self.journey.as_mut().expect("journey").checkpoint = cp;
        }
    }
    fn project_cooldowns(&mut self, j: &Journey) {
        self.freeze_cd = j.primary[j.leader as usize];
        self.clone_cd = j.secondary[j.leader as usize];
    }

    fn party_arts(&mut self, dt: f32, input: Input, j: &mut Journey) {
        if j.chant_cd <= 0. {
            let radius = 4.5 + j.monk[0] as f32 * 0.3;
            if self
                .enemies
                .iter()
                .any(|e| e.pos.distance(self.master) < radius)
            {
                for e in &mut self.enemies {
                    if e.hp > 0. && e.pos.distance(self.master) < radius {
                        e.chant_mark = 2.5;
                    }
                }
                self.area_damage(self.master, radius, 17. + j.monk[0] as f32 * 7., 1.3);
                self.effect(self.master, radius, EffectKind::Chant);
                j.chant_cd = (1.4 - j.monk[0] as f32 * 0.09).max(0.85);
                j.monk_attack = 0.55;
            }
        }
        let close = self
            .enemies
            .iter()
            .any(|e| e.pos.distance(self.master) < 3.);
        if j.primary[0] <= 0. && (j.leader == 0 && input.freeze || j.leader != 0 && close) {
            j.monk_attack = 0.55;
            j.shield = 3. + j.monk[1] as f32 * 0.4;
            j.primary[0] = 12.;
            self.area_damage(self.master, 6., 8. + j.monk[0] as f32 * 4., 3.);
            self.effect(self.master, 6., EffectKind::Chant);
        }
        if j.secondary[0] <= 0. && j.leader == 0 && input.clone {
            self.master_hp = (self.master_hp + 18. + j.monk[2] as f32 * 4.).min(120.);
            self.hp = (self.hp + 18.).min(100.);
            j.dragon_hp = (j.dragon_hp + 18.).min(140.);
            j.secondary[0] = 20.;
            j.monk_attack = 0.55;
            self.effect(self.master, 5., EffectKind::Chant);
        }
        if j.healing_cd <= 0. {
            let heal = 0.8 + j.monk[2] as f32 * 1.8;
            self.master_hp = (self.master_hp + heal).min(120.);
            if j.joined && self.master.distance(self.hero) < 8. {
                self.hp = (self.hp + heal).min(100.);
            }
            if j.dragon_joined && self.master.distance(j.dragon_pos) < 8. {
                j.dragon_hp = (j.dragon_hp + heal).min(140.);
            }
            j.healing_cd = 2.5;
        }
        if j.joined {
            let near = self.enemies.iter().any(|e| e.pos.distance(self.hero) < 5.);
            if j.primary[1] <= 0. && (j.leader == 1 && input.freeze || j.leader != 1 && near) {
                for e in &mut self.enemies {
                    if e.pos.distance(self.hero) < 7. {
                        e.frozen = if e.boss {
                            0.6
                        } else {
                            1.5 + j.wukong[1] as f32 * 0.35
                        };
                    }
                }
                self.effect(self.hero, 7., EffectKind::Freeze);
                j.primary[1] = 13. - j.wukong[1] as f32;
            }
            if j.secondary[1] <= 0. && (j.leader == 1 && input.clone || j.wukong[2] > 0 && near) {
                self.clone_time = 3. + j.wukong[2] as f32;
                j.secondary[1] = 20. - j.wukong[2] as f32;
            }
            let reach = 3.8 + j.wukong[3] as f32 * 0.35;
            if self.attack_cd <= 0.
                && let Some(target) = self
                    .enemies
                    .iter()
                    .find(|e| e.hp > 0. && e.pos.distance(self.hero) < reach)
                    .map(|e| e.pos)
            {
                self.facing = (target.x - self.hero.x).atan2(target.z - self.hero.z);
                let damage = 27. + j.wukong[0] as f32 * 10.;
                self.area_damage(self.hero, reach, damage, 0.5);
                for e in &mut self.enemies {
                    if e.hp > 0. && e.pos.distance(self.hero) < reach + 0.6 {
                        e.staff_mark = 0.25;
                    }
                }
                self.attack_cd = (0.78 - j.wukong[0] as f32 * 0.055).max(0.45);
                self.attack = 0.28;
                if self.clone_time > 0. {
                    for clone in self.clone_points() {
                        self.area_damage(clone, 2.8, damage * 0.6, 0.3);
                    }
                }
            }
        }
        if j.dragon_joined {
            let near = self
                .enemies
                .iter()
                .any(|e| e.pos.distance(j.dragon_pos) < 5.);
            if j.primary[2] <= 0. && j.leader == 2 && input.freeze {
                j.dash = 0.35;
                j.primary[2] = 9. - j.dragon[1] as f32;
                self.area_damage(j.dragon_pos, 4., 35. + j.dragon[0] as f32 * 8., 2.);
                self.effect(j.dragon_pos, 4., EffectKind::Tide);
                j.dragon_attack = 0.55;
            }
            if j.secondary[2] <= 0. && (j.leader == 2 && input.clone || j.leader != 2 && near) {
                j.dragon_guard = 3. + j.dragon[2] as f32 * 0.4;
                j.secondary[2] = 18.;
                self.effect(j.dragon_pos, 5., EffectKind::Tide);
                j.dragon_attack = 0.55;
            }
            if j.hoof_cd <= 0. && near {
                self.area_damage(
                    j.dragon_pos,
                    3.2 + j.dragon[0] as f32 * 0.25,
                    22. + j.dragon[0] as f32 * 8.,
                    1.1,
                );
                self.effect(j.dragon_pos, 3.2, EffectKind::Tide);
                j.dragon_attack = 0.55;
                j.hoof_cd = 1.5;
            }
            if j.wave_cd <= 0.
                && self.bolts.len() < MAX_BOLTS
                && let Some(target) = self
                    .enemies
                    .iter()
                    .filter(|e| e.hp > 0. && e.pos.distance(j.dragon_pos) < 15.)
                    .min_by(|a, b| {
                        a.pos
                            .distance(j.dragon_pos)
                            .total_cmp(&b.pos.distance(j.dragon_pos))
                    })
                    .map(|e| e.pos)
            {
                let d = target.distance(j.dragon_pos).max(0.01);
                let id = self.id();
                self.bolts.push(Bolt {
                    id,
                    pos: j.dragon_pos,
                    velocity: Point::new(
                        (target.x - j.dragon_pos.x) / d * 14.,
                        (target.z - j.dragon_pos.z) / d * 14.,
                    ),
                    remaining: 1.4,
                    damage: 24. + j.dragon[3] as f32 * 9.,
                    evolved: false,
                    water: true,
                });
                j.wave_cd = (2. - j.dragon[3] as f32 * 0.18).max(1.);
            }
        }
        let mut hits = vec![];
        for bolt in &mut self.bolts {
            let previous = bolt.pos;
            bolt.pos.x += bolt.velocity.x * dt;
            bolt.pos.z += bolt.velocity.z * dt;
            bolt.remaining -= dt;
            if let Some(enemy) = self
                .enemies
                .iter_mut()
                .find(|e| e.hp > 0. && segment_distance(e.pos, previous, bolt.pos) < 0.9)
            {
                enemy.hp -= bolt.damage;
                enemy.tide_mark = 2.5;
                enemy.hit = 0.16;
                bolt.remaining = 0.;
                hits.push(enemy.pos);
            }
        }
        self.bolts.retain(|b| b.remaining > 0.);
        for p in hits {
            self.effect(p, 1., EffectKind::Tide);
        }
    }

    fn party_enemies(&mut self, dt: f32, j: &mut Journey) {
        let party = points(self, j);
        let leader = party[j.leader as usize];
        let mut zones = vec![];
        let mut damage = vec![];
        for enemy in &mut self.enemies {
            enemy.frozen = (enemy.frozen - dt).max(0.);
            enemy.hit = (enemy.hit - dt).max(0.);
            enemy.cooldown = (enemy.cooldown - dt).max(0.);
            enemy.orbit_cd = (enemy.orbit_cd - dt).max(0.);
            if enemy.boss && j.world.is_some() && leader.distance(enemy.home) > 22. {
                enemy.pos.towards(enemy.home, dt * 5.);
                enemy.windup = 0.;
                continue;
            }
            if enemy.hp <= 0. || enemy.frozen > 0. {
                continue;
            }
            let target = party
                .iter()
                .enumerate()
                .filter(|(i, _)| j.available(*i as u8))
                .min_by(|(_, a), (_, b)| {
                    enemy.pos.distance(**a).total_cmp(&enemy.pos.distance(**b))
                })
                .map(|(_, p)| *p)
                .expect("party");
            if (enemy.region == 2 || j.world.is_none() && j.chapter == 3)
                && (enemy.boss || enemy.kind == EnemyKind::Brute || enemy.kind == EnemyKind::Swift)
            {
                if enemy.windup > 0. {
                    enemy.windup -= dt;
                    if enemy.windup <= 0. {
                        enemy.cooldown = if enemy.boss { 3.4 } else { 4.5 };
                        if enemy.kind == EnemyKind::Swift {
                            enemy.orbit_cd = 0.6;
                        }
                    }
                } else if enemy.cooldown <= 0. && enemy.pos.distance(leader) < 16. {
                    enemy.windup = 1.05;
                    enemy.strike = leader;
                    zones.push((leader, if enemy.boss { 2.8 } else { 2.1 }));
                    if enemy.boss {
                        zones.push((Point::new(leader.x + 3.5, leader.z + 1.), 2.2));
                    }
                } else {
                    let speed = if enemy.orbit_cd > 0. {
                        8.
                    } else if enemy.kind == EnemyKind::Brute {
                        1.5
                    } else {
                        2.6
                    };
                    let goal = if enemy.orbit_cd > 0. {
                        enemy.strike
                    } else if enemy.kind == EnemyKind::Brute && enemy.pos.distance(leader) < 5. {
                        Point::new(
                            enemy.pos.x + (enemy.pos.x - leader.x),
                            enemy.pos.z + (enemy.pos.z - leader.z),
                        )
                    } else {
                        target
                    };
                    enemy.pos.towards(goal, speed * dt);
                }
            } else if enemy.boss && enemy.windup > 0. {
                enemy.windup -= dt;
                if enemy.windup <= 0. {
                    for (i, p) in party.iter().enumerate() {
                        if p.distance(enemy.strike) < 3.8 {
                            damage.push((i, 16.));
                        }
                    }
                    enemy.cooldown = 3.5;
                }
            } else if enemy.boss && enemy.cooldown <= 0. && enemy.pos.distance(target) < 6. {
                enemy.strike = target;
                enemy.windup = 1.1;
            } else {
                enemy.pos.towards(
                    target,
                    dt * match enemy.kind {
                        EnemyKind::Wolf => 2.2,
                        EnemyKind::Swift => 3.8,
                        EnemyKind::Brute => 1.6,
                        EnemyKind::Boss => 2.1,
                    },
                );
            }
            for (i, p) in party.iter().enumerate() {
                if p.distance(enemy.pos) < 0.95 {
                    damage.push((i, if j.chapter == 0 { 4. } else { 7. }));
                }
            }
        }
        for (pos, radius) in zones {
            if j.zones.len() < 8 {
                let id = self.id();
                j.zones.push(TideZone {
                    id,
                    pos,
                    radius,
                    delay: 1.05,
                    remaining: 1.35,
                    struck: false,
                });
            }
        }
        for zone in &mut j.zones {
            zone.delay = (zone.delay - dt).max(0.);
            zone.remaining -= dt;
            if zone.delay <= 0. && !zone.struck {
                zone.struck = true;
                for (i, p) in party.iter().enumerate() {
                    if p.distance(zone.pos) < zone.radius {
                        damage.push((i, 14.));
                    }
                }
            }
        }
        j.zones.retain(|z| z.remaining > 0.);
        if j.chapter == 3 && j.water_tick <= 0. {
            for (i, p) in party.iter().enumerate() {
                if i != 2 && j.water(*p) && j.dragon_guard <= 0. {
                    damage.push((i, 4.));
                }
            }
            j.water_tick = 1.;
        }
        for (member, amount) in damage {
            self.party_damage(j, member, amount);
        }
    }
}
