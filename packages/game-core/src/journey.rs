//! Westward chapters, persistent waymarks and a single controllable party leader.
use super::*;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct JourneyCheckpoint {
    pub version: u8,
    pub chapter: u8,
    pub level: u32,
    pub xp: u32,
    pub monk: [u8; 4],
    pub wukong: [u8; 4],
    #[serde(default)]
    pub dragon: [u8; 4],
    #[serde(default)]
    pub dragon_joined: bool,
    #[serde(default)]
    pub leader: u8,
    #[serde(default)]
    pub events: u8,
    #[serde(default)]
    pub camp: u8,
}
impl Default for JourneyCheckpoint {
    fn default() -> Self {
        Self {
            version: 1,
            chapter: 0,
            level: 1,
            xp: 0,
            monk: [0; 4],
            wukong: [0; 4],
            dragon: [0; 4],
            dragon_joined: false,
            leader: 0,
            events: 0,
            camp: 0,
        }
    }
}
impl JourneyCheckpoint {
    pub fn valid(&self) -> bool {
        self.version == 1
            && self.events <= 31
            && self.camp <= 3
            && (self.events == 0 || self.chapter >= 2)
            && (self.events & 2 == 0 || self.events & 1 != 0)
            && (self.events & 4 == 0 || self.events & 2 != 0)
            && (self.events & 8 == 0 || self.events & 4 != 0)
            && (self.events & 16 == 0 || self.events & 8 != 0)
            && (self.events & 8 == 0 || self.dragon_joined)
            && (self.events == 0 || !self.dragon_joined || self.events & 8 != 0)
            && (self.camp == 0 || self.events & 2 != 0)
            && (self.camp < 3 || self.events & 16 != 0)
            && self.chapter <= 4
            && (1..=70).contains(&self.level)
            && self.xp < 4 + (self.level - 1) * 3
            && self
                .monk
                .iter()
                .chain(self.wukong.iter())
                .chain(self.dragon.iter())
                .all(|n| *n <= MAX_RANK)
            && self
                .monk
                .iter()
                .chain(self.wukong.iter())
                .chain(self.dragon.iter())
                .map(|n| *n as u32)
                .sum::<u32>()
                < self.level
            && (self.chapter >= 2 || self.wukong == [0; 4])
            && (!self.dragon_joined || self.chapter >= 3)
            && (self.dragon_joined || self.dragon == [0; 4])
            && (self.leader == 0
                || (self.leader == 1 && (self.chapter >= 3 || self.events & 1 != 0))
                || (self.leader == 2 && self.dragon_joined))
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct TideZone {
    pub id: u32,
    pub pos: Point,
    pub radius: f32,
    pub delay: f32,
    pub remaining: f32,
    #[serde(skip)]
    pub(crate) struck: bool,
}
#[derive(Clone, Debug, Serialize)]
pub struct Journey {
    pub world: Option<WorldState>,
    pub links: LinkState,
    pub intentions: [u8; 3],
    #[serde(skip)]
    pub(crate) goals: [Point; 3],
    #[serde(skip)]
    pub(crate) brain_cd: [f32; 3],
    pub chapter: u8,
    pub joined: bool,
    pub dragon_joined: bool,
    pub dragon_defeated: bool,
    pub leader: u8,
    pub reunion: bool,
    pub recipient: Option<u8>,
    pub offers: [[u8; 3]; 3],
    pub monk: [u8; 4],
    pub wukong: [u8; 4],
    pub dragon: [u8; 4],
    pub dragon_pos: Point,
    pub dragon_hp: f32,
    pub dragon_hurt: f32,
    pub dragon_facing: f32,
    pub dragon_attack: f32,
    pub dragon_guard: f32,
    pub dash: f32,
    pub primary: [f32; 3],
    pub secondary: [f32; 3],
    pub stage_time: f32,
    pub rescue_ready: bool,
    pub exit_open: bool,
    pub monk_attack: f32,
    pub monk_facing: f32,
    pub shield: f32,
    pub trial_progress: f32,
    pub zones: Vec<TideZone>,
    pub start: JourneyCheckpoint,
    pub checkpoint: JourneyCheckpoint,
    #[serde(skip)]
    pub(crate) chant_cd: f32,
    #[serde(skip)]
    pub(crate) healing_cd: f32,
    #[serde(skip)]
    pub(crate) hoof_cd: f32,
    #[serde(skip)]
    pub(crate) wave_cd: f32,
    #[serde(skip)]
    pub(crate) hurt_cd: [f32; 3],
    #[serde(skip)]
    pub(crate) water_tick: f32,
}
impl Journey {
    pub const SEAL: Point = Point { x: 0., z: 18. };
    pub const EXIT: Point = Point { x: 0., z: 38. };
    pub fn available(&self, member: u8) -> bool {
        member == 0 || (member == 1 && self.joined) || (member == 2 && self.dragon_joined)
    }
    pub fn duration(&self) -> f32 {
        match self.chapter {
            0 => 45.,
            3 => 55.,
            _ => 60.,
        }
    }
    pub fn progress(&self, leader: Point) -> f32 {
        if let Some(w) = &self.world {
            return w.progress(leader);
        }
        if self.chapter == 2 && !self.joined {
            return (1. - leader.distance(Self::SEAL) / 20.).clamp(0., 1.) * 0.2;
        }
        if self.chapter == 3 && !self.dragon_joined {
            return self.trial_progress;
        }
        let time = (self.stage_time / self.duration()).clamp(0., 1.);
        if self.exit_open {
            (0.85 + (1. - leader.distance(Self::EXIT) / 40.).clamp(0., 1.) * 0.15).min(1.)
        } else if self.chapter == 3 {
            0.4 + time * 0.45
        } else if self.chapter == 2 {
            0.2 + time * 0.6
        } else {
            time * 0.85
        }
    }
}
impl Run {
    pub fn new_journey(seed: u32, checkpoint: JourneyCheckpoint) -> Self {
        let cp = if checkpoint.valid() {
            checkpoint
        } else {
            JourneyCheckpoint::default()
        };
        let mut run = Self::new(seed);
        run.phase = Phase::Playing;
        run.master = Point::new(0., 2.);
        run.hero = if cp.chapter >= 3 {
            Point::new(1.8, 3.)
        } else {
            run.master
        };
        run.level = cp.level;
        run.xp = cp.xp;
        run.next_xp = 4 + (cp.level - 1) * 3;
        run.next_id = 1 + cp.chapter as u32 * 1_000_000;
        let world = (cp.chapter >= 2).then(|| WorldState::from_checkpoint(cp));
        if let Some(w) = &world {
            let p = w.safe_point();
            run.master = p;
            run.hero = Point::new(p.x + 2.8, p.z - 1.);
        }
        let joined = world.as_ref().is_some_and(|w| w.events & 1 != 0);
        let dragon_joined = world.as_ref().is_some_and(|w| w.events & 8 != 0);
        let river = world.as_ref().is_some_and(|w| w.camp >= 2);
        run.journey = Some(Journey {
            world,
            links: LinkState::default(),
            intentions: [0; 3],
            goals: [run.master; 3],
            brain_cd: [0.; 3],
            chapter: if cp.chapter >= 2 {
                if river { 3 } else { 2 }
            } else {
                cp.chapter
            },
            joined,
            dragon_joined,
            dragon_defeated: dragon_joined || cp.events & 4 != 0,
            leader: cp.leader,
            reunion: false,
            recipient: None,
            offers: [[0, 1, 2]; 3],
            monk: cp.monk,
            wukong: cp.wukong,
            dragon: cp.dragon,
            dragon_pos: Point::new(run.master.x - 3., run.master.z - 2.),
            dragon_hp: 140.,
            dragon_hurt: 0.,
            dragon_facing: 0.,
            dragon_attack: 0.,
            dragon_guard: 0.,
            dash: 0.,
            primary: [0.; 3],
            secondary: [0.; 3],
            stage_time: 0.,
            rescue_ready: false,
            exit_open: false,
            monk_attack: 0.,
            monk_facing: 0.,
            shield: 0.,
            trial_progress: 0.,
            zones: vec![],
            start: cp,
            checkpoint: cp,
            chant_cd: 0.2,
            healing_cd: 0.,
            hoof_cd: 0.,
            wave_cd: 0.,
            hurt_cd: [0.; 3],
            water_tick: 0.,
        });
        run
    }
    pub fn wukong_active(&self) -> bool {
        self.journey.as_ref().is_none_or(|j| j.joined)
    }
    pub fn leader_point(&self) -> Point {
        self.journey.as_ref().map_or(self.hero, |j| match j.leader {
            1 => self.hero,
            2 => j.dragon_pos,
            _ => self.master,
        })
    }
    pub(crate) fn journey_level(&mut self) {
        if self.level >= 70 {
            self.xp = self.xp.min(self.next_xp - 1);
            return;
        }
        if self.phase != Phase::Playing || self.xp < self.next_xp {
            return;
        }
        self.xp -= self.next_xp;
        self.level += 1;
        self.next_xp = 4 + (self.level - 1) * 3;
        let mut j = self.journey.take().expect("journey mode");
        for member in 0..3 {
            let ranks = [j.monk, j.wukong, j.dragon][member];
            let mut pool = (0..4u8)
                .filter(|id| ranks[*id as usize] < MAX_RANK)
                .collect::<Vec<_>>();
            pool.push(4);
            let mut offers = [4; 3];
            for offer in &mut offers {
                if pool.is_empty() {
                    break;
                }
                let index = (self.random() * pool.len() as f32) as usize;
                *offer = pool.swap_remove(index.min(pool.len() - 1));
            }
            j.offers[member] = offers;
        }
        j.recipient = if j.joined { None } else { Some(0) };
        self.choices = j.offers[0];
        self.journey = Some(j);
        self.phase = Phase::Upgrade;
    }
    pub(crate) fn choose_journey(&mut self, index: usize) {
        if self.phase != Phase::Upgrade || index >= 3 {
            return;
        }
        let Some(j) = self.journey.as_mut() else {
            return;
        };
        let Some(member) = j.recipient else {
            return;
        };
        if !j.available(member) {
            return;
        }
        let skill = j.offers[member as usize][index] as usize;
        if skill < 4 {
            let ranks = match member {
                1 => &mut j.wukong,
                2 => &mut j.dragon,
                _ => &mut j.monk,
            };
            if ranks[skill] >= MAX_RANK {
                return;
            }
            ranks[skill] += 1;
        } else {
            self.master_hp = (self.master_hp + 30.).min(120.);
            self.hp = (self.hp + 30.).min(100.);
            j.dragon_hp = (j.dragon_hp + 30.).min(140.);
        }
        self.phase = Phase::Playing;
        j.recipient = None;
        self.journey_level();
    }
    pub(crate) fn step_journey(&mut self, dt: f32, input: Input) {
        match input.action {
            1 => {
                *self = Self::new(self.seed);
                self.phase = Phase::Playing;
                return;
            }
            2 if self.phase == Phase::Playing => self.phase = Phase::Paused,
            3 if self.phase == Phase::Paused => {
                self.phase = Phase::Playing;
                self.journey.as_mut().expect("journey").reunion = false;
            }
            4 => {
                self.choose_journey(input.choice as usize);
                return;
            }
            6 if self.phase == Phase::Won => {
                let cp = self.journey.as_ref().expect("journey").checkpoint;
                if cp.chapter < 4 {
                    *self = Self::new_journey(self.seed, cp);
                }
                return;
            }
            8 if self.phase == Phase::Upgrade => {
                let j = self.journey.as_mut().expect("journey");
                if j.available(input.member) {
                    j.recipient = Some(input.member);
                    self.choices = j.offers[input.member as usize];
                }
                return;
            }
            9 if self.phase == Phase::Upgrade => {
                let j = self.journey.as_mut().expect("journey");
                if j.joined {
                    j.recipient = None;
                }
                return;
            }
            10 if matches!(self.phase, Phase::Playing | Phase::Paused) => {
                let j = self.journey.as_mut().expect("journey");
                if j.available(input.member) {
                    j.leader = input.member;
                }
            }
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
        self.advance_party(dt, input);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn run() -> Run {
        Run::new_journey(42, JourneyCheckpoint::default())
    }
    #[test]
    fn solo_has_only_one_controlled_actor_and_no_monkey_spells() {
        let mut r = run();
        r.step(
            0.05,
            Input {
                x: 1.,
                clone: true,
                ..Default::default()
            },
        );
        assert!(r.master.x > 0.);
        assert_eq!(r.hero, r.master);
        assert!(!r.wukong_active());
        assert_eq!(r.clone_time, 0.);
    }
    #[test]
    fn solo_upgrade_is_monk_only_and_pauses_everything() {
        let mut r = run();
        r.xp = 4;
        r.journey_level();
        assert_eq!(r.phase, Phase::Upgrade);
        let before = r.elapsed;
        r.step(
            0.05,
            Input {
                x: 1.,
                member: 1,
                action: 8,
                ..Default::default()
            },
        );
        assert_eq!(r.elapsed, before);
        assert_eq!(r.journey.as_ref().unwrap().recipient, Some(0));
        r.choose(0);
        assert_eq!(r.phase, Phase::Playing);
        assert_eq!(r.journey.as_ref().unwrap().wukong, [0; 4]);
    }
    #[test]
    fn rescue_requires_real_proximity_and_never_attacking_wukong() {
        let mut cp = JourneyCheckpoint::default();
        cp.chapter = 2;
        let mut r = Run::new_journey(42, cp);
        r.step(
            0.05,
            Input {
                action: 7,
                ..Default::default()
            },
        );
        assert!(!r.wukong_active());
        r.master = Journey::SEAL;
        let before = r.progress();
        r.step(
            0.05,
            Input {
                action: 7,
                ..Default::default()
            },
        );
        assert!(r.wukong_active());
        assert!(r.progress() >= before);
        assert_eq!(r.phase, Phase::Paused);
        assert!(r.journey.as_ref().unwrap().reunion);
        assert!(r.enemies.is_empty());
    }
    #[test]
    fn changing_recipient_does_not_reroll_and_spends_one_upgrade() {
        let mut r = run();
        r.journey.as_mut().unwrap().joined = true;
        r.xp = 4;
        r.journey_level();
        let offers = r.journey.as_ref().unwrap().offers;
        assert_eq!(r.journey.as_ref().unwrap().recipient, None);
        r.choose(0);
        assert_eq!(r.phase, Phase::Upgrade);
        for member in [1, 0, 1] {
            r.step(
                0.,
                Input {
                    action: 8,
                    member,
                    ..Default::default()
                },
            );
            assert_eq!(r.journey.as_ref().unwrap().offers, offers);
            r.step(
                0.,
                Input {
                    action: 9,
                    ..Default::default()
                },
            );
        }
        r.step(
            0.,
            Input {
                action: 8,
                member: 1,
                ..Default::default()
            },
        );
        let skill = offers[1].iter().position(|id| *id < 4).unwrap();
        r.choose(skill);
        assert_eq!(r.journey.as_ref().unwrap().monk, [0; 4]);
        assert_eq!(r.journey.as_ref().unwrap().wukong.iter().sum::<u8>(), 1);
        assert_eq!(r.level, 2);
        assert_eq!(r.phase, Phase::Playing);
    }
    #[test]
    fn checkpoint_only_advances_on_clear_and_restores_region_build() {
        let mut r = run();
        assert_eq!(r.journey.as_ref().unwrap().checkpoint.chapter, 0);
        r.journey.as_mut().unwrap().stage_time = 46.;
        r.master = Journey::EXIT;
        r.step(0., Input::default());
        assert_eq!(r.phase, Phase::Won);
        let cp = r.journey.as_ref().unwrap().checkpoint;
        assert!(cp.valid());
        assert_eq!(cp.chapter, 1);
        r.step(
            0.,
            Input {
                action: 6,
                ..Default::default()
            },
        );
        assert_eq!(r.journey.as_ref().unwrap().chapter, 1);
        assert_eq!(r.phase, Phase::Playing);
    }
    #[test]
    fn invalid_checkpoint_and_non_finite_input_are_safe() {
        let cp = JourneyCheckpoint {
            level: 0,
            chapter: 255,
            monk: [255; 4],
            ..Default::default()
        };
        let mut r = Run::new_journey(42, cp);
        assert_eq!(r.level, 1);
        assert_eq!(r.journey.as_ref().unwrap().chapter, 0);
        r.step(
            f32::NAN,
            Input {
                x: f32::NAN,
                z: f32::INFINITY,
                ..Default::default()
            },
        );
        assert!(r.master.x.is_finite() && r.master.z.is_finite());
    }
    #[test]
    fn follower_returns_to_formation_and_both_collect_shared_xp() {
        let mut r = run();
        r.journey.as_mut().unwrap().joined = true;
        r.hero = Point::new(10., 10.);
        let before = r.hero.distance(r.master);
        r.step(0.05, Input::default());
        assert!(r.hero.distance(r.master) < before);
        r.drop_pickup(r.hero, 2, PickupKind::Wisdom);
        r.drop_pickup(r.master, 1, PickupKind::Wisdom);
        r.step(0., Input::default());
        assert_eq!(r.xp, 3);
    }

    #[test]
    fn recruited_wukong_really_fights_outside_the_monk_chant() {
        let mut r = run();
        r.journey.as_mut().unwrap().joined = true;
        r.hero = Point::new(6., 2.);
        r.spawn(EnemyKind::Wolf);
        r.enemies.last_mut().unwrap().pos = r.hero;
        r.spawn_cd = 99.;
        r.step(0., Input::default());
        assert_eq!(r.kills, 1);
        assert!(r.attack > 0.);
        assert!(r.enemies.is_empty());
    }

    #[test]
    fn active_ward_changes_actual_incoming_damage() {
        let mut r = run();
        r.spawn(EnemyKind::Brute);
        r.enemies.last_mut().unwrap().pos = r.master;
        r.spawn_cd = 99.;
        let mut unguarded = r.clone();
        unguarded.step(0., Input::default());
        r.step(
            0.,
            Input {
                freeze: true,
                ..Default::default()
            },
        );
        // Knockback can avert the hit entirely; mitigation remains active afterward.
        assert!(r.master_hp > unguarded.master_hp);
        assert!(r.journey.as_ref().unwrap().shield > 0.);
    }

    #[test]
    fn guardian_fits_inside_the_party_encounter_budget() {
        let mut cp = JourneyCheckpoint::default();
        cp.chapter = 2;
        let mut r = Run::new_journey(42, cp);
        let j = r.journey.as_mut().unwrap();
        j.joined = true;
        j.stage_time = 60.;
        j.world.as_mut().unwrap().events = 1;
        r.master = Point::new(0., 26.);
        for _ in 0..27 {
            r.spawn(EnemyKind::Wolf);
        }
        r.step(0., Input::default());
        assert!(r.enemies.len() <= MAX_ENEMIES);
        assert_eq!(r.enemies.iter().filter(|enemy| enemy.boss).count(), 1);
    }

    fn river() -> Run {
        Run::new_journey(
            42,
            JourneyCheckpoint {
                chapter: 3,
                ..Default::default()
            },
        )
    }
    #[test]
    fn old_completed_region_waymark_opens_the_river() {
        let cp: JourneyCheckpoint = serde_json::from_str(
            r#"{"version":1,"chapter":3,"level":1,"xp":0,"monk":[0,0,0,0],"wukong":[0,0,0,0]}"#,
        )
        .unwrap();
        assert!(cp.valid());
        let r = Run::new_journey(42, cp);
        assert_eq!(r.journey.as_ref().unwrap().chapter, 3);
        assert!(r.wukong_active());
        assert!(!r.journey.as_ref().unwrap().dragon_joined);
    }
    #[test]
    fn switching_changes_the_controlled_body_without_teleport_or_cooldown_reset() {
        let mut r = river();
        r.phase = Phase::Paused;
        r.journey.as_mut().unwrap().primary = [8., 5., 0.];
        let before = (r.hero, r.master, r.hp, r.master_hp);
        r.step(
            0.,
            Input {
                action: 10,
                member: 1,
                ..Default::default()
            },
        );
        assert_eq!((r.hero, r.master, r.hp, r.master_hp), before);
        assert_eq!(r.journey.as_ref().unwrap().leader, 1);
        r.step(
            0.,
            Input {
                action: 10,
                member: 2,
                ..Default::default()
            },
        );
        assert_eq!(r.journey.as_ref().unwrap().leader, 1);
        r.step(
            0.,
            Input {
                action: 3,
                x: 1.,
                ..Default::default()
            },
        );
        r.step(
            0.05,
            Input {
                x: 1.,
                ..Default::default()
            },
        );
        assert!(r.hero.x > before.0.x);
        assert!(r.journey.as_ref().unwrap().primary[0] > 7.9);
    }
    #[test]
    fn dragon_recruitment_requires_settling_the_encounter_and_saves_a_replayable_waymark() {
        let mut r = river();
        r.master = r.journey.as_ref().unwrap().seal_point();
        r.step(
            0.,
            Input {
                action: 7,
                ..Default::default()
            },
        );
        assert!(!r.journey.as_ref().unwrap().dragon_joined);
        r.journey.as_mut().unwrap().dragon_defeated = true;
        r.step(
            0.,
            Input {
                action: 7,
                ..Default::default()
            },
        );
        let j = r.journey.as_ref().unwrap();
        assert!(j.dragon_joined && j.reunion && j.checkpoint.valid());
        assert_eq!(r.phase, Phase::Paused);
        let restored = Run::new_journey(42, j.checkpoint);
        assert!(restored.journey.as_ref().unwrap().dragon_joined);
    }
    #[test]
    fn third_member_has_real_upgrades_damage_and_dash() {
        let mut r = river();
        let j = r.journey.as_mut().unwrap();
        j.dragon_joined = true;
        j.leader = 2;
        r.xp = r.next_xp;
        r.journey_level();
        r.step(
            0.,
            Input {
                action: 8,
                member: 2,
                ..Default::default()
            },
        );
        let skill = r.journey.as_ref().unwrap().offers[2]
            .iter()
            .position(|n| *n < 4)
            .unwrap();
        r.choose(skill);
        assert_eq!(r.journey.as_ref().unwrap().dragon.iter().sum::<u8>(), 1);
        let before = r.journey.as_ref().unwrap().dragon_pos;
        r.spawn(EnemyKind::Brute);
        r.enemies.last_mut().unwrap().pos = before;
        r.step(
            0.05,
            Input {
                z: 1.,
                freeze: true,
                ..Default::default()
            },
        );
        r.step(
            0.05,
            Input {
                z: 1.,
                ..Default::default()
            },
        );
        let j = r.journey.as_ref().unwrap();
        assert!(j.dragon_pos.z > before.z + 0.7);
        assert!(j.primary[2] > 0.);
        assert!(r.kills > 0 || r.enemies.iter().any(|e| e.hp < e.max_hp));
    }
    #[test]
    fn tide_warning_pauses_then_hits_and_followers_can_avoid_it() {
        let mut r = river();
        let pos = r.master;
        r.journey.as_mut().unwrap().zones.push(TideZone {
            id: 99,
            pos,
            radius: 2.8,
            delay: 0.5,
            remaining: 0.8,
            struck: false,
        });
        r.step(
            0.05,
            Input {
                action: 2,
                ..Default::default()
            },
        );
        assert_eq!(r.journey.as_ref().unwrap().zones[0].delay, 0.5);
        r.step(
            0.,
            Input {
                action: 3,
                ..Default::default()
            },
        );
        for _ in 0..12 {
            r.step(0.05, Input::default());
        }
        assert!(r.master_hp < 120.);
        assert!(r.hero.distance(pos) > 2.8);
    }
}
