//! Automatic chant, tide, healing and three-member chains use real hit windows.
use crate::*;
impl Run {
    pub(crate) fn party_links(&mut self, dt: f32, j: &mut Journey) {
        for e in &mut self.enemies {
            e.chant_mark = (e.chant_mark - dt).max(0.);
            e.staff_mark = (e.staff_mark - dt).max(0.);
            e.tide_mark = (e.tide_mark - dt).max(0.);
        }
        for cd in &mut j.links.cooldown {
            *cd = (*cd - dt).max(0.);
        }
        j.links.remaining = (j.links.remaining - dt).max(0.);
        if j.links.windup > 0. {
            let close = match j.links.active {
                1 => j.joined && self.master.distance(self.hero) < 13.,
                2 => {
                    j.dragon_joined
                        && self.master.distance(self.hero) < 13.
                        && j.dragon_pos.distance(self.hero) < 13.
                }
                3 => j.dragon_joined && j.dragon_pos.distance(self.hero) < 13.,
                _ => j.dragon_joined && j.dragon_pos.distance(self.master) < 13.,
            };
            let support = j.links.active == 4;
            let target = self
                .enemies
                .iter()
                .filter(|e| e.hp > 0. && e.pos.distance(self.hero) < 10.)
                .max_by(|a, b| {
                    ((a.id == j.links.target) as u8)
                        .cmp(&((b.id == j.links.target) as u8))
                        .then(a.max_hp.total_cmp(&b.max_hp))
                });
            let useful = if support {
                self.master_hp < 119. || self.hp < 99. || j.dragon_hp < 139.
            } else {
                target.is_some()
            };
            if !close || !useful {
                if j.links.active == 2 {
                    j.links.resonance = (j.links.resonance + 100.).min(100.);
                }
                j.links.cooldown[(j.links.active - 1) as usize] = 2.;
                j.links.windup = 0.;
                j.links.remaining = 0.;
                return;
            }
            j.links.center = if support {
                self.master
            } else {
                target.expect("live target").pos
            };
            j.links.windup = (j.links.windup - dt).max(0.);
            if j.links.windup <= 0. {
                if support {
                    let heal = 16. + j.monk[2] as f32 * 3.;
                    self.master_hp = (self.master_hp + heal).min(120.);
                    if self.hero.distance(self.master) < 10. {
                        self.hp = (self.hp + heal).min(100.);
                    }
                    j.dragon_hp = (j.dragon_hp + heal).min(140.);
                    j.dragon_guard = j.dragon_guard.max(2.);
                    j.shield = j.shield.max(1.5);
                    self.effect(self.master, 5., EffectKind::Tide);
                } else {
                    let (radius, damage) = match j.links.active {
                        2 => (8., 120. + self.level as f32 * 3.),
                        3 => (6., 55. + j.dragon[3] as f32 * 8. + j.wukong[0] as f32 * 3.),
                        _ => (5.5, 55. + j.wukong[0] as f32 * 8.),
                    };
                    self.area_damage(j.links.center, radius, damage, 1.5);
                    for e in &mut self.enemies {
                        if e.hp > 0. && e.pos.distance(j.links.center) < radius {
                            e.frozen = if e.boss { 0.25 } else { 0.75 };
                        }
                    }
                    self.effect(j.links.center, radius, EffectKind::Link);
                }
                j.links.count[(j.links.active - 1) as usize] += 1;
                if j.links.active != 2 {
                    j.links.resonance =
                        (j.links.resonance + if support { 12. } else { 18. }).min(100.);
                }
            }
            return;
        }
        if j.links.remaining > 0. || !j.joined {
            return;
        }
        let target = self
            .enemies
            .iter()
            .filter(|e| e.hp > 0. && e.pos.distance(self.hero) < 8.)
            .max_by(|a, b| a.max_hp.total_cmp(&b.max_hp));
        let Some(target) = target else {
            return;
        };
        let trio = j.dragon_joined
            && self.master.distance(self.hero) < 11.
            && self.hero.distance(j.dragon_pos) < 11.
            && j.links.resonance >= 100.
            && j.links.cooldown[1] <= 0.
            && (target.boss
                || target.kind == EnemyKind::Brute
                || self
                    .enemies
                    .iter()
                    .filter(|e| e.hp > 0. && e.pos.distance(self.hero) < 8.)
                    .count()
                    >= 2);
        let support = j.dragon_joined
            && j.links.cooldown[3] <= 0.
            && self.master.distance(j.dragon_pos) < 11.
            && j.shield > 0.
            && j.dragon_guard > 0.
            && (self.master_hp < 90. || self.hp < 75. || j.dragon_hp < 105.);
        let tide = self.enemies.iter().find(|e| {
            e.hp > 0. && e.staff_mark > 0. && e.tide_mark > 0. && e.pos.distance(self.hero) < 6.
        });
        let chant = self.enemies.iter().find(|e| {
            e.hp > 0. && e.staff_mark > 0. && e.chant_mark > 0. && e.pos.distance(self.hero) < 6.
        });
        let (kind, target) = if support {
            (4, target)
        } else if trio {
            (2, target)
        } else if j.dragon_joined
            && self.hero.distance(j.dragon_pos) < 11.
            && j.links.cooldown[2] <= 0.
            && let Some(tide) = tide
        {
            (3, tide)
        } else if self.master.distance(self.hero) < 11.
            && j.links.cooldown[0] <= 0.
            && let Some(chant) = chant
        {
            (1, chant)
        } else {
            return;
        };
        j.links.active = kind;
        j.links.center = target.pos;
        j.links.target = target.id;
        j.links.sequence = j.links.sequence.wrapping_add(1);
        j.links.windup = match kind {
            2 => 0.65,
            4 => 0.45,
            _ => 0.35,
        };
        j.links.remaining = 1.5;
        j.links.cooldown[(kind - 1) as usize] = [8., 24., 10., 18.][(kind - 1) as usize];
        if kind == 2 {
            j.links.resonance = 0.;
        }
        if kind != 3 {
            j.monk_attack = 1.5;
        }
        if kind != 4 {
            self.attack = 1.5;
        }
        if kind != 1 {
            j.dragon_attack = 1.5;
        }
    }
}
