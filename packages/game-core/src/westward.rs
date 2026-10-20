//! Continuous coordinates, one-shot regional events and timed automatic links.
use crate::*;

pub const RIVER_OFFSET: f32 = 64.;
#[derive(Clone, Debug, Serialize)]
pub struct WorldState {
    pub region: u8,
    pub events: u8,
    pub camp: u8,
    pub camp_ready: bool,
    pub rest_cd: f32,
}
impl WorldState {
    pub fn from_checkpoint(cp: JourneyCheckpoint) -> Self {
        let events = if cp.events != 0 {
            cp.events
        } else if cp.chapter == 4 {
            31
        } else if cp.dragon_joined {
            15
        } else if cp.chapter == 3 {
            3
        } else {
            0
        };
        let camp = if cp.events != 0 {
            cp.camp
        } else if cp.chapter == 4 {
            3
        } else if cp.chapter >= 3 {
            2
        } else {
            0
        };
        Self {
            region: if camp >= 2 { 2 } else { camp },
            events,
            camp,
            camp_ready: false,
            rest_cd: 0.,
        }
    }
    pub fn safe_point(&self) -> Point {
        Point::new(0., [5., 48., 76., 102.][self.camp as usize])
    }
    pub fn progress(&self, p: Point) -> f32 {
        if self.events & 16 != 0 {
            1.
        } else if self.events & 8 != 0 {
            0.8 + ((p.z - 82.) / 100.).clamp(0., 0.19)
        } else if self.events & 4 != 0 {
            0.7
        } else if self.events & 2 != 0 {
            0.4 + ((p.z - 40.) / 140.).clamp(0., 0.2)
        } else if self.events & 1 != 0 {
            0.25
        } else {
            ((p.z + 3.) / 100.).clamp(0., 0.2)
        }
    }
}
#[derive(Clone, Debug, Default, Serialize)]
pub struct LinkState {
    pub resonance: f32,
    pub cooldown: [f32; 4],
    pub active: u8,
    pub windup: f32,
    pub remaining: f32,
    pub center: Point,
    pub target: u32,
    pub count: [u32; 4],
    pub sequence: u32,
}
impl Journey {
    pub fn obstacles(&self) -> Vec<(Point, f32)> {
        if self.world.is_none() {
            return vec![];
        }
        self.world_obstacles()
            .into_iter()
            .map(|body| (body.center, body.radii[0].min(body.radii[1])))
            .collect()
    }
    pub fn resolve_obstacles(&self, p: &mut Point) {
        let bodies = self.world_obstacles();
        for _ in 0..2 {
            for body in &bodies {
                body.resolve(p, 0.38);
            }
            self.bound(p);
        }
    }
    pub fn avoid_obstacles(&self, from: Point, mut goal: Point) -> Point {
        for (center, radius) in self.obstacles() {
            if from.distance(center) < radius + 5.
                && segment_distance(center, from, goal) < radius + 0.8
            {
                // Prefer the road-facing tangent rather than pushing into a rock.
                let x = center.x - center.x.signum() * (radius + 1.1);
                goal = Point::new(
                    x,
                    center.z
                        + if from.z > center.z {
                            radius + 1.1
                        } else {
                            -radius - 1.1
                        },
                );
                break;
            }
        }
        goal
    }
    pub fn seal_point(&self) -> Point {
        if self.chapter == 3 && self.world.is_some() {
            Point::new(0., RIVER_OFFSET + 18.)
        } else {
            Self::SEAL
        }
    }
    pub fn exit_point(&self) -> Point {
        if self.world.is_some() {
            Point::new(0., RIVER_OFFSET + 38.)
        } else {
            Self::EXIT
        }
    }
    pub fn water(&self, p: Point) -> bool {
        let z = p.z
            + if self.world.is_some() {
                0.
            } else {
                RIVER_OFFSET
            };
        self.chapter == 3 && (z - river_center(p.x)).abs() < river_width(p.x) && p.x.abs() > 3.
    }
    pub fn bound(&self, p: &mut Point) {
        // This contour builds the visible steep rocky toe too. No width step
        // at z=40/59 and no independent invisible gate before the guardian.
        p.z =
            p.z.clamp(-3., if self.world.is_some() { 108. } else { 43. });
        let width = valley_width(p.z);
        let center = valley_center(p.z);
        p.x = p.x.clamp(center - width, center + width);
    }
}
impl Run {
    pub(crate) fn world_save(&self, j: &mut Journey) {
        let w = j.world.as_ref().expect("continuous world");
        let cp = JourneyCheckpoint {
            chapter: if j.joined { 3 } else { 2 },
            version: 1,
            level: self.level,
            xp: self.xp,
            monk: j.monk,
            wukong: j.wukong,
            dragon: j.dragon,
            dragon_joined: j.dragon_joined,
            leader: j.leader,
            events: w.events,
            camp: w.camp,
        };
        j.start = cp;
        j.checkpoint = cp;
    }
    pub(crate) fn world_spawns(&mut self, j: &mut Journey, leader: Point) {
        let Some(w) = j.world.as_mut() else {
            return;
        };
        w.region = if leader.z < 40. {
            0
        } else if leader.z < 58. {
            1
        } else {
            2
        };
        j.chapter = if w.region == 2 { 3 } else { 2 };
        let region = w.region;
        self.enemies
            .retain(|e| e.boss || e.pos.distance(leader) < 30.);
        self.orbs.retain(|o| o.pos.distance(leader) < 36.);
        // A guardian anchors the mountain pass; the dragon remains by its stream.
        let boss = if w.events & 1 != 0 && w.events & 2 == 0 && leader.z > 24. {
            Some((0, 33., 420.))
        } else if region == 2 && leader.z > 72. && w.events & 4 == 0 {
            Some((2, 85., 1600.))
        } else {
            None
        };
        if let Some((habitat, z, hp)) = boss
            && !self.enemies.iter().any(|e| e.boss && e.region == habitat)
        {
            self.spawn(EnemyKind::Boss);
            if let Some(e) = self.enemies.last_mut() {
                e.pos = Point::new(2., z);
                e.home = e.pos;
                e.hp = hp;
                e.max_hp = hp;
                e.region = habitat;
            }
        }
        let cap = if !j.joined {
            6
        } else if region == 1 {
            12
        } else if j.dragon_joined {
            26
        } else {
            18
        };
        if self.spawn_cd <= 0. && self.enemies.len() < cap {
            let roll = self.random();
            let kind = if j.joined && roll < if region == 2 { 0.3 } else { 0.15 } {
                EnemyKind::Brute
            } else if roll < if region == 2 { 0.75 } else { 0.5 } {
                EnemyKind::Swift
            } else {
                EnemyKind::Wolf
            };
            self.spawn(kind);
            let angle = self.random() * std::f32::consts::TAU;
            if let Some(e) = self.enemies.last_mut() {
                e.pos = Point::new(
                    (leader.x + angle.cos() * 13.).clamp(-16., 16.),
                    (leader.z + angle.sin() * 13.).clamp(-2., 107.),
                );
                e.region = if e.pos.z >= 58. { 2 } else { 0 };
                e.home = e.pos;
            }
            self.spawn_cd = if !j.joined {
                2.5
            } else if region == 1 {
                1.6
            } else if region == 2 {
                0.85
            } else {
                1.1
            };
        }
    }
    pub(crate) fn world_events(&mut self, j: &mut Journey, input: Input, leader: Point) {
        let Some(w) = j.world.as_mut() else {
            return;
        };
        let before = (w.events, w.camp);
        if j.joined {
            w.events |= 1;
        }
        if self.boss_defeated {
            w.events |= 2;
        }
        if j.dragon_defeated {
            w.events |= 4;
        }
        if j.dragon_joined {
            w.events |= 8;
        }
        if j.dragon_joined && j.stage_time >= 30. && leader.z > 99. {
            w.events |= 16;
            w.camp = 3;
        }
        let camp = if leader.z < 30. {
            0
        } else if leader.z < 60. {
            1
        } else if leader.z < 98. {
            2
        } else {
            3
        };
        let camp_z = [5., 48., 76., 102.][camp];
        let mut rested = false;
        w.camp_ready = w.rest_cd <= 0.
            && leader.distance(Point::new(0., camp_z)) < 2.5
            && self.enemies.iter().all(|e| e.pos.distance(leader) > 7.);
        if input.action == 7 && w.camp_ready && (camp != 3 || w.events & 16 != 0) {
            rested = true;
            w.camp = camp as u8;
            self.master_hp = (self.master_hp + 20.).min(120.);
            self.hp = (self.hp + 20.).min(100.);
            j.dragon_hp = (j.dragon_hp + 20.).min(140.);
            // Do not allow repeatedly healing in the same saved camp.
            w.camp_ready = false;
            w.rest_cd = 30.;
        }
        if rested || before != (w.events, w.camp) {
            self.world_save(j);
        }
    }
}
