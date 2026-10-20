//! Five-actor skill trial on the shared exploration terrain. Campaign state is
//! deliberately separate; loadouts and cooldowns belong to skill identities.
use super::{Point, map_anchor_x, map_passable};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

pub const ACTORS: [&str; 5] = ["tangseng", "wukong", "bajie", "shaseng", "xiaobailong"];
#[derive(Clone, Debug, Deserialize)]
pub struct Event {
    pub time: f32,
    pub r#type: String,
}
#[derive(Clone, Debug, Deserialize)]
pub struct RootMotion {
    pub distance: f32,
    pub keys: Vec<[f32; 2]>,
}
#[derive(Clone, Debug, Deserialize)]
pub struct Motion {
    pub duration: f32,
    pub upper_clip: Option<String>,
    pub events: Vec<Event>,
    pub root_motion: Option<RootMotion>,
    pub windup_end: f32,
    pub release_end: f32,
}
#[derive(Clone, Debug, Deserialize)]
pub struct Skill {
    pub id: String,
    pub actor: Option<String>,
    pub clip: Option<String>,
    pub kind: String,
    pub motion: Option<Motion>,
    pub rehearsal_cooldown: Option<f32>,
    #[serde(default)]
    pub ultimate: bool,
}
pub fn catalog() -> &'static [Vec<Skill>; 5] {
    static DATA: OnceLock<[Vec<Skill>; 5]> = OnceLock::new();
    DATA.get_or_init(|| {
        #[derive(Deserialize)]
        struct Book {
            entries: Vec<Skill>,
        }
        let book: Book = serde_json::from_str(include_str!(
            "../../../apps/xiyou/art/shadow-actions-v6/combat.json"
        ))
        .expect("validated skill resource");
        std::array::from_fn(|i| {
            book.entries
                .iter()
                .filter(|s| s.actor.as_deref() == Some(ACTORS[i]) && s.kind == "active")
                .cloned()
                .collect()
        })
    })
}
pub fn default_loadouts() -> [[usize; 4]; 5] {
    #[derive(Deserialize)]
    struct Defaults {
        defaults: std::collections::HashMap<String, [String; 4]>,
    }
    let book: Defaults = serde_json::from_str(include_str!(
        "../../../apps/xiyou/art/shadow-actions-v6/skills.json"
    ))
    .expect("validated defaults");
    std::array::from_fn(|a| {
        std::array::from_fn(|slot| {
            catalog()[a]
                .iter()
                .position(|s| s.id == book.defaults[ACTORS[a]][slot])
                .expect("owner skill identity")
        })
    })
}
fn stride(actor: usize) -> f32 {
    #[derive(Deserialize)]
    struct Stride {
        walk_distance: f32,
    }
    static DATA: OnceLock<Vec<Stride>> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!(
            "../../../apps/xiyou/art/shadow-actions-v6/runtime.json"
        ))
        .expect("native stride")
    })[actor]
        .walk_distance
}
pub fn danger_radius(kind: u8) -> f32 {
    match kind {
        0 => 0.65,
        1 => 1.2,
        _ => 1.3,
    }
}
pub fn attack_release(kind: u8) -> f32 {
    match kind {
        1 => 0.648,
        2 => 0.4784,
        _ => 0.3198,
    }
}
#[derive(Default, Deserialize)]
#[serde(default)]
pub struct TrialInput {
    pub x: f32,
    pub z: f32,
    pub action: u8,
    pub shadow_cast: Option<usize>,
    pub shadow_leader: Option<usize>,
    pub shadow_equip: Option<[usize; 3]>,
    pub shadow_loadouts: Option<[[usize; 4]; 5]>,
    pub shadow_auto: Option<bool>,
    pub shadow_restart: bool,
    pub shadow_dodge: bool,
}
/// The trial camera looks from -Z: screen right is world -X.
pub fn screen_direction(x: f32, z: f32) -> Point {
    Point::new(-x.clamp(-1., 1.), z.clamp(-1., 1.))
}
#[derive(Clone, Debug, Serialize)]
pub struct Dodge {
    pub time: f32,
    pub direction: Point,
}
#[derive(Clone, Debug, Serialize)]
pub struct Cast {
    pub skill: usize,
    pub time: f32,
    pub token: u32,
    pub origin: Point,
    pub direction: Point,
    pub next_event: usize,
    pub travel: f32,
}
#[derive(Clone, Debug, Serialize)]
pub struct Hero {
    pub pos: Point,
    pub facing: Point,
    pub hp: f32,
    pub shield: f32,
    pub cooldowns: [f32; 12],
    pub loadout: [usize; 4],
    pub cast: Option<Cast>,
    pub moving: bool,
    pub gait: f32,
    pub guard: f32,
    pub reduction: f32,
    pub stored: f32,
    pub beads: u8,
    pub veil: f32,
    pub link: f32,
    pub slow: f32,
    pub dodge: Option<Dodge>,
    pub dodge_cooldown: f32,
}
#[derive(Clone, Debug, Serialize)]
pub struct Foe {
    pub id: u32,
    pub kind: u8,
    pub pos: Point,
    pub hp: f32,
    pub max_hp: f32,
    pub facing: Point,
    pub attack: f32,
    pub target: Point,
    pub wait: f32,
    pub control: f32,
    pub resistance: f32,
    pub slow: f32,
    pub wet: f32,
    pub karma: f32,
    pub marked: f32,
    pub marked_by: u8,
    pub gait: f32,
    pub reserved: f32,
}
#[derive(Clone, Debug, Serialize)]
pub struct Bolt {
    pub id: u32,
    pub owner: usize,
    pub pos: Point,
    pub origin: Point,
    pub direction: Point,
    pub speed: f32,
    pub radius: f32,
    pub damage: f32,
    pub ttl: f32,
    pub kind: u8,
    pub age: f32,
    pub hits: Vec<u32>,
    pub remaining: u8,
    pub source: Option<u32>,
}
#[derive(Clone, Debug, Serialize)]
pub struct Field {
    pub id: u32,
    pub owner: usize,
    pub kind: u8,
    pub start: Point,
    pub end: Point,
    pub radius: f32,
    pub ttl: f32,
    pub tick: f32,
    pub uses: u8,
    pub seen: Vec<u32>,
}
#[derive(Clone, Debug, Serialize)]
pub struct Echo {
    pub id: u32,
    pub pos: Point,
    pub ttl: f32,
    pub tick: f32,
}
#[derive(Clone, Debug, Serialize)]
pub struct Stroke {
    pub id: u32,
    pub kind: u8,
    pub owner: usize,
    pub style: u8,
    pub start: Point,
    pub end: Point,
    pub radius: f32,
    pub left: f32,
    pub duration: f32,
}
#[derive(Clone, Debug, Serialize)]
pub struct Trial {
    pub heroes: [Hero; 5],
    pub leader: usize,
    pub enemies: Vec<Foe>,
    pub bolts: Vec<Bolt>,
    pub fields: Vec<Field>,
    pub echoes: Vec<Echo>,
    pub strokes: Vec<Stroke>,
    pub elapsed: f32,
    pub paused: bool,
    pub automatic: bool,
    pub kills: u32,
    pub releases: u32,
    pub casts: u32,
    pub blocked: u32,
    #[serde(skip)]
    spawn_timer: f32,
    #[serde(skip)]
    sequence: u32,
    #[serde(skip)]
    focus: Option<(u32, f32)>,
}
fn add(p: Point, q: Point) -> Point {
    Point::new(p.x + q.x, p.z + q.z)
}
fn mul(p: Point, n: f32) -> Point {
    Point::new(p.x * n, p.z * n)
}
fn direction(a: Point, b: Point) -> Point {
    let d = Point::new(b.x - a.x, b.z - a.z);
    let l = (d.x * d.x + d.z * d.z).sqrt().max(0.001);
    mul(d, 1. / l)
}
fn dot(a: Point, b: Point) -> f32 {
    a.x * b.x + a.z * b.z
}
fn segment(p: Point, a: Point, b: Point) -> f32 {
    let d = Point::new(b.x - a.x, b.z - a.z);
    let t = dot(Point::new(p.x - a.x, p.z - a.z), d) / (dot(d, d).max(0.0001));
    p.distance(add(a, mul(d, t.clamp(0., 1.))))
}
fn walk(p: &mut Point, delta: Point) {
    let steps = ((delta.x.abs().max(delta.z.abs()) / 0.18).ceil() as usize).clamp(1, 32);
    for _ in 0..steps {
        let q = Point::new(p.x + delta.x / steps as f32, p.z);
        if map_passable(q) {
            p.x = q.x;
        }
        let q = Point::new(p.x, p.z + delta.z / steps as f32);
        if map_passable(q) {
            p.z = q.z;
        }
    }
}
fn clear(a: Point, b: Point) -> bool {
    let n = (a.distance(b) / 0.4).ceil().max(1.) as usize;
    (1..n).all(|i| {
        let f = i as f32 / n as f32;
        map_passable(Point::new(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f))
    })
}
impl Default for Trial {
    fn default() -> Self {
        Self::new(Point::new(map_anchor_x(0.), 0.))
    }
}
impl Trial {
    pub fn new(origin: Point) -> Self {
        let loadouts = default_loadouts();
        let heroes = std::array::from_fn(|i| {
            let angle = i as f32 * std::f32::consts::TAU / 5.;
            let mut pos = origin;
            walk(&mut pos, Point::new(angle.cos() * 2.2, angle.sin() * 2.2));
            Hero {
                pos,
                facing: Point::new(1., 0.),
                hp: 100.,
                shield: 0.,
                cooldowns: [0.; 12],
                loadout: loadouts[i],
                cast: None,
                moving: false,
                gait: 0.,
                guard: 0.,
                reduction: 0.,
                stored: 0.,
                beads: 0,
                veil: 0.,
                link: 0.,
                slow: 0.,
                dodge: None,
                dodge_cooldown: 0.,
            }
        });
        let mut trial = Self {
            heroes,
            leader: 1,
            enemies: vec![],
            bolts: vec![],
            fields: vec![],
            echoes: vec![],
            strokes: vec![],
            elapsed: 0.,
            paused: false,
            automatic: false,
            kills: 0,
            releases: 0,
            casts: 0,
            blocked: 0,
            spawn_timer: 0.,
            sequence: 0,
            focus: None,
        };
        for _ in 0..5 {
            trial.spawn();
        }
        trial
    }
    fn id(&mut self) -> u32 {
        self.sequence += 1;
        self.sequence
    }
    pub fn valid_loadout(list: [usize; 4]) -> bool {
        list.iter().all(|i| *i < 12) && (0..4).all(|i| (i + 1..4).all(|j| list[i] != list[j]))
    }
    pub fn equip(&mut self, actor: usize, slot: usize, skill: usize) -> bool {
        if !self.paused || actor >= 5 || slot >= 4 || skill >= 12 {
            return false;
        }
        let list = &mut self.heroes[actor].loadout;
        if let Some(other) = list.iter().position(|i| *i == skill) {
            list.swap(slot, other);
        } else {
            list[slot] = skill;
        }
        true
    }
    pub fn cast(&mut self, actor: usize, slot: usize) -> bool {
        if self.paused || actor >= 5 || slot >= 4 {
            return false;
        }
        let hero = &self.heroes[actor];
        let skill = hero.loadout[slot];
        if hero.hp <= 0.
            || hero.cast.is_some()
            || hero.dodge.is_some()
            || hero.cooldowns[skill] > 0.
        {
            return false;
        }
        let def = &catalog()[actor][skill];
        let clip = def.clip.as_deref().unwrap_or("");
        let target = if matches!(
            clip,
            "FreezeSeal" | "BellChime" | "PrayerBeads" | "TidePrison" | "ScriptureRibbon"
        ) {
            self.enemies
                .iter()
                .enumerate()
                .filter(|(_, e)| e.attack >= 0. && e.control <= 0. && e.pos.distance(hero.pos) < 6.)
                .min_by(|(_, a), (_, b)| {
                    a.pos
                        .distance(hero.pos)
                        .total_cmp(&b.pos.distance(hero.pos))
                })
                .map(|(i, _)| i)
                .or_else(|| self.nearest(hero.pos, 8.))
        } else {
            self.nearest(hero.pos, 8.)
        };
        let facing = target.map_or(hero.facing, |i| direction(hero.pos, self.enemies[i].pos));
        let origin = hero.pos;
        if matches!(
            clip,
            "FreezeSeal" | "BellChime" | "PrayerBeads" | "TidePrison" | "ScriptureRibbon"
        ) && let Some(i) = target
        {
            self.enemies[i].reserved = def.motion.as_ref().expect("motion").events[0].time + 0.25;
        }
        let token = self.id();
        let hero = &mut self.heroes[actor];
        hero.facing = facing;
        hero.cooldowns[skill] = def.rehearsal_cooldown.unwrap_or(5.);
        hero.cast = Some(Cast {
            skill,
            time: 0.,
            token,
            origin,
            direction: facing,
            next_event: 0,
            travel: 0.,
        });
        if matches!(clip, "StoneShell" | "BellyRebound") {
            hero.stored = 0.;
        }
        self.casts += 1;
        true
    }
    fn nearest(&self, p: Point, range: f32) -> Option<usize> {
        self.enemies
            .iter()
            .enumerate()
            .filter(|(_, e)| e.hp > 0. && e.pos.distance(p) < range)
            .min_by(|(_, a), (_, b)| {
                let rank = |e: &Foe| {
                    if self.focus.is_some_and(|(id, left)| id == e.id && left > 0.) {
                        -1.
                    } else {
                        e.pos.distance(p)
                    }
                };
                rank(a).total_cmp(&rank(b))
            })
            .map(|(i, _)| i)
    }
    fn spawn(&mut self) {
        if self.enemies.len() >= 16 {
            return;
        }
        let id = self.id();
        let center = self.heroes[self.leader].pos;
        let angle = id as f32 * 2.399963;
        let mut p = add(center, Point::new(angle.cos() * 8.5, angle.sin() * 8.5));
        for _ in 0..14 {
            if map_passable(p) {
                break;
            }
            p = add(center, mul(direction(p, center), -6.5));
        }
        if !map_passable(p) {
            return;
        }
        let kind = (id % 3) as u8;
        let hp = if kind == 1 { 110. } else { 65. };
        self.enemies.push(Foe {
            id,
            kind,
            pos: p,
            hp,
            max_hp: hp,
            facing: direction(p, center),
            attack: -1.,
            target: center,
            wait: 0.7 + (id % 4) as f32 * 0.2,
            control: 0.,
            resistance: 0.,
            slow: 0.,
            wet: 0.,
            karma: 0.,
            marked: 0.,
            marked_by: 0,
            gait: 0.,
            reserved: 0.,
        });
    }
    fn stroke(&mut self, kind: u8, start: Point, end: Point, radius: f32) {
        let id = self.id();
        let duration = if matches!(kind, 7 | 9) { 0.18 } else { 0.42 };
        self.strokes.push(Stroke {
            id,
            kind,
            owner: 5,
            style: 0,
            start,
            end,
            radius,
            left: duration,
            duration,
        });
        if self.strokes.len() > 70 {
            self.strokes.remove(0);
        }
    }
    fn hurt_foe(&mut self, index: usize, damage: f32, owner: usize) {
        let e = &mut self.enemies[index];
        if e.hp <= 0. {
            return;
        }
        let bit = 1 << owner;
        let bonus = if e.marked > 0. && e.marked_by & bit == 0 {
            e.marked_by |= bit;
            1.35
        } else {
            1.
        };
        e.hp -= damage * bonus;
        let position = e.pos;
        if e.hp <= 0. {
            self.kills += 1;
        }
        if damage > 0. {
            self.stroke(9, position, position, 0.35);
            self.strokes.last_mut().expect("impact").owner = owner;
        }
    }
    fn control(&mut self, index: usize, seconds: f32) {
        let e = &mut self.enemies[index];
        if e.kind == 1 {
            e.wait = e.wait.max(0.45);
            e.attack = -1.;
            return;
        }
        let amount = seconds / (1. + e.resistance * 1.6);
        e.control = e.control.max(amount);
        e.resistance = (e.resistance + 1.).min(4.);
        e.attack = -1.;
    }
    #[allow(clippy::too_many_arguments)]
    fn area(
        &mut self,
        owner: usize,
        p: Point,
        d: Point,
        range: f32,
        width: f32,
        damage: f32,
        control: f32,
        push: f32,
        line: bool,
    ) {
        let end = add(p, mul(d, range));
        self.stroke(if line { 2 } else { 0 }, p, end, range);
        self.strokes.last_mut().expect("weapon stroke").owner = owner;
        for i in 0..self.enemies.len() {
            let e = &self.enemies[i];
            let distance = e.pos.distance(p);
            let hit = if line {
                segment(e.pos, p, end) <= width
            } else {
                distance < range && (distance < 0.5 || dot(direction(p, e.pos), d) > width)
            };
            if !hit || !clear(p, e.pos) {
                continue;
            }
            self.hurt_foe(i, damage, owner);
            if control > 0. {
                self.control(i, control);
            }
            if push != 0. {
                let delta = mul(direction(p, self.enemies[i].pos), push);
                walk(&mut self.enemies[i].pos, delta);
            }
        }
    }
    #[allow(clippy::too_many_arguments)]
    fn field(
        &mut self,
        owner: usize,
        kind: u8,
        start: Point,
        end: Point,
        radius: f32,
        ttl: f32,
        uses: u8,
    ) {
        if matches!(kind, 4 | 7) {
            self.fields.retain(|f| f.owner != owner || f.kind != kind);
        }
        let id = self.id();
        self.fields.push(Field {
            id,
            owner,
            kind,
            start,
            end,
            radius,
            ttl,
            tick: 0.,
            uses,
            seen: vec![],
        });
        if self.fields.len() > 32 {
            self.fields.remove(0);
        }
    }
    fn projectile(
        &mut self,
        owner: usize,
        p: Point,
        d: Point,
        kind: u8,
        damage: f32,
        remaining: u8,
    ) {
        let id = self.id();
        self.bolts.push(Bolt {
            id,
            owner,
            pos: p,
            origin: p,
            direction: d,
            speed: 7.,
            radius: if kind == 2 { 0.55 } else { 0.3 },
            damage,
            ttl: 1.2,
            kind,
            age: 0.,
            hits: vec![],
            remaining,
            source: None,
        });
    }
    fn heal(&mut self, actor: usize, amount: f32) {
        if self.heroes[actor].hp <= 0. {
            return;
        }
        let p = self.heroes[actor].pos;
        self.heroes[actor].hp = (self.heroes[actor].hp + amount).min(100.);
        self.heroes[actor].slow = 0.;
        self.stroke(4, p, p, 1.);
        self.strokes.last_mut().expect("healing stroke").owner = actor;
    }
    fn injured(&self) -> usize {
        (0..5)
            .filter(|a| self.heroes[*a].hp > 0.)
            .min_by(|a, b| self.heroes[*a].hp.total_cmp(&self.heroes[*b].hp))
            .unwrap_or(0)
    }
    fn threatened(&self) -> usize {
        (0..5)
            .min_by(|a, b| {
                let a = self
                    .nearest(self.heroes[*a].pos, 10.)
                    .map_or(20., |e| self.heroes[*a].pos.distance(self.enemies[e].pos));
                let b = self
                    .nearest(self.heroes[*b].pos, 10.)
                    .map_or(20., |e| self.heroes[*b].pos.distance(self.enemies[e].pos));
                a.total_cmp(&b)
            })
            .unwrap_or(self.leader)
    }
    fn release(&mut self, actor: usize, skill: usize, event: &str, origin: Point, d: Point) {
        let marker = self.sequence;
        self.releases += 1;
        let p = self.heroes[actor].pos;
        let clip = catalog()[actor][skill].clip.as_deref().unwrap_or("");
        match clip {
            "Chant" => self.area(actor, p, d, 2.8, -0.1, 10., 0.35, 0.8, false),
            "RobeWard" => {
                let a = self.threatened();
                self.heroes[a].shield = (self.heroes[a].shield + 28.).min(45.);
                self.heroes[actor].shield = (self.heroes[actor].shield + 15.).min(45.);
                self.stroke(3, p, self.heroes[a].pos, 1.);
            }
            "HealingVow" => self.heal(self.injured(), 30.),
            "LotusPulse" => {
                self.area(actor, p, d, 3.4, -0.25, 14., 0.4, 1.2, false);
                self.field(actor, 0, p, add(p, mul(d, 3.)), 0.65, 2., 0);
            }
            "BellChime" => self.area(actor, p, d, 4., -0.3, 9., 0.7, 0., false),
            "VowLink" => {
                for h in &mut self.heroes {
                    h.link = 5.;
                }
                self.stroke(3, p, self.heroes[self.injured()].pos, 2.);
            }
            "PureSeal" => {
                for h in &mut self.heroes {
                    h.slow = 0.;
                }
                self.fields
                    .retain(|f| f.kind != 10 || segment(p, f.start, f.end) > 4.);
                self.stroke(4, p, p, 2.);
            }
            "Mandala" => self.field(actor, 1, p, p, 2.7, 6., 0),
            "ScriptureRibbon" => self.projectile(actor, p, d, 1, 8., 1),
            "PilgrimLantern" => {
                if event == "lantern_place" {
                    let q = add(p, mul(d, 1.));
                    self.field(actor, 2, q, q, 2., 7., 5);
                }
            }
            "KarmicReflection" => {
                if let Some(i) = self.nearest(p, 6.) {
                    self.enemies[i].karma = 6.;
                    self.stroke(8, p, self.enemies[i].pos, 0.7);
                }
            }
            "PurifyingVerse" => {
                self.fields
                    .retain(|f| f.kind != 10 || f.start.distance(p) > 4.8);
                self.area(actor, p, d, 4.8, -1.1, 12., 0.18, 0.55, false);
                for h in &mut self.heroes {
                    if h.hp > 0. && h.pos.distance(p) < 4.8 {
                        h.hp = (h.hp + 8.).min(100.);
                        h.slow = 0.;
                        if event == "purify_end" {
                            h.shield = (h.shield + 14.).min(45.);
                        }
                    }
                }
            }
            "StaffSweep" => self.area(actor, p, d, 3., -0.2, 27., 0., 0.25, false),
            "FreezeSeal" => self.area(actor, p, d, 4., 0.3, 3., 1.2, 0., false),
            "HairClone" | "CloudFeint" => {
                if self.echoes.len() < 2 {
                    let id = self.id();
                    self.echoes.push(Echo {
                        id,
                        pos: origin,
                        ttl: 4.,
                        tick: 0.2,
                    });
                    self.stroke(8, origin, origin, 1.);
                }
            }
            "StaffThrust" => self.area(actor, p, d, 4.4, 0.45, 36., 0., 0., true),
            "BackSweep" => {
                self.area(actor, p, mul(d, -1.), 3., -0.1, 26., 0.4, 0.55, false);
            }
            "CrashingCloud" => {
                if event == "mountain_echo" {
                    self.area(actor, p, d, 3.2, -1.1, 20., 0.22, 0.8, false);
                } else {
                    self.area(actor, p, d, 4.8, 0.05, 62., 0.6, 1.1, false);
                }
            }
            "FlameGaze" | "MonkeyCommand" => {
                if let Some(i) = self.nearest(p, 7.) {
                    self.enemies[i].marked = 6.;
                    self.enemies[i].marked_by = if clip == "FlameGaze" { 0b11101 } else { 0 };
                    if clip == "MonkeyCommand" {
                        self.focus = Some((self.enemies[i].id, 6.));
                    }
                    self.stroke(8, p, self.enemies[i].pos, 0.75);
                }
            }
            "StaffGuard" => {
                self.heroes[actor].guard = if event == "guard_open" { 0.55 } else { 0. };
                self.stroke(3, p, add(p, mul(d, 1.)), 0.7);
            }
            "ReturningStaff" => {
                if event == "staff_out" {
                    self.projectile(actor, p, d, 2, 24., 8);
                }
            }
            "StoneShell" => {
                if event == "stone_open" {
                    self.heroes[actor].reduction = 1.;
                } else {
                    let stored = self.heroes[actor].stored.min(25.);
                    self.heroes[actor].reduction = 0.;
                    self.area(actor, p, d, 2.4, -1.1, stored * 0.8, 0., 0.6, false);
                }
            }
            "RakeSweep" => self.area(actor, p, d, 3.2, -0.35, 26., 0., 0.4, false),
            "RakeSlam" => self.area(actor, p, d, 3., 0.3, 45., 0.65, 0.3, false),
            "BellyBrace" => {
                self.heroes[actor].reduction = 1.3;
                self.stroke(3, p, p, 1.);
            }
            "RakeHook" => self.area(actor, p, d, 4., 0.55, 17., 0.25, -1., true),
            "RakeTrip" => self.area(actor, p, d, 3., 0.1, 18., 0.9, 0., false),
            "MudWall" => self.field(actor, 0, p, add(p, mul(d, 3.)), 1., 5., 0),
            "RollingCharge" => self.area(actor, p, d, 2.5, 0.5, 30., 0.5, 1., true),
            "FeastBreath" => self.heal(actor, 33.),
            "RakeVault" => {
                if event == "vault_land" {
                    self.area(actor, p, d, 2.3, -1.1, 25., 0.3, 1., false);
                }
            }
            "GroundFurrow" => {
                self.area(actor, p, d, 4., 0.65, 10., 0.45, 0., true);
                self.field(actor, 3, p, add(p, mul(d, 4.)), 0.7, 2., 0);
            }
            "BellyRebound" => {
                if event == "belly_open" {
                    self.heroes[actor].reduction = 1.;
                } else {
                    let s = self.heroes[actor].stored.min(25.);
                    self.heroes[actor].reduction = 0.;
                    self.area(
                        actor,
                        p,
                        d,
                        2.8,
                        0.1,
                        s,
                        0.,
                        if s > 0. { 1.2 } else { 0.3 },
                        false,
                    );
                }
            }
            "RakePin" => {
                let final_hit = event == "pin_end";
                self.area(
                    actor,
                    p,
                    d,
                    if final_hit { 5.2 } else { 4.5 },
                    0.18,
                    if final_hit { 32. } else { 22. },
                    if final_hit { 0.55 } else { 0.2 },
                    if final_hit { 1. } else { 0.3 },
                    false,
                );
            }
            "SpadeSweep" => self.area(actor, p, d, 3.2, -0.2, 25., 0., 0.7, false),
            "SpadeThrust" => self.area(actor, p, d, 4., 0.45, 29., 0.6, 0., true),
            "RiverWard" => {
                self.heroes[actor].beads = 3;
                self.field(actor, 4, p, add(p, mul(d, 1.)), 1.7, 4., 3);
            }
            "SpadeLift" => self.area(actor, p, d, 2.8, 0.3, 26., 0.9, 0.35, false),
            "SandVortex" => {
                let q = add(p, mul(d, 2.));
                self.field(actor, 5, q, q, 2.5, 5., 0);
            }
            "RiverDrag" => self.field(actor, 6, origin, p, 1.1, 4.5, 0),
            "PrayerBeads" => self.projectile(actor, p, d, 3, 16., 1),
            "RiverTread" => {
                self.area(actor, p, d, 2.5, 0.2, 16., 0.6, 0.8, false);
                self.heroes[actor].reduction = 1.5;
            }
            "WaterSplit" => self.area(
                actor,
                p,
                if event == "rear_wave" { mul(d, -1.) } else { d },
                if event == "rear_wave" { 4.6 } else { 6.2 },
                -0.35,
                if event == "rear_wave" { 28. } else { 34. },
                0.4,
                0.8,
                false,
            ),
            "SandAnchor" => {
                let q = add(p, mul(d, 1.4));
                self.field(actor, 7, q, q, 1.9, 6., 3);
            }
            "BeadOrbit" => {
                if event == "bead_guard" {
                    let a = self.threatened();
                    self.heroes[a].beads = 4;
                    self.stroke(5, p, self.heroes[a].pos, 1.);
                }
            }
            "Undertow" => self.field(
                actor,
                6,
                p,
                add(p, Point::new(d.x * 3. - d.z, d.z * 3. + d.x)),
                1.,
                4.5,
                0,
            ),
            "JianCut" => self.area(actor, p, d, 2.4, 0.25, 32., 0., 0., false),
            "WaveStep" => self.projectile(actor, p, d, 4, 25., 3),
            "ScaleWard" => {
                let a = self.threatened();
                self.heroes[a].shield = (self.heroes[a].shield + 22.).min(45.);
                self.heroes[a].reduction = 2.;
                self.stroke(3, p, self.heroes[a].pos, 1.);
            }
            "RisingSlash" => self.area(actor, p, d, 2.6, 0.3, 27., 0.8, 0.4, false),
            "TideReturn" => {
                self.heroes[actor].guard = 0.4;
                self.stroke(3, p, add(p, d), 0.8);
            }
            "FrostBreath" => {
                self.area(actor, p, d, 4., 0.6, 9., 0., 0., false);
                for e in &mut self.enemies {
                    if e.pos.distance(p) < 4. && dot(direction(p, e.pos), d) > 0.6 {
                        e.slow = 2.;
                        if e.wet > 0. {
                            e.wait = e.wait.max(0.4);
                        }
                    }
                }
                self.stroke(2, p, add(p, mul(d, 4.)), 1.);
            }
            "DragonDash" => self.area(actor, p, d, 3., 0.4, 35., 0.3, 0.2, true),
            "RainBlessing" => self.field(actor, 8, p, p, 2.7, 5., 0),
            "TwinCrescent" => {
                let angle = if event == "moon_first" {
                    0.22_f32
                } else {
                    -0.22
                };
                let q = Point::new(
                    d.x * angle.cos() - d.z * angle.sin(),
                    d.x * angle.sin() + d.z * angle.cos(),
                );
                self.projectile(actor, p, q, 5, 22., 3);
            }
            "MistVeil" => {
                self.heroes[actor].veil = 1.4;
                self.stroke(8, origin, p, 1.);
            }
            "TidePrison" => {
                if let Some(i) = self.nearest(p, 5.) {
                    self.hurt_foe(i, 14., actor);
                    self.control(i, 1.2);
                    self.enemies[i].wet = 4.;
                    self.stroke(6, p, self.enemies[i].pos, 1.);
                }
            }
            "PearlPulse" if event == "pearl_release" => {
                let mut consumed = 0;
                self.fields.retain(|f| {
                    if matches!(f.kind, 4 | 6 | 8) && f.start.distance(p) < 5. && consumed < 3 {
                        consumed += 1;
                        false
                    } else {
                        true
                    }
                });
                self.projectile(actor, p, d, 7, 46. + consumed as f32 * 10., 8);
                if let Some(bolt) = self.bolts.last_mut() {
                    bolt.speed = 10.;
                    bolt.radius = 0.8;
                    bolt.ttl = 1.25;
                }
                self.stroke(2, p, add(p, mul(d, 6.)), 1.);
            }
            _ => {}
        }
        for stroke in &mut self.strokes {
            if stroke.id > marker && stroke.kind != 9 {
                stroke.owner = actor;
                stroke.style = match clip {
                    "RakeSlam" | "CrashingCloud" | "RakeVault" | "GroundFurrow" => 2,
                    "StaffThrust" | "RakeHook" | "SpadeThrust" | "DragonDash" => 1,
                    "Chant" | "LotusPulse" | "BellChime" | "PurifyingVerse" => 3,
                    "HealingVow" | "NourishVital" => 4,
                    "RobeWard" | "VowLink" | "BeadOrbit" => 5,
                    "StaffGuard" | "BellyBrace" | "StoneShell" | "BellyRebound" | "ScaleWard"
                    | "TideReturn" => 6,
                    "FreezeSeal" | "FlameGaze" | "MonkeyCommand" | "KarmicReflection"
                    | "TidePrison" => 7,
                    "HairClone" | "CloudFeint" | "MistVeil" => 8,
                    "WaterSplit" | "RiverDrag" | "Undertow" => 9,
                    "FrostBreath" => 10,
                    _ => 0,
                };
                if catalog()[actor][skill].ultimate {
                    stroke.style = 20 + actor as u8;
                    stroke.left = 0.9;
                    stroke.duration = 0.9;
                }
            }
        }
        if clip == "WaterSplit" {
            let wave = if event == "rear_wave" { mul(d, -1.) } else { d };
            self.field(actor, 6, p, add(p, mul(wave, 4.5)), 1.15, 3., 0);
            for e in &mut self.enemies {
                if e.pos.distance(p) < 6.2 && dot(direction(p, e.pos), wave) > -0.35 {
                    e.wet = 5.;
                }
            }
        }
    }
    fn hit_hero(
        &mut self,
        actor: usize,
        source: Point,
        damage: f32,
        foe: Option<usize>,
        projectile: bool,
    ) {
        let hero = self.heroes[actor].clone();
        if hero.hp <= 0. || hero.dodge.as_ref().is_some_and(|d| d.time < 0.28) {
            return;
        }
        let frontal = dot(direction(hero.pos, source), hero.facing) > 0.25;
        if projectile && hero.beads > 0 {
            self.heroes[actor].beads -= 1;
            self.blocked += 1;
            self.stroke(5, hero.pos, source, 0.7);
            return;
        }
        if frontal && hero.guard > 0. && foe.is_none_or(|i| self.enemies[i].kind != 1) {
            self.heroes[actor].guard = 0.;
            self.blocked += 1;
            let p = hero.pos;
            let d = hero.facing;
            self.area(actor, p, d, 3.5, 0.1, 24., 0.3, 0.4, false);
            return;
        }
        let mut amount = damage;
        if hero.reduction > 0. {
            amount *= 0.45;
            self.heroes[actor].stored = (self.heroes[actor].stored + damage - amount).min(25.);
        }
        let share = if self.heroes[actor].link > 0. {
            (amount * 0.15).min((self.heroes[(actor + 1) % 5].hp - 1.).max(0.))
        } else {
            0.
        };
        if share > 0. {
            let other = (actor + 1) % 5;
            self.heroes[other].hp = (self.heroes[other].hp - share).max(1.);
            amount -= share;
        }
        let hero = &mut self.heroes[actor];
        let absorbed = hero.shield.min(amount);
        hero.shield -= absorbed;
        amount -= absorbed;
        hero.hp = (hero.hp - amount).max(0.);
        let p = hero.pos;
        if amount > 0.
            && let Some(i) = foe
            && self.enemies[i].karma > 0.
        {
            self.enemies[i].karma = 0.;
            self.hurt_foe(i, (amount * 0.8).min(20.), 0);
        }
        // The rescue ultimate keeps its remaining pulses through ordinary
        // damage. The player can still cancel explicitly with dodge.
        self.stroke(7, p, p, 0.5);
        if self.heroes[actor].reduction <= 0. {
            walk(&mut self.heroes[actor].pos, mul(direction(source, p), 0.2));
        }
    }
    fn auto_skill(&self, actor: usize, slot: usize) -> bool {
        let h = &self.heroes[actor];
        if catalog()[actor][h.loadout[slot]].ultimate {
            let crowd = self
                .enemies
                .iter()
                .filter(|e| e.hp > 0. && e.pos.distance(h.pos) < 6.)
                .count();
            return if actor == 0 {
                self.heroes
                    .iter()
                    .any(|ally| ally.hp > 0. && ally.hp < 60. && ally.pos.distance(h.pos) < 4.8)
            } else {
                crowd >= 3
            };
        }
        let clip = catalog()[actor][h.loadout[slot]]
            .clip
            .as_deref()
            .unwrap_or("");
        let near = self.nearest(h.pos, 6.);
        match clip {
            "StaffSweep" | "BackSweep" | "RakeSweep" | "RakeSlam" | "RakeTrip" | "SpadeSweep"
            | "SpadeLift" | "JianCut" | "RisingSlash" | "WaterSplit" | "RakePin" => {
                self.nearest(h.pos, 2.8).is_some()
            }
            "StaffThrust" | "SpadeThrust" | "RakeHook" | "GroundFurrow" => {
                self.nearest(h.pos, 3.8).is_some()
            }
            "HealingVow" | "RainBlessing" => self.heroes[self.injured()].hp < 82.,
            "FeastBreath" => h.hp < 78.,
            "PureSeal" | "PurifyingVerse" => {
                self.heroes.iter().any(|h| h.slow > 0.)
                    || self
                        .fields
                        .iter()
                        .any(|f| f.kind == 10 && f.start.distance(h.pos) < 5.)
            }
            "RobeWard" | "ScaleWard" | "VowLink" | "PilgrimLantern" | "Mandala" => {
                near.is_some() && self.heroes[self.threatened()].shield < 10.
            }
            "StaffGuard" | "BellyBrace" | "StoneShell" | "BellyRebound" | "TideReturn" => self
                .enemies
                .iter()
                .any(|e| e.attack >= 0. && e.target.distance(h.pos) < 2.),
            "BeadOrbit" | "RiverWard" => {
                self.bolts
                    .iter()
                    .any(|b| b.owner >= 5 && b.pos.distance(h.pos) < 6.)
                    && h.beads == 0
            }
            "FreezeSeal" | "BellChime" | "PrayerBeads" | "TidePrison" | "ScriptureRibbon" => {
                self.enemies.iter().any(|e| {
                    e.reserved <= 0.
                        && e.control <= 0.
                        && e.attack >= 0.
                        && e.pos.distance(h.pos) < 5.
                })
            }
            "MistVeil" | "CloudFeint" | "RakeVault" => self.nearest(h.pos, 2.5).is_some(),
            _ => near.is_some(),
        }
    }
    pub fn step(&mut self, dt: f32, input: TrialInput) {
        if input.shadow_restart {
            let loadouts = self.heroes.each_ref().map(|h| h.loadout);
            let p = self.heroes[self.leader].pos;
            *self = Self::new(p);
            for (h, l) in self.heroes.iter_mut().zip(loadouts) {
                h.loadout = l;
            }
        }
        if input.action == 2 {
            self.paused = true;
        }
        if input.action == 3 {
            self.paused = false;
        }
        if let Some(i) = input.shadow_leader.filter(|i| *i < 5) {
            self.leader = i;
        }
        if let Some(all) = input.shadow_loadouts
            && self.paused
            && all.iter().all(|l| Self::valid_loadout(*l))
        {
            for (h, l) in self.heroes.iter_mut().zip(all) {
                h.loadout = l;
            }
        }
        if let Some([actor, slot, skill]) = input.shadow_equip {
            self.equip(actor, slot, skill);
        }
        if self.paused || !dt.is_finite() || dt <= 0. {
            return;
        }
        let dt = dt.min(0.05);
        self.elapsed += dt;
        if let Some((_, left)) = &mut self.focus {
            *left -= dt;
        }
        for h in &mut self.heroes {
            for cd in &mut h.cooldowns {
                *cd = (*cd - dt).max(0.);
            }
            h.guard = (h.guard - dt).max(0.);
            h.reduction = (h.reduction - dt).max(0.);
            h.veil = (h.veil - dt).max(0.);
            h.link = (h.link - dt).max(0.);
            h.slow = (h.slow - dt).max(0.);
            h.dodge_cooldown = (h.dodge_cooldown - dt).max(0.);
        }
        if input.shadow_dodge {
            let h = &mut self.heroes[self.leader];
            if h.hp > 0. && h.dodge_cooldown <= 0. {
                let v = Point::new(input.x, input.z);
                let d = if dot(v, v) > 0.01 {
                    direction(Point::new(0., 0.), v)
                } else {
                    h.facing
                };
                // Explicit dodge cancels pending skill events; spent cooldown stays spent.
                h.cast = None;
                h.guard = 0.;
                h.reduction = 0.;
                h.stored = 0.;
                h.dodge = Some(Dodge {
                    time: 0.,
                    direction: d,
                });
                h.dodge_cooldown = 1.6;
            }
        }
        if let Some(slot) = input.shadow_cast {
            self.cast(self.leader, slot);
        }
        for a in 0..5 {
            if a != self.leader && self.heroes[a].cast.is_none() {
                for s in 0..4 {
                    if self.auto_skill(a, s) && self.cast(a, s) {
                        break;
                    }
                }
            }
        }
        let lead = self.heroes[self.leader].pos;
        let mut releases = vec![];
        for a in 0..5 {
            let mut hero = self.heroes[a].clone();
            let old = hero.pos;
            if hero.hp <= 0. {
                hero.cast = None;
                self.heroes[a] = hero;
                continue;
            }
            let mut delta = Point::new(0., 0.);
            if a == self.leader {
                let v = Point::new(input.x.clamp(-1., 1.), input.z.clamp(-1., 1.));
                let len = (dot(v, v)).sqrt().max(1.);
                delta = mul(v, 3.4 * dt / len);
            } else {
                let angle = a as f32 * std::f32::consts::TAU / 5.;
                let anchor = add(lead, Point::new(angle.cos() * 2.5, angle.sin() * 2.5));
                let target = self.nearest(hero.pos, 6.).map_or(anchor, |i| {
                    add(
                        self.enemies[i].pos,
                        mul(
                            direction(self.enemies[i].pos, anchor),
                            if a == 0 {
                                4.3
                            } else if a == 4 {
                                1.9
                            } else {
                                2.3
                            },
                        ),
                    )
                });
                if hero.pos.distance(target) > 0.45 {
                    delta = mul(direction(hero.pos, target), 3. * dt);
                }
            }
            for b in 0..5 {
                if a == self.leader {
                    break;
                }
                if a != b && hero.pos.distance(self.heroes[b].pos) < 1.35 {
                    delta = add(delta, mul(direction(self.heroes[b].pos, hero.pos), dt * 2.));
                }
            }
            if a != self.leader {
                for e in &self.enemies {
                    let radius = danger_radius(e.kind);
                    let distance = hero.pos.distance(e.target);
                    if e.attack >= 0. && distance < radius + 0.7 {
                        delta = add(
                            delta,
                            mul(
                                direction(e.target, hero.pos),
                                (radius + 0.8 - distance) * dt * 5.,
                            ),
                        );
                    }
                }
            }
            let speed = stride(a) * 2.2;
            let length = dot(delta, delta).sqrt();
            if length > speed * dt {
                delta = mul(delta, speed * dt / length);
            }
            if let Some(mut cast) = hero.cast.take() {
                let motion = catalog()[a][cast.skill]
                    .motion
                    .as_ref()
                    .expect("hero motion");
                cast.time = (cast.time + dt).min(motion.duration);
                let phase = cast.time / motion.duration;
                if motion.upper_clip.is_none() && a != self.leader {
                    delta = Point::new(0., 0.);
                }
                if a != self.leader
                    && let Some(root) = &motion.root_motion
                {
                    let mut pair = (&root.keys[0], root.keys.last().expect("root keys"));
                    for keys in root.keys.windows(2) {
                        if phase >= keys[0][0] && phase <= keys[1][0] {
                            pair = (&keys[0], &keys[1]);
                            break;
                        }
                    }
                    let u =
                        ((phase - pair.0[0]) / (pair.1[0] - pair.0[0]).max(0.001)).clamp(0., 1.);
                    let travel = root.distance
                        * (pair.0[1] + (pair.1[1] - pair.0[1]) * u * u * (3. - 2. * u));
                    delta = add(delta, mul(cast.direction, travel - cast.travel));
                    cast.travel = travel;
                }
                while cast.next_event < motion.events.len()
                    && motion.events[cast.next_event].time <= cast.time + 0.00001
                {
                    let event = &motion.events[cast.next_event];
                    releases.push((
                        a,
                        cast.skill,
                        event.r#type.clone(),
                        hero.pos,
                        cast.direction,
                    ));
                    cast.next_event += 1;
                }
                if cast.time < motion.duration {
                    hero.cast = Some(cast);
                }
            }
            if hero.slow > 0. {
                delta = mul(delta, 0.65);
            }
            if let Some(mut dodge) = hero.dodge.take() {
                // Direction is sampled from current player input, so releasing or
                // reversing a key never leaves an automatic travel curve in charge.
                let v = Point::new(input.x, input.z);
                if a == self.leader && dot(v, v) > 0.01 {
                    dodge.direction = direction(Point::new(0., 0.), v);
                }
                let end = (dodge.time + dt).min(0.45);
                let integral = |s: f32| 1.65 * (1. - (1. - s / 0.45).powi(3));
                delta = mul(dodge.direction, integral(end) - integral(dodge.time));
                dodge.time = end;
                if end < 0.45 {
                    hero.dodge = Some(dodge);
                }
            }
            walk(&mut hero.pos, delta);
            let distance = old.distance(hero.pos);
            hero.moving = distance > 0.001;
            hero.gait += distance;
            if hero.cast.is_none() && distance > 0.001 {
                hero.facing = direction(old, hero.pos);
            }
            self.heroes[a] = hero;
        }
        for (a, s, e, p, d) in releases {
            self.release(a, s, &e, p, d);
        }
        self.tick_fields(dt);
        self.tick_bolts(dt);
        self.tick_enemies(dt);
        let mut echoes = std::mem::take(&mut self.echoes);
        for e in &mut echoes {
            e.ttl -= dt;
            e.tick -= dt;
            if e.tick <= 0. {
                e.tick = 0.9;
                self.area(1, e.pos, Point::new(1., 0.), 2.7, -1.1, 9., 0., 0., false);
            }
        }
        echoes.retain(|e| e.ttl > 0.);
        self.echoes = echoes;
        self.enemies
            .retain(|e| e.hp > 0. && e.pos.distance(self.heroes[self.leader].pos) < 35.);
        for s in &mut self.strokes {
            s.left -= dt;
        }
        self.strokes.retain(|s| s.left > 0.);
        self.spawn_timer -= dt;
        if self.spawn_timer <= 0. {
            self.spawn_timer = 2.8;
            self.spawn();
        }
        if self.heroes.iter().all(|h| h.hp <= 0.) {
            self.paused = true;
        }
    }
    fn tick_fields(&mut self, dt: f32) {
        let mut fields = std::mem::take(&mut self.fields);
        for f in &mut fields {
            f.ttl -= dt;
            f.tick -= dt;
            for i in 0..self.enemies.len() {
                let p = self.enemies[i].pos;
                if segment(p, f.start, f.end) > f.radius {
                    continue;
                }
                if matches!(f.kind, 0 | 1 | 3 | 5 | 6 | 7) {
                    self.enemies[i].slow = 0.3;
                }
                if matches!(f.kind, 4 | 6 | 8) {
                    self.enemies[i].wet = 3.;
                }
                if f.kind == 5 {
                    let delta = mul(direction(p, f.start), dt * 0.8);
                    walk(&mut self.enemies[i].pos, delta);
                }
                if matches!(f.kind, 3 | 7)
                    && self.enemies[i].attack >= 0.
                    && !f.seen.contains(&self.enemies[i].id)
                    && (f.kind != 7 || f.uses > 0)
                {
                    f.seen.push(self.enemies[i].id);
                    self.control(i, 0.7);
                    if f.kind == 7 {
                        f.uses -= 1;
                    }
                }
            }
            for a in 0..5 {
                if segment(self.heroes[a].pos, f.start, f.end) > f.radius {
                    continue;
                }
                match f.kind {
                    1 => self.heroes[a].reduction = 0.2,
                    2 => {
                        if f.uses > 0 && !f.seen.contains(&(a as u32)) {
                            self.heroes[a].shield = (self.heroes[a].shield + 18.).min(45.);
                            f.seen.push(a as u32);
                            f.uses -= 1;
                        }
                    }
                    6 => {
                        if self.heroes[a].moving {
                            self.heroes[a].reduction = 0.25;
                        }
                    }
                    8 => {
                        if f.tick <= 0. {
                            self.heal(a, 5.);
                        }
                    }
                    10 => {
                        self.heroes[a].slow = 0.4;
                        if f.tick <= 0. {
                            self.hit_hero(a, f.start, 2., None, false);
                        }
                    }
                    _ => {}
                }
            }
            if f.tick <= 0. {
                f.tick = 0.8;
            }
        }
        fields.retain(|f| f.ttl > 0. && (!matches!(f.kind, 2 | 7) || f.uses > 0));
        self.fields = fields;
    }
    fn tick_bolts(&mut self, dt: f32) {
        let mut bolts = std::mem::take(&mut self.bolts);
        for b in &mut bolts {
            b.ttl -= dt;
            b.age += dt;
            let old = b.pos;
            if b.kind == 2 {
                b.ttl = b.ttl.min(0.77 - b.age);
            }
            if b.kind == 5 {
                let angle = dt * 1.25;
                let d = b.direction;
                b.direction = Point::new(
                    d.x * angle.cos() - d.z * angle.sin(),
                    d.x * angle.sin() + d.z * angle.cos(),
                );
            }
            let next = if b.kind == 2 {
                let far = add(b.origin, mul(b.direction, 2.8));
                if b.age < 0.385 {
                    add(b.origin, mul(b.direction, 2.8 * b.age / 0.385))
                } else {
                    let home = self.heroes[b.owner].pos;
                    let u = ((b.age - 0.385) / 0.385).clamp(0., 1.);
                    Point::new(far.x + (home.x - far.x) * u, far.z + (home.z - far.z) * u)
                }
            } else {
                add(b.pos, mul(b.direction, b.speed * dt))
            };
            if map_passable(next) {
                b.pos = next;
            } else {
                b.ttl = 0.;
            }
            if b.owner < 5 {
                for i in 0..self.enemies.len() {
                    let e = &self.enemies[i];
                    let pass = if b.kind == 2 && b.age > 0.385 {
                        1 << 31
                    } else {
                        0
                    };
                    let key = e.id | pass;
                    if !b.hits.contains(&key) && segment(e.pos, old, b.pos) < b.radius + 0.45 {
                        b.hits.push(key);
                        self.hurt_foe(i, b.damage, b.owner);
                        if matches!(b.kind, 1 | 3) {
                            self.control(i, if b.kind == 1 { 0.9 } else { 0.6 });
                        }
                        if matches!(b.kind, 4..=7) {
                            self.enemies[i].wet = 3.;
                        }
                        b.remaining = b.remaining.saturating_sub(1);
                        if b.remaining == 0 {
                            b.ttl = 0.;
                            break;
                        }
                    }
                }
            } else {
                let ward = self.fields.iter_mut().find(|f| {
                    f.kind == 4 && f.uses > 0 && segment(b.pos, f.start, f.end) < f.radius
                });
                if let Some(f) = ward {
                    f.uses -= 1;
                    b.ttl = 0.;
                    self.blocked += 1;
                    continue;
                }
                for a in 0..5 {
                    if self.heroes[a].hp > 0.
                        && segment(self.heroes[a].pos, old, b.pos) < b.radius + 0.35
                    {
                        let source = b
                            .source
                            .and_then(|id| self.enemies.iter().position(|e| e.id == id));
                        self.hit_hero(a, old, b.damage, source, true);
                        b.ttl = 0.;
                        break;
                    }
                }
            }
        }
        bolts.retain(|b| b.ttl > 0.);
        self.bolts = bolts;
    }
    fn tick_enemies(&mut self, dt: f32) {
        for i in 0..self.enemies.len() {
            let mut e = self.enemies[i].clone();
            e.control = (e.control - dt).max(0.);
            e.resistance = (e.resistance - dt * 0.12).max(0.);
            e.slow = (e.slow - dt).max(0.);
            e.wet = (e.wet - dt).max(0.);
            e.karma = (e.karma - dt).max(0.);
            e.marked = (e.marked - dt).max(0.);
            e.reserved = (e.reserved - dt).max(0.);
            if e.hp <= 0. || e.control > 0. {
                self.enemies[i] = e;
                continue;
            }
            let target = (0..5)
                .filter(|a| self.heroes[*a].hp > 0. && self.heroes[*a].veil <= 0.)
                .min_by(|a, b| {
                    self.heroes[*a]
                        .pos
                        .distance(e.pos)
                        .total_cmp(&self.heroes[*b].pos.distance(e.pos))
                });
            let Some(a) = target else {
                self.enemies[i] = e;
                continue;
            };
            let p = self.heroes[a].pos;
            if e.attack >= 0. {
                let release = attack_release(e.kind);
                let before = e.attack;
                e.attack += dt * 0.55;
                if before < release && e.attack >= release {
                    if e.kind == 2 {
                        self.projectile(5, e.pos, e.facing, 0, 6., 1);
                        if let Some(bolt) = self.bolts.last_mut() {
                            bolt.source = Some(e.id);
                        }
                        let q = e.target;
                        self.field(5, 10, q, q, 1.3, 3., 0);
                    } else {
                        for victim in 0..5 {
                            if self.heroes[victim].pos.distance(e.target) < danger_radius(e.kind) {
                                self.hit_hero(
                                    victim,
                                    e.pos,
                                    if e.kind == 1 { 9. } else { 5. },
                                    Some(i),
                                    false,
                                );
                            }
                        }
                    }
                }
                if e.attack
                    > if e.kind == 1 {
                        1.2
                    } else if e.kind == 2 {
                        1.04
                    } else {
                        0.78
                    }
                {
                    e.attack = -1.;
                    e.wait = 1.3;
                }
            } else {
                e.wait -= dt;
                let distance = e.pos.distance(p);
                let reach = if e.kind == 2 { 5.5 } else { 2. };
                if distance < reach && e.wait <= 0. {
                    e.attack = 0.;
                    e.target = p;
                    e.facing = direction(e.pos, p);
                } else if distance > if e.kind == 2 { 4.5 } else { 1.6 } {
                    let old = e.pos;
                    let mut delta = mul(
                        direction(e.pos, p),
                        dt * if e.slow > 0. { 0.65 } else { 1.5 },
                    );
                    for other in &self.enemies {
                        if other.id != e.id && e.pos.distance(other.pos) < 1.2 {
                            delta = add(delta, mul(direction(other.pos, e.pos), dt));
                        }
                    }
                    let limit = stride(5 + e.kind as usize) * 2.2 * dt;
                    let length = dot(delta, delta).sqrt();
                    if length > limit {
                        delta = mul(delta, limit / length);
                    }
                    walk(&mut e.pos, delta);
                    e.gait += old.distance(e.pos);
                    e.facing = direction(old, e.pos);
                }
            }
            // Counter/reflection may have changed the stored foe during its hit.
            e.hp = e.hp.min(self.enemies[i].hp);
            e.karma = e.karma.min(self.enemies[i].karma);
            self.enemies[i] = e;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn screen_input_matches_the_negative_z_camera() {
        assert_eq!(screen_direction(1., 0.), Point::new(-1., 0.));
        assert_eq!(screen_direction(-1., 0.), Point::new(1., 0.));
        assert_eq!(screen_direction(0., 1.), Point::new(0., 1.));
    }
    #[test]
    fn all_sixty_skills_preserve_player_movement_and_never_auto_travel() {
        for actor in 0..5 {
            for skill in 0..12 {
                let mut t = Trial::default();
                t.leader = actor;
                t.automatic = false;
                t.enemies.clear();
                t.spawn_timer = 1000.;
                t.heroes[actor].loadout[0] = skill;
                let mut control = t.clone();
                assert!(t.cast(actor, 0));
                for _ in 0..40 {
                    t.step(
                        0.025,
                        TrialInput {
                            x: 0.7,
                            z: 0.4,
                            ..Default::default()
                        },
                    );
                    control.step(
                        0.025,
                        TrialInput {
                            x: 0.7,
                            z: 0.4,
                            ..Default::default()
                        },
                    );
                    assert!(
                        t.heroes[actor].pos.distance(control.heroes[actor].pos) < 0.001,
                        "{} altered locomotion",
                        catalog()[actor][skill].id
                    );
                    assert!(t.heroes[actor].dodge.is_none());
                }
                let mut still = Trial::default();
                still.leader = actor;
                still.automatic = false;
                still.enemies.clear();
                still.spawn_timer = 1000.;
                still.heroes[actor].loadout[0] = skill;
                let start = still.heroes[actor].pos;
                assert!(still.cast(actor, 0));
                for _ in 0..100 {
                    still.step(0.025, TrialInput::default());
                }
                assert_eq!(still.heroes[actor].pos, start, "automatic root travel");
            }
        }
    }
    #[test]
    fn explicit_dodge_cancels_pending_release_and_respects_cooldown_and_pause() {
        let mut t = Trial::default();
        t.automatic = false;
        t.enemies.clear();
        t.spawn_timer = 1000.;
        assert!(t.cast(1, 0));
        let start = t.heroes[1].pos;
        t.step(
            0.025,
            TrialInput {
                x: -1.,
                shadow_dodge: true,
                ..Default::default()
            },
        );
        assert!(t.heroes[1].cast.is_none());
        assert!(t.heroes[1].pos.x < start.x);
        assert!(t.heroes[1].dodge.is_some());
        let token = t.heroes[1].dodge.as_ref().unwrap().time;
        t.paused = true;
        t.step(
            0.05,
            TrialInput {
                shadow_dodge: true,
                ..Default::default()
            },
        );
        assert_eq!(t.heroes[1].dodge.as_ref().unwrap().time, token);
        t.paused = false;
        for _ in 0..25 {
            t.step(
                0.025,
                TrialInput {
                    shadow_dodge: true,
                    ..Default::default()
                },
            );
        }
        assert!(
            t.heroes[1].dodge.is_none(),
            "held/repeated input must not chain dodges"
        );
        assert!(t.heroes[1].dodge_cooldown > 0.);
        assert_eq!(t.releases, 0, "cancelled skill must not release later");
        assert!(
            t.heroes[1].cooldowns[0] > 0.,
            "cancel cannot erase skill cooldown"
        );
    }
    #[test]
    fn contact_sparks_require_actual_damage_and_keep_the_caster() {
        let mut trial = Trial::default();
        trial.enemies.clear();
        let p = trial.heroes[1].pos;
        trial.release(1, 0, "hit", p, Point::new(1., 0.));
        assert!(trial.strokes.iter().any(|s| s.owner == 1 && s.kind == 0));
        assert!(!trial.strokes.iter().any(|s| s.kind == 9));
        trial.spawn();
        trial.enemies[0].pos = add(p, Point::new(1., 0.));
        let hp = trial.enemies[0].hp;
        trial.hurt_foe(0, 4., 1);
        let spark = trial.strokes.last().expect("real contact");
        assert_eq!((spark.kind, spark.owner), (9, 1));
        assert!(trial.enemies[0].hp < hp);
        assert_eq!(spark.start, trial.enemies[0].pos);
        trial.paused = true;
        let remaining = spark.left;
        trial.step(0.05, TrialInput::default());
        assert_eq!(trial.strokes.last().unwrap().left, remaining);
    }
    #[test]
    fn sixty_actions_have_events_and_distinct_owner_loadouts() {
        assert_eq!(catalog().iter().map(Vec::len).sum::<usize>(), 60);
        for pool in catalog() {
            assert_eq!(pool.len(), 12);
            assert!(
                pool.iter()
                    .all(|s| !s.motion.as_ref().unwrap().events.is_empty())
            );
        }
    }
    #[test]
    fn controlled_actor_never_auto_casts_but_companions_still_fight() {
        let mut t = Trial::default();
        // Even a legacy automatic=true state cannot take over the main actor.
        t.automatic = true;
        for e in &mut t.enemies {
            e.pos = add(t.heroes[1].pos, Point::new(1., 0.));
            e.wait = 99.;
        }
        for _ in 0..30 {
            t.step(0.025, TrialInput::default());
            assert!(t.heroes[1].cast.is_none());
            assert!(t.heroes[1].cooldowns.iter().all(|c| *c == 0.));
        }
        assert!(t.casts > 0, "companions must retain autonomous combat");
        t.step(
            0.025,
            TrialInput {
                shadow_cast: Some(3),
                ..Default::default()
            },
        );
        assert_eq!(
            t.heroes[1].cast.as_ref().unwrap().skill,
            t.heroes[1].loadout[3]
        );
        assert!(catalog()[1][t.heroes[1].loadout[3]].ultimate);
        assert!(t.heroes[1].cooldowns[t.heroes[1].loadout[3]] > 19.);
    }
    #[test]
    fn every_ultimate_occupies_one_of_four_slots_and_switching_keeps_its_cost() {
        let mut t = Trial::default();
        for a in 0..5 {
            assert_eq!(catalog()[a].iter().filter(|s| s.ultimate).count(), 1);
            let skill = t.heroes[a].loadout[3];
            assert!(catalog()[a][skill].ultimate);
            t.heroes[a].cast = None;
            t.leader = a;
            assert!(t.cast(a, 3));
            let cd = t.heroes[a].cooldowns[skill];
            assert!(cd >= 20.);
            t.paused = true;
            t.step(
                0.05,
                TrialInput {
                    shadow_leader: Some((a + 1) % 5),
                    ..Default::default()
                },
            );
            assert_eq!(t.heroes[a].cooldowns[skill], cd);
            t.paused = false;
        }
    }
    #[test]
    fn lotus_ultimate_heals_three_times_and_never_revives_the_fallen() {
        let mut t = Trial::default();
        t.enemies.clear();
        let p = t.heroes[0].pos;
        for h in &mut t.heroes {
            h.pos = p;
            h.hp = 40.;
            h.slow = 5.;
        }
        t.heroes[4].hp = 0.;
        t.field(5, 10, p, p, 1., 8., 0);
        let skill = catalog()[0].iter().position(|s| s.ultimate).unwrap();
        for event in ["purify_start", "purify_pulse", "purify_end"] {
            t.release(0, skill, event, p, Point::new(1., 0.));
        }
        assert_eq!(t.heroes[1].hp, 64.);
        assert_eq!(t.heroes[1].shield, 14.);
        assert_eq!(t.heroes[1].slow, 0.);
        assert_eq!(t.heroes[4].hp, 0.);
        assert!(!t.fields.iter().any(|f| f.kind == 10));
        assert_eq!(t.strokes.iter().filter(|s| s.style == 20).count(), 3);
    }
    #[test]
    fn heavy_ultimates_release_distinct_damage_stages_and_dragon_has_a_real_bolt() {
        for (actor, events, damage) in [
            (1, vec!["mountain_hit", "mountain_echo"], 82.),
            (2, vec!["pin_start", "pin_pulse", "pin_end"], 76.),
        ] {
            let mut t = Trial::default();
            t.enemies.truncate(1);
            let p = t.heroes[actor].pos;
            t.enemies[0].pos = add(p, Point::new(1.2, 0.));
            t.enemies[0].hp = 200.;
            let skill = catalog()[actor].iter().position(|s| s.ultimate).unwrap();
            for event in events {
                t.release(actor, skill, event, p, Point::new(1., 0.));
            }
            assert!((t.enemies[0].hp - (200. - damage)).abs() < 0.01);
        }
        let mut t = Trial::default();
        let p = t.heroes[4].pos;
        for _ in 0..4 {
            t.field(3, 6, p, p, 1., 5., 0);
        }
        let skill = catalog()[4].iter().position(|s| s.ultimate).unwrap();
        t.release(4, skill, "pearl_gather", p, Point::new(1., 0.));
        assert!(t.bolts.is_empty());
        t.release(4, skill, "pearl_release", p, Point::new(1., 0.));
        let bolt = t.bolts.last().unwrap();
        assert_eq!((bolt.kind, bolt.remaining), (7, 8));
        assert_eq!(bolt.damage, 76.);
        assert_eq!(t.fields.iter().filter(|f| f.kind == 6).count(), 1);
    }
    #[test]
    fn equip_preserves_skill_cooldown_and_rejects_duplicates() {
        let mut t = Trial::default();
        t.automatic = false;
        assert!(t.cast(1, 0));
        t.paused = true;
        let cd = t.heroes[1].cooldowns[0];
        assert!(t.equip(1, 0, 2));
        assert!(Trial::valid_loadout(t.heroes[1].loadout));
        assert_eq!(t.heroes[1].cooldowns[0], cd);
        assert!(!t.equip(5, 0, 2));
    }
    #[test]
    fn counter_wave_hits_the_rear_and_dodge_cancels_remaining_ultimate_events() {
        let mut t = Trial::default();
        t.enemies.truncate(2);
        let p = t.heroes[3].pos;
        t.enemies[0].pos = add(p, Point::new(2., 0.));
        t.enemies[0].hp = 200.;
        t.enemies[1].pos = add(p, Point::new(-2., 0.));
        t.enemies[1].hp = 200.;
        let skill = catalog()[3].iter().position(|s| s.ultimate).unwrap();
        t.release(3, skill, "front_wave", p, Point::new(1., 0.));
        assert_eq!(t.enemies[0].hp, 166.);
        assert_eq!(t.enemies[1].hp, 200.);
        t.release(3, skill, "rear_wave", p, Point::new(1., 0.));
        assert_eq!(t.enemies[1].hp, 172.);
        assert!(t.enemies.iter().all(|e| e.wet > 0.));
        t.enemies.clear();
        t.leader = 3;
        for h in &mut t.heroes {
            h.cooldowns = [999.; 12];
        }
        t.heroes[3].cooldowns[skill] = 0.;
        assert!(t.cast(3, 3));
        while t.heroes[3].cast.as_ref().unwrap().time < 0.85 {
            t.step(0.025, TrialInput::default());
        }
        let releases = t.releases;
        t.step(
            0.025,
            TrialInput {
                shadow_dodge: true,
                ..Default::default()
            },
        );
        for _ in 0..80 {
            t.step(0.025, TrialInput::default());
        }
        assert_eq!(
            t.releases, releases,
            "cancelled backwash cannot appear after dodge"
        );
        assert!(t.heroes[3].cooldowns[skill] > 18.);
    }
    #[test]
    fn pause_freezes_motion_and_cooldowns() {
        let mut t = Trial::default();
        t.automatic = false;
        t.cast(1, 0);
        t.step(0.05, TrialInput::default());
        t.paused = true;
        let before = serde_json::to_string(&t).unwrap();
        for _ in 0..30 {
            t.step(0.05, TrialInput::default());
        }
        assert_eq!(serde_json::to_string(&t).unwrap(), before);
    }
    #[test]
    fn empty_guard_does_not_counter_and_frontal_hit_does() {
        let mut t = Trial::default();
        t.automatic = false;
        t.enemies.clear();
        t.heroes[1].guard = 0.5;
        let releases = t.strokes.len();
        t.step(0.05, TrialInput::default());
        assert_eq!(t.strokes.len(), releases);
        let p = t.heroes[1].pos;
        let hp = t.heroes[1].hp;
        t.hit_hero(1, add(p, Point::new(1., 0.)), 10., None, false);
        assert_eq!(t.heroes[1].hp, hp);
        assert_eq!(t.blocked, 1);
        t.heroes[1].guard = 0.5;
        t.hit_hero(1, add(p, Point::new(-1., 0.)), 10., None, false);
        assert!(t.heroes[1].hp < hp);
    }
    #[test]
    fn all_sixty_actions_release_without_corrupting_the_trial() {
        for a in 0..5 {
            for s in 0..12 {
                let mut t = Trial::default();
                t.automatic = false;
                t.leader = a;
                for h in &mut t.heroes {
                    h.cooldowns = [999.; 12];
                }
                t.heroes[a].cooldowns = [0.; 12];
                t.heroes[a].loadout[0] = s;
                assert!(t.cast(a, 0));
                let seconds = catalog()[a][s].motion.as_ref().unwrap().duration;
                for _ in 0..(seconds / 0.025).ceil() as usize + 2 {
                    t.step(0.025, TrialInput::default());
                }
                assert!(t.releases > 0, "{}", catalog()[a][s].id);
                assert!(
                    t.heroes
                        .iter()
                        .all(|h| h.hp.is_finite() && h.pos.x.is_finite())
                );
            }
        }
    }
    #[test]
    fn leader_switch_keeps_bodies_health_cooldowns_and_in_flight_actions() {
        let mut t = Trial::default();
        t.automatic = false;
        t.cast(1, 0);
        t.heroes[1].hp = 73.;
        t.paused = true;
        let before = serde_json::to_string(&t.heroes).unwrap();
        t.step(
            0.,
            TrialInput {
                shadow_leader: Some(4),
                ..TrialInput::default()
            },
        );
        assert_eq!(t.leader, 4);
        assert_eq!(serde_json::to_string(&t.heroes).unwrap(), before);
    }
    #[test]
    fn reflection_requires_real_damage_and_is_consumed_once() {
        let mut t = Trial::default();
        t.enemies[0].karma = 6.;
        let hp = t.enemies[0].hp;
        t.heroes[1].shield = 10.;
        let p = t.enemies[0].pos;
        t.hit_hero(1, p, 8., Some(0), true);
        assert_eq!(t.enemies[0].hp, hp);
        t.hit_hero(1, p, 10., Some(0), true);
        assert!(t.enemies[0].hp < hp);
        assert_eq!(t.enemies[0].karma, 0.);
        let reflected = t.enemies[0].hp;
        t.hit_hero(1, p, 10., Some(0), true);
        assert_eq!(t.enemies[0].hp, reflected);
    }
    #[test]
    fn healing_cannot_resurrect_and_lantern_shields_each_ally_only_once() {
        let mut t = Trial::default();
        t.heroes[0].hp = 0.;
        t.heal(0, 50.);
        assert_eq!(t.heroes[0].hp, 0.);
        t.heroes[4].link = 5.;
        let source = t.heroes[1].pos;
        t.hit_hero(4, source, 12., None, true);
        assert_eq!(t.heroes[0].hp, 0.);
        let p = t.heroes[1].pos;
        for h in &mut t.heroes {
            h.pos = p;
        }
        t.field(0, 2, p, p, 2., 5., 5);
        t.tick_fields(0.05);
        let shields = t.heroes.each_ref().map(|h| h.shield);
        t.tick_fields(0.05);
        assert_eq!(t.heroes.each_ref().map(|h| h.shield), shields);
        assert!(t.fields.is_empty());
    }
    #[test]
    fn repeated_control_diminishes_and_heavy_targets_only_stagger() {
        let mut t = Trial::default();
        t.enemies[0].kind = 0;
        t.control(0, 1.2);
        let first = t.enemies[0].control;
        t.enemies[0].control = 0.;
        t.control(0, 1.2);
        assert!(t.enemies[0].control < first);
        t.enemies[0].kind = 1;
        t.enemies[0].control = 0.;
        t.enemies[0].attack = 0.2;
        t.control(0, 2.);
        assert_eq!(t.enemies[0].control, 0.);
        assert_eq!(t.enemies[0].attack, -1.);
    }
    #[test]
    fn sustained_trial_bounds_enemy_spell_and_clone_populations() {
        let mut t = Trial::default();
        for _ in 0..3600 {
            t.step(1. / 60., TrialInput::default());
        }
        assert!(t.enemies.len() <= 16);
        assert!(t.fields.len() <= 32);
        assert!(t.echoes.len() <= 2);
        assert!(t.strokes.len() <= 70);
        assert!(t.bolts.len() < 60);
        assert!(t.elapsed > 20., "trial ended too early: {}", t.elapsed);
    }
}
