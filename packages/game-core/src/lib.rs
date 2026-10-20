//! Browser-independent Journey to the West simulation. All distances are metres.
use serde::{Deserialize, Serialize};
mod expedition;
pub mod shadow_combat;
pub use expedition::map_chart;
mod journey;
pub use expedition::{
    CHUNK_SIZE, Expedition, MapGrid, MapLandmark, MapProp, MapRegion, map_anchor_x,
    map_field_sample, map_flora, map_grid, map_ground_mask, map_ground_sample, map_height,
    map_landmarks, map_passable, map_props, map_region, map_regions, map_river_course,
    map_river_half_width, map_sites, map_surface_height, map_water,
};
mod links;
mod navigation;
mod river_combat;
mod separation;
mod terrain_grid;
pub use terrain_grid::TerrainGrid;
#[rustfmt::skip]
mod terrain_profile;
pub use terrain_profile::{river_center, river_width, terrain_height, valley_center, valley_width};
#[rustfmt::skip]
mod world_props_profile;
#[cfg(feature = "crowd-benchmark")]
mod crowd_benchmark;
pub use world_props_profile::world_props;
#[rustfmt::skip]
mod world_layout_profile;
pub use world_layout_profile::{WORLD_STONES, WorldStone};
mod world_collision;
pub use world_collision::WorldObstacle;
mod westward;
pub use westward::{LinkState, WorldState};
#[cfg(test)]
mod terrain_tests;
#[cfg(test)]
mod world_tests;
pub use journey::{Journey, JourneyCheckpoint};

pub const TALENT_COUNT: usize = 8;
pub const MAX_RANK: u8 = 5;
pub const MAX_ENEMIES: usize = 42;
pub const MAX_ORBS: usize = 128;
pub const MAX_BOLTS: usize = 16;
pub const MAX_EFFECTS: usize = 24;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Point {
    pub x: f32,
    pub z: f32,
}
impl Point {
    pub fn new(x: f32, z: f32) -> Self {
        Self { x, z }
    }
    pub fn distance(self, other: Self) -> f32 {
        ((self.x - other.x).powi(2) + (self.z - other.z).powi(2)).sqrt()
    }
    fn towards(&mut self, other: Self, distance: f32) {
        let d = self.distance(other);
        if d > 0.001 {
            let t = (distance / d).min(1.);
            self.x += (other.x - self.x) * t;
            self.z += (other.z - self.z) * t;
        }
    }
}
#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(default)]
pub struct Input {
    pub x: f32,
    pub z: f32,
    pub freeze: bool,
    pub clone: bool,
    pub action: u8,
    pub choice: u8,
    pub member: u8,
    pub checkpoint: Option<JourneyCheckpoint>,
    pub map_position: Option<Point>,
    pub map_visited: u32,
    pub map_target: u8,
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Menu,
    Playing,
    Upgrade,
    Paused,
    Won,
    Lost,
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EnemyKind {
    Wolf,
    Swift,
    Brute,
    Boss,
}
#[derive(Clone, Debug)]
pub struct Enemy {
    pub id: u32,
    pub kind: EnemyKind,
    pub pos: Point,
    pub hp: f32,
    pub max_hp: f32,
    pub boss: bool,
    pub frozen: f32,
    pub hit: f32,
    pub orbit_cd: f32,
    pub cooldown: f32,
    pub windup: f32,
    pub strike: Point,
    pub region: u8,
    pub home: Point,
    pub chant_mark: f32,
    pub staff_mark: f32,
    pub tide_mark: f32,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PickupKind {
    Wisdom,
    Peach,
}
#[derive(Clone, Debug)]
pub struct Orb {
    pub id: u32,
    pub pos: Point,
    pub value: u32,
    pub kind: PickupKind,
    pub attracted: bool,
}
#[derive(Clone, Debug)]
pub struct Bolt {
    pub id: u32,
    pub pos: Point,
    pub velocity: Point,
    pub remaining: f32,
    pub damage: f32,
    pub evolved: bool,
    pub water: bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EffectKind {
    Hit,
    Freeze,
    Flame,
    Chant,
    Tide,
    Link,
}
#[derive(Clone, Debug)]
pub struct Effect {
    pub id: u32,
    pub pos: Point,
    pub radius: f32,
    pub remaining: f32,
    pub duration: f32,
    pub kind: EffectKind,
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EscortState {
    Advancing,
    Waiting,
    Blocked,
}
#[derive(Clone, Debug)]
pub struct Run {
    pub expedition: Option<Expedition>,
    pub journey: Option<Journey>,
    pub phase: Phase,
    pub hero: Point,
    pub master: Point,
    pub hp: f32,
    pub master_hp: f32,
    pub elapsed: f32,
    pub kills: u32,
    pub level: u32,
    pub xp: u32,
    pub next_xp: u32,
    pub talents: [u8; TALENT_COUNT],
    pub choices: [u8; 3],
    pub enemies: Vec<Enemy>,
    pub orbs: Vec<Orb>,
    pub bolts: Vec<Bolt>,
    pub effects: Vec<Effect>,
    pub attack: f32,
    pub facing: f32,
    pub freeze_cd: f32,
    pub clone_cd: f32,
    pub clone_time: f32,
    pub boss_spawned: bool,
    pub boss_defeated: bool,
    pub event_id: u32,
    pub hurt: f32,
    pub master_hurt: f32,
    attack_cd: f32,
    fire_cd: f32,
    spawn_cd: f32,
    wave: u8,
    wave_pending: u8,
    contact_cd: f32,
    master_contact_cd: f32,
    recovery_cd: f32,
    seed: u32,
    next_id: u32,
    crowd: separation::CrowdScratch,
}
impl Default for Run {
    fn default() -> Self {
        Self::new(0x65786a71)
    }
}
impl Run {
    pub const ROUTE: f32 = 64.;
    pub const BOSS_HP: f32 = 1200.;
    pub const BOSS_TIME: f32 = 150.;
    pub fn new(seed: u32) -> Self {
        Self {
            expedition: None,
            journey: None,
            phase: Phase::Menu,
            hero: Point::new(0., 3.),
            master: Point::new(0., 0.),
            hp: 100.,
            master_hp: 120.,
            elapsed: 0.,
            kills: 0,
            level: 1,
            xp: 0,
            next_xp: 4,
            talents: [0; TALENT_COUNT],
            choices: [0, 4, 5],
            enemies: vec![],
            orbs: vec![],
            bolts: vec![],
            effects: vec![],
            attack: 0.,
            facing: 0.,
            freeze_cd: 0.,
            clone_cd: 0.,
            clone_time: 0.,
            boss_spawned: false,
            boss_defeated: false,
            event_id: 0,
            hurt: 0.,
            master_hurt: 0.,
            attack_cd: 0.,
            fire_cd: 0.,
            spawn_cd: 0.35,
            wave: 1,
            wave_pending: 0,
            contact_cd: 0.,
            master_contact_cd: 0.,
            recovery_cd: 0.,
            seed,
            next_id: 1,
            crowd: separation::CrowdScratch::default(),
        }
    }
    fn random(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed >> 8) as f32 / 16777216.
    }
    fn id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }
    pub fn evolutions(&self) -> [bool; 3] {
        [
            self.talents[0] >= 3 && self.talents[1] >= 3,
            self.talents[4] >= 3 && self.talents[6] >= 3,
            self.talents[5] >= 3 && self.talents[7] >= 3,
        ]
    }
    pub fn range(&self) -> f32 {
        if let Some(journey) = &self.journey {
            return 3.8 + journey.wukong[3] as f32 * 0.35;
        }
        3.8 + self.talents[1] as f32 * 0.55 + if self.evolutions()[0] { 1. } else { 0. }
    }
    pub fn pickup_range(&self) -> f32 {
        4.8 + self.talents[6] as f32 * 1.2
    }
    pub fn progress(&self) -> f32 {
        if let Some(journey) = &self.journey {
            return if self.phase == Phase::Won {
                1.
            } else {
                journey.progress(self.leader_point())
            };
        }
        (self.master.z / Self::ROUTE).clamp(0., 1.)
    }
    pub fn escort_state(&self) -> EscortState {
        if self.hero.distance(self.master) > 12. {
            EscortState::Waiting
        } else if self
            .enemies
            .iter()
            .any(|e| e.pos.distance(self.master) < 2.3)
        {
            EscortState::Blocked
        } else {
            EscortState::Advancing
        }
    }
    pub fn clone_points(&self) -> [Point; 2] {
        std::array::from_fn(|i| {
            let angle = self.elapsed * 2. + i as f32 * std::f32::consts::PI;
            Point::new(
                self.hero.x + angle.cos() * 2.2,
                self.hero.z + angle.sin() * 2.2,
            )
        })
    }
    pub fn orbit_points(&self) -> Vec<Point> {
        let rank = self.talents[5];
        if rank == 0 {
            return vec![];
        }
        let evolved = self.evolutions()[2];
        let count = if evolved {
            4
        } else {
            2 + usize::from(rank >= 3) + usize::from(rank >= 5)
        };
        let radius = if evolved { 3.4 } else { 2.6 };
        (0..count)
            .map(|i| {
                let angle = self.elapsed * 2.6 + i as f32 * std::f32::consts::TAU / count as f32;
                Point::new(
                    self.hero.x + angle.cos() * radius,
                    self.hero.z + angle.sin() * radius,
                )
            })
            .collect()
    }
    pub fn choose(&mut self, index: usize) {
        if self.journey.is_some() {
            self.choose_journey(index);
            return;
        }
        if self.phase != Phase::Upgrade || index >= 3 {
            return;
        }
        let talent = self.choices[index] as usize;
        if talent >= TALENT_COUNT || (talent != 3 && self.talents[talent] >= MAX_RANK) {
            return;
        }
        self.talents[talent] = self.talents[talent].saturating_add(1);
        if talent == 3 {
            self.hp = (self.hp + 30.).min(100.);
            self.master_hp = (self.master_hp + 40.).min(120.);
        }
        self.phase = Phase::Playing;
        // A large pickup can fund several levels; each still gets its own choice.
        self.check_level();
    }
    fn check_level(&mut self) {
        if self.phase != Phase::Playing || self.xp < self.next_xp {
            return;
        }
        self.xp -= self.next_xp;
        self.level += 1;
        self.next_xp += 3;
        let mut pool = if self.level == 2 {
            vec![0, 4, 5]
        } else {
            (0..TALENT_COUNT as u8)
                .filter(|i| *i == 3 || self.talents[*i as usize] < MAX_RANK)
                .collect::<Vec<_>>()
        };
        // Seeded sampling without replacement. Capped arts never occupy a card.
        for i in (1..pool.len()).rev() {
            let j = (self.random() * (i + 1) as f32) as usize;
            pool.swap(i, j);
        }
        self.choices = std::array::from_fn(|i| *pool.get(i).unwrap_or(&3));
        self.phase = Phase::Upgrade;
    }
    fn effect(&mut self, pos: Point, radius: f32, kind: EffectKind) {
        if self.effects.len() >= MAX_EFFECTS {
            return;
        }
        let duration = match kind {
            EffectKind::Hit => 0.18,
            EffectKind::Freeze => 0.45,
            EffectKind::Flame => 0.3,
            EffectKind::Chant => 0.65,
            EffectKind::Tide => 0.7,
            EffectKind::Link => 0.8,
        };
        let id = self.id();
        self.effects.push(Effect {
            id,
            pos,
            radius,
            remaining: duration,
            duration,
            kind,
        });
    }
    fn area_damage(&mut self, pos: Point, radius: f32, damage: f32, knockback: f32) {
        let mut impacts = vec![];
        for enemy in &mut self.enemies {
            if enemy.hp > 0. && enemy.pos.distance(pos) < radius {
                enemy.hp -= damage;
                enemy.hit = 0.16;
                impacts.push(enemy.pos);
                enemy.pos.towards(
                    pos,
                    -if enemy.boss {
                        knockback * 0.15
                    } else {
                        knockback
                    },
                );
            }
        }
        for hit in impacts {
            self.effect(hit, 0.5, EffectKind::Hit);
        }
    }
    fn spawn(&mut self, kind: EnemyKind) {
        if self.enemies.len() >= MAX_ENEMIES {
            return;
        }
        let center = Point::new(
            (self.hero.x + self.master.x) * 0.5,
            (self.hero.z + self.master.z) * 0.5,
        );
        let mut pos = Point::new(center.x, (center.z + 15.).min(Self::ROUTE + 16.));
        for _ in 0..12 {
            let angle = self.random() * std::f32::consts::TAU;
            let candidate = Point::new(
                (center.x + angle.cos() * 15.).clamp(-18., 18.),
                (center.z + angle.sin() * 15.).clamp(-12., Self::ROUTE + 16.),
            );
            if candidate.distance(self.hero) > 8. && candidate.distance(self.master) > 8. {
                pos = candidate;
                break;
            }
        }
        let hp = match kind {
            EnemyKind::Wolf => 16. + self.elapsed * 0.07,
            EnemyKind::Swift => 12. + self.elapsed * 0.045,
            EnemyKind::Brute => 75. + self.elapsed * 0.25,
            EnemyKind::Boss => Self::BOSS_HP,
        };
        let id = self.id();
        self.enemies.push(Enemy {
            id,
            kind,
            pos,
            hp,
            max_hp: hp,
            boss: kind == EnemyKind::Boss,
            frozen: 0.,
            hit: 0.,
            orbit_cd: 0.,
            cooldown: 2.5,
            windup: 0.,
            strike: Point::default(),
            region: 0,
            home: pos,
            chant_mark: 0.,
            staff_mark: 0.,
            tide_mark: 0.,
        });
    }
    fn spawn_waves(&mut self, dt: f32) {
        let wave = (1 + (self.elapsed / 30.) as u8).min(6);
        if wave > self.wave {
            self.wave = wave;
            self.wave_pending = if wave < 6 { 5 + wave } else { 0 };
        }
        if !self.boss_spawned && self.elapsed >= Self::BOSS_TIME {
            // Reserve the last actor slot for the boss even under maximum pressure.
            if self.enemies.len() < MAX_ENEMIES {
                self.spawn(EnemyKind::Boss);
                self.boss_spawned = true;
            }
        }
        self.spawn_cd -= dt;
        let limit = if self.boss_spawned {
            MAX_ENEMIES
        } else {
            MAX_ENEMIES - 1
        };
        if self.spawn_cd <= 0. && self.enemies.len() < limit {
            let roll = self.random();
            let kind = if self.elapsed >= 60. && roll < 0.12 {
                EnemyKind::Brute
            } else if self.elapsed >= 30. && roll < 0.4 {
                EnemyKind::Swift
            } else {
                EnemyKind::Wolf
            };
            self.spawn(kind);
            self.spawn_cd = if self.wave_pending > 0 {
                self.wave_pending -= 1;
                0.14
            } else {
                (0.72 - self.elapsed * 0.0025).max(0.28)
            };
        }
    }
    fn drop_pickup(&mut self, pos: Point, value: u32, kind: PickupKind) {
        if self.orbs.len() >= MAX_ORBS {
            if let Some(orb) = self
                .orbs
                .iter_mut()
                .filter(|o| o.kind == kind)
                .min_by(|a, b| a.pos.distance(pos).total_cmp(&b.pos.distance(pos)))
            {
                orb.value += value;
                return;
            }
            // Keep the total bounded, preserving the wisdom of an existing pickup.
            if let Some(orb) = self.orbs.first_mut() {
                orb.value += value;
            }
            return;
        }
        let id = self.id();
        self.orbs.push(Orb {
            id,
            pos,
            value,
            kind,
            attracted: false,
        });
    }
    fn fire(&mut self, dt: f32) {
        if self.talents[4] > 0 && self.fire_cd <= 0. {
            let mut targets = self
                .enemies
                .iter()
                .filter(|e| e.hp > 0. && e.pos.distance(self.hero) < 15.)
                .collect::<Vec<_>>();
            targets.sort_by(|a, b| {
                a.pos
                    .distance(self.hero)
                    .total_cmp(&b.pos.distance(self.hero))
            });
            let count = if self.talents[4] >= 3 { 2 } else { 1 };
            let targets = targets
                .into_iter()
                .take(count)
                .map(|e| e.pos)
                .collect::<Vec<_>>();
            if !targets.is_empty() {
                self.fire_cd = 1.35 - self.talents[4] as f32 * 0.1;
                for target in targets {
                    if self.bolts.len() >= MAX_BOLTS {
                        break;
                    }
                    let distance = self.hero.distance(target).max(0.01);
                    let id = self.id();
                    self.bolts.push(Bolt {
                        id,
                        pos: self.hero,
                        water: false,
                        velocity: Point::new(
                            (target.x - self.hero.x) / distance * 14.,
                            (target.z - self.hero.z) / distance * 14.,
                        ),
                        remaining: 1.6,
                        damage: 22. + self.talents[4] as f32 * 8.,
                        evolved: self.evolutions()[1],
                    });
                }
            }
        }
        let mut impacts = vec![];
        for bolt in &mut self.bolts {
            let before = bolt.pos;
            bolt.pos.x += bolt.velocity.x * dt;
            bolt.pos.z += bolt.velocity.z * dt;
            bolt.remaining -= dt;
            let hit = self
                .enemies
                .iter_mut()
                .filter(|e| {
                    e.hp > 0.
                        && segment_distance(e.pos, before, bolt.pos)
                            < if e.boss { 1.4 } else { 0.85 }
                })
                .min_by(|a, b| a.pos.distance(before).total_cmp(&b.pos.distance(before)));
            if let Some(enemy) = hit {
                enemy.hp -= bolt.damage;
                enemy.hit = 0.16;
                impacts.push((enemy.pos, bolt.damage, bolt.evolved));
                bolt.remaining = 0.;
            }
        }
        self.bolts.retain(|b| b.remaining > 0.);
        for (pos, damage, evolved) in impacts {
            if evolved {
                self.area_damage(pos, 2.5, damage * 0.65, 0.35);
            }
            self.effect(pos, if evolved { 2.5 } else { 0.65 }, EffectKind::Flame);
        }
    }
    pub fn step(&mut self, dt: f32, input: Input) {
        if input.action == 11 || self.expedition.is_some() {
            self.step_expedition(dt, input);
            return;
        }
        if input.action == 5
            && matches!(
                self.phase,
                Phase::Menu | Phase::Won | Phase::Lost | Phase::Paused
            )
        {
            *self = Self::new_journey(self.seed, input.checkpoint.unwrap_or_default());
            return;
        }
        if self.journey.is_some() {
            self.step_journey(dt, input);
            return;
        }
        match input.action {
            1 => {
                let seed = self.seed;
                *self = Self::new(seed);
                self.phase = Phase::Playing;
            }
            2 if self.phase == Phase::Playing => self.phase = Phase::Paused,
            3 if self.phase == Phase::Paused => self.phase = Phase::Playing,
            4 => self.choose(input.choice as usize),
            _ => {}
        }
        if self.phase != Phase::Playing {
            return;
        }
        let dt = if dt.is_finite() {
            dt.clamp(0., 0.05)
        } else {
            0.
        };
        self.elapsed += dt;
        for timer in [
            &mut self.attack,
            &mut self.freeze_cd,
            &mut self.clone_cd,
            &mut self.clone_time,
            &mut self.attack_cd,
            &mut self.fire_cd,
            &mut self.contact_cd,
            &mut self.master_contact_cd,
            &mut self.recovery_cd,
            &mut self.hurt,
            &mut self.master_hurt,
        ] {
            *timer = (*timer - dt).max(0.);
        }
        for effect in &mut self.effects {
            effect.remaining -= dt;
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
        let speed = 7. + self.talents[6] as f32 * 0.25;
        self.hero.x = (self.hero.x + x / magnitude * speed * dt).clamp(-14., 14.);
        self.hero.z = (self.hero.z + z / magnitude * speed * dt).clamp(-6., Self::ROUTE + 10.);
        if x.abs() + z.abs() > 0.01 {
            self.facing = x.atan2(z);
        }
        if self.escort_state() == EscortState::Advancing {
            self.master.z = (self.master.z + 0.52 * dt).min(Self::ROUTE);
            self.master.x = (self.master.z * 0.13).sin() * 2.;
        }
        if self.recovery_cd <= 0.
            && self.hero.distance(self.master) < 7.
            && !self
                .enemies
                .iter()
                .any(|e| e.pos.distance(self.master) < 3.)
        {
            self.master_hp = (self.master_hp + dt * 1.5).min(120.);
        }
        if input.freeze && self.freeze_cd <= 0. {
            self.freeze_cd = 12.;
            self.event_id += 1;
            for e in &mut self.enemies {
                if e.pos.distance(self.hero) < 10. {
                    e.frozen = if e.boss { 1.5 } else { 4. };
                }
            }
            self.effect(self.hero, 10., EffectKind::Freeze);
        }
        if input.clone && self.clone_cd <= 0. {
            self.clone_time = 5. + self.talents[2] as f32;
            self.clone_cd = 18. - self.talents[2] as f32 * 0.8;
            self.event_id += 1;
        }
        self.spawn_waves(dt);
        let mitigation = 1. - self.talents[7] as f32 * 0.1;
        for e in &mut self.enemies {
            e.frozen = (e.frozen - dt).max(0.);
            e.cooldown = (e.cooldown - dt).max(0.);
            e.hit = (e.hit - dt).max(0.);
            e.orbit_cd = (e.orbit_cd - dt).max(0.);
            if e.frozen > 0. {
                continue;
            }
            // Wolves pursue Wukong; heavy guards threaten the pilgrim when left unattended.
            let target = if e.kind == EnemyKind::Brute
                && e.pos.distance(self.master) < e.pos.distance(self.hero)
            {
                self.master
            } else {
                self.hero
            };
            if e.boss && e.windup > 0. {
                e.windup -= dt;
                if e.windup <= 0. {
                    if self.hero.distance(e.strike) < 3.8 {
                        self.hp -= 28. * mitigation;
                        self.hurt = 0.4;
                    }
                    if self.master.distance(e.strike) < 3.8 {
                        self.master_hp -= 20. * mitigation;
                        self.master_hurt = 0.4;
                        self.recovery_cd = 6.;
                    }
                    e.cooldown = 3.;
                }
            } else if e.boss && e.cooldown <= 0. && e.pos.distance(target) < 7. {
                e.windup = 1.3;
                e.strike = target;
            } else {
                let speed = match e.kind {
                    EnemyKind::Wolf => 1.7 + (self.elapsed * 0.003).min(0.5),
                    EnemyKind::Swift => 3.1,
                    EnemyKind::Brute => 1.3,
                    EnemyKind::Boss => 2.2,
                };
                e.pos.towards(target, dt * speed);
                if !e.boss {
                    let damage = if e.kind == EnemyKind::Brute { 12. } else { 7. } * mitigation;
                    if self.contact_cd <= 0. && e.pos.distance(self.hero) < 0.95 {
                        self.hp -= damage;
                        self.contact_cd = 0.55;
                        self.hurt = 0.3;
                    }
                    if self.master_contact_cd <= 0. && e.pos.distance(self.master) < 0.9 {
                        self.master_hp -= damage * 0.8;
                        self.master_contact_cd = 0.65;
                        self.master_hurt = 0.3;
                        self.recovery_cd = 6.;
                    }
                }
            }
        }
        self.separate_enemies(dt, None);
        if self.attack_cd <= 0. {
            let nearest = self
                .enemies
                .iter()
                .filter(|e| e.pos.distance(self.hero) < self.range())
                .min_by(|a, b| {
                    a.pos
                        .distance(self.hero)
                        .total_cmp(&b.pos.distance(self.hero))
                })
                .map(|e| e.pos);
            if let Some(target) = nearest {
                let damage = (18. + self.talents[0] as f32 * 8.)
                    * if self.evolutions()[0] { 1.5 } else { 1. };
                self.attack = 0.28;
                self.facing = (target.x - self.hero.x).atan2(target.z - self.hero.z);
                self.attack_cd = (0.78 - self.talents[0] as f32 * 0.065).max(0.38);
                self.event_id += 1;
                self.area_damage(self.hero, self.range(), damage, 0.5);
                if self.clone_time > 0. {
                    for clone in self.clone_points() {
                        self.area_damage(
                            clone,
                            2.8,
                            damage * (0.55 + self.talents[2] as f32 * 0.08),
                            0.2,
                        );
                    }
                }
            }
        }
        self.fire(dt);
        let wheels = self.orbit_points();
        let evolved = self.evolutions()[2];
        let mut impacts = vec![];
        for e in &mut self.enemies {
            if e.hp > 0.
                && e.orbit_cd <= 0.
                && wheels
                    .iter()
                    .any(|p| e.pos.distance(*p) < if evolved { 1.25 } else { 0.9 })
            {
                e.hp -= (9. + self.talents[5] as f32 * 5.) * if evolved { 1.5 } else { 1. };
                e.hit = 0.16;
                e.orbit_cd = 0.5;
                impacts.push(e.pos);
            }
        }
        for p in impacts {
            self.effect(p, 0.5, EffectKind::Hit);
        }
        let defeated = self
            .enemies
            .iter()
            .filter(|e| e.hp <= 0.)
            .map(|e| (e.pos, e.kind))
            .collect::<Vec<_>>();
        self.enemies.retain(|e| e.hp > 0.);
        for (pos, kind) in defeated {
            self.kills += 1;
            if kind == EnemyKind::Boss {
                self.boss_defeated = true;
            } else {
                self.drop_pickup(
                    pos,
                    if kind == EnemyKind::Brute { 5 } else { 1 },
                    PickupKind::Wisdom,
                );
                if kind == EnemyKind::Brute || self.kills.is_multiple_of(35) {
                    self.drop_pickup(pos, 1, PickupKind::Peach);
                }
            }
        }
        let pickup_range = self.pickup_range();
        for orb in &mut self.orbs {
            orb.attracted |= orb.pos.distance(self.hero) < pickup_range;
            if orb.attracted {
                orb.pos.towards(self.hero, dt * 13.);
            }
        }
        let mut gained = 0;
        let mut peaches = 0;
        self.orbs.retain(|orb| {
            let collect = orb.pos.distance(self.hero) < 0.75;
            if collect {
                match orb.kind {
                    PickupKind::Wisdom => gained += orb.value,
                    PickupKind::Peach => peaches += orb.value,
                }
            }
            !collect
        });
        self.xp += gained;
        self.hp = (self.hp + peaches as f32 * 18.).min(100.);
        self.master_hp = (self.master_hp + peaches as f32 * 12.).min(120.);
        self.check_level();
        if self.hp <= 0. || self.master_hp <= 0. {
            self.hp = self.hp.max(0.);
            self.master_hp = self.master_hp.max(0.);
            self.phase = Phase::Lost;
        } else if self.boss_defeated && self.progress() >= 1. {
            self.phase = Phase::Won;
        }
    }
    pub fn snapshot(&self, ready: bool) -> Snapshot {
        Snapshot {
            expedition: self.expedition.clone(),
            journey: self.journey.clone(),
            ready,
            phase: self.phase,
            hero: self.hero,
            master: self.master,
            hp: self.hp,
            master_hp: self.master_hp,
            elapsed: self.elapsed,
            kills: self.kills,
            level: self.level,
            xp: self.xp,
            next_xp: self.next_xp,
            progress: self.progress(),
            talents: self.talents,
            choices: self.choices,
            evolutions: self.evolutions(),
            freeze_cd: self.freeze_cd,
            clone_cd: self.clone_cd,
            boss_hp: self.enemies.iter().find(|e| e.boss).map(|e| e.hp),
            boss_max_hp: if self.journey.as_ref().is_some_and(|j| j.chapter == 3) {
                1600.
            } else if self.journey.is_some() {
                420.
            } else {
                Self::BOSS_HP
            },
            boss_strike: self
                .enemies
                .iter()
                .find(|e| e.boss && e.windup > 0.)
                .map(|e| e.strike),
            event_id: self.event_id,
            wave: self.wave,
            next_wave_in: if self.boss_spawned {
                0.
            } else {
                (self.wave as f32 * 30. - self.elapsed).max(0.)
            },
            escort_state: self.escort_state(),
            enemies: self.enemies.len(),
        }
    }
}
fn segment_distance(point: Point, start: Point, end: Point) -> f32 {
    let dx = end.x - start.x;
    let dz = end.z - start.z;
    let t = (((point.x - start.x) * dx + (point.z - start.z) * dz)
        / (dx * dx + dz * dz).max(0.000001))
    .clamp(0., 1.);
    point.distance(Point::new(start.x + dx * t, start.z + dz * t))
}
#[derive(Serialize)]
pub struct Snapshot {
    pub expedition: Option<Expedition>,
    pub journey: Option<Journey>,
    pub ready: bool,
    pub phase: Phase,
    pub hero: Point,
    pub master: Point,
    pub hp: f32,
    pub master_hp: f32,
    pub elapsed: f32,
    pub kills: u32,
    pub level: u32,
    pub xp: u32,
    pub next_xp: u32,
    pub progress: f32,
    pub talents: [u8; TALENT_COUNT],
    pub choices: [u8; 3],
    pub evolutions: [bool; 3],
    pub freeze_cd: f32,
    pub clone_cd: f32,
    pub boss_hp: Option<f32>,
    pub boss_max_hp: f32,
    pub boss_strike: Option<Point>,
    pub event_id: u32,
    pub wave: u8,
    pub next_wave_in: f32,
    pub escort_state: EscortState,
    pub enemies: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn started(seed: u32) -> Run {
        let mut r = Run::new(seed);
        r.step(
            0.,
            Input {
                action: 1,
                ..Default::default()
            },
        );
        r
    }
    #[test]
    fn pause_and_upgrade_freeze_all_combat() {
        let mut r = started(1);
        r.step(
            0.05,
            Input {
                action: 2,
                ..Default::default()
            },
        );
        let t = r.elapsed;
        r.step(
            0.05,
            Input {
                x: 1.,
                freeze: true,
                ..Default::default()
            },
        );
        assert_eq!(r.elapsed, t);
        assert_eq!(r.hero.x, 0.);
        assert_eq!(r.freeze_cd, 0.);
        r.phase = Phase::Upgrade;
        r.choices = [3, 0, 1];
        r.master_hp = 70.;
        r.step(
            0.05,
            Input {
                x: 1.,
                ..Default::default()
            },
        );
        assert_eq!(r.elapsed, t);
        r.choose(0);
        assert_eq!(r.master_hp, 110.);
        assert_eq!(r.talents[3], 1);
        assert_eq!(r.phase, Phase::Playing);
    }
    #[test]
    fn escort_requires_nearby_hero_and_clear_path() {
        let mut r = started(1);
        r.hero.z = 20.;
        r.step(0.05, Input::default());
        assert_eq!(r.master.z, 0.);
        assert_eq!(r.escort_state(), EscortState::Waiting);
        r.hero.z = 3.;
        r.step(0.05, Input::default());
        assert!(r.master.z > 0.);
        r.spawn(EnemyKind::Brute);
        r.enemies[0].pos = r.master;
        r.attack_cd = 1.;
        let z = r.master.z;
        r.step(0.05, Input::default());
        assert_eq!(r.master.z, z);
        r.enemies.clear();
        r.boss_spawned = true;
        r.boss_defeated = true;
        r.step(0., Input::default());
        assert_eq!(r.phase, Phase::Playing);
        r.master.z = Run::ROUTE;
        r.step(0., Input::default());
        assert_eq!(r.phase, Phase::Won);
        r.phase = Phase::Playing;
        r.master_hp = 0.;
        r.step(0., Input::default());
        assert_eq!(r.phase, Phase::Lost);
    }
    #[test]
    fn deterministic_seed_random_cards_and_capped_choices() {
        let (mut a, mut b) = (started(5), started(5));
        for r in [&mut a, &mut b] {
            for _ in 0..100 {
                r.step(0.05, Input::default());
            }
            r.xp = 4;
            r.check_level();
        }
        assert_eq!(a.enemies[0].pos, b.enemies[0].pos);
        assert_eq!(a.choices, b.choices);
        let mut sorted = a.choices;
        sorted.sort();
        assert_eq!(sorted, [0, 4, 5]);
        a.talents = [MAX_RANK; TALENT_COUNT];
        a.talents[6] = 0;
        a.talents[7] = 0;
        a.phase = Phase::Playing;
        a.xp = a.next_xp;
        a.check_level();
        let mut sorted = a.choices;
        sorted.sort();
        assert_eq!(sorted, [3, 6, 7]);
        a.choose(9);
        assert_eq!(a.phase, Phase::Upgrade);
    }
    #[test]
    fn overflow_experience_preserves_every_upgrade() {
        let mut r = started(1);
        r.xp = 25;
        r.check_level();
        assert_eq!(r.level, 2);
        assert_eq!(r.xp, 21);
        r.choose(0);
        assert_eq!(r.phase, Phase::Upgrade);
        assert_eq!(r.level, 3);
        assert_eq!(r.xp, 14);
        r.choose(0);
        assert_eq!(r.level, 4);
        assert_eq!(r.xp, 4);
        r.choose(0);
        assert_eq!(r.phase, Phase::Playing);
    }
    #[test]
    fn weapons_deal_damage_and_recipes_require_both_arts() {
        let mut r = started(1);
        r.talents[4] = 3;
        r.talents[5] = 3;
        assert_eq!(r.evolutions(), [false; 3]);
        r.talents[6] = 3;
        r.talents[7] = 3;
        assert_eq!(r.evolutions(), [false, true, true]);
        assert_eq!(r.orbit_points().len(), 4);
        r.spawn(EnemyKind::Brute);
        r.enemies[0].pos = Point::new(0., 12.);
        r.enemies[0].frozen = 10.;
        r.enemies[0].hp = 1000.;
        let hp = r.enemies[0].hp;
        for _ in 0..20 {
            r.step(0.05, Input::default());
        }
        assert!(
            r.enemies[0].hp < hp,
            "automatic fire must reach enemies outside staff range"
        );
        r.enemies[0].pos = r.orbit_points()[0];
        let hp = r.enemies[0].hp;
        r.attack_cd = 1.;
        r.step(0.01, Input::default());
        assert!(r.enemies[0].hp < hp, "orbit has real collisions");
    }
    #[test]
    fn pickup_budget_merges_wisdom_and_attraction_follows_player() {
        let mut r = started(1);
        for _ in 0..(MAX_ORBS + 10) {
            r.drop_pickup(Point::new(10., 0.), 1, PickupKind::Wisdom);
        }
        assert_eq!(r.orbs.len(), MAX_ORBS);
        assert_eq!(
            r.orbs.iter().map(|o| o.value).sum::<u32>(),
            (MAX_ORBS + 10) as u32
        );
        r.orbs.clear();
        r.drop_pickup(Point::new(0., 7.), 1, PickupKind::Wisdom);
        r.step(0.05, Input::default());
        assert!(r.orbs[0].attracted);
        let before = r.orbs[0].pos.distance(r.hero);
        r.hero.z = -3.;
        r.step(0.05, Input::default());
        assert!(r.orbs[0].attracted);
        assert!(r.orbs[0].pos.distance(r.hero) < before + 6.);
    }
    #[test]
    fn waves_reserve_boss_slot_and_effects_stay_bounded() {
        let mut r = started(1);
        for _ in 0..MAX_ENEMIES {
            r.spawn(EnemyKind::Wolf);
        }
        assert_eq!(r.enemies.len(), MAX_ENEMIES);
        r.enemies.pop();
        r.elapsed = Run::BOSS_TIME;
        r.spawn_waves(0.05);
        assert!(r.boss_spawned);
        assert_eq!(r.enemies.len(), MAX_ENEMIES);
        for _ in 0..100 {
            r.effect(r.hero, 1., EffectKind::Hit);
        }
        assert_eq!(r.effects.len(), MAX_EFFECTS);
    }
    #[test]
    fn diagonal_speed_and_non_finite_input_are_safe() {
        let mut r = started(1);
        let start = r.hero;
        r.step(
            0.05,
            Input {
                x: 100.,
                z: 100.,
                ..Default::default()
            },
        );
        assert!((r.hero.distance(start) - 0.35).abs() < 0.001);
        let before = r.hero;
        r.step(
            f32::NAN,
            Input {
                x: f32::NAN,
                z: f32::INFINITY,
                ..Default::default()
            },
        );
        assert_eq!(r.hero, before);
    }
}
