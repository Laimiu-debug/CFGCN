//! Synthetic load only. Not compiled into normal play, saves or spawn balance.
use crate::*;
impl Run {
    pub fn crowd_benchmark(count: usize) -> Self {
        let mut run = Self::new_journey(
            42,
            JourneyCheckpoint {
                chapter: 3,
                level: 25,
                monk: [3, 2, 2, 2],
                wukong: [3, 2, 2, 2],
                dragon: [2, 1, 1, 1],
                dragon_joined: true,
                events: 31,
                camp: 2,
                ..Default::default()
            },
        );
        run.phase = Phase::Playing;
        run.fill_crowd(count);
        run
    }
    fn fill_crowd(&mut self, count: usize) {
        let count = count.clamp(1, 1000);
        self.enemies.truncate(count);
        if self.enemies.is_empty() {
            self.spawn(EnemyKind::Wolf);
        }
        let template = self.enemies[0].clone();
        while self.enemies.len() < count {
            let mut enemy = template.clone();
            enemy.id = self.id();
            let n = enemy.id as f32;
            enemy.pos = Point::new(
                (n * 2.3999631).sin() * 9.5,
                76. + (n * 1.618034).sin() * 10.,
            );
            enemy.kind = if enemy.id.is_multiple_of(7) {
                EnemyKind::Brute
            } else {
                EnemyKind::Wolf
            };
            enemy.region = if enemy.id.is_multiple_of(2) { 2 } else { 0 };
            enemy.home = enemy.pos;
            enemy.hp = 160.;
            enemy.max_hp = 160.;
            self.enemies.push(enemy);
        }
    }
    pub fn step_crowd_benchmark(&mut self, dt: f32, count: usize) {
        // Run real movement, target queries, combat, links and bounded pickups.
        // Suppress death/progression only in this labelled synthetic scenario.
        self.hp = 100.;
        self.master_hp = 120.;
        self.xp = 0;
        self.phase = Phase::Playing;
        if let Some(j) = &mut self.journey {
            j.dragon_hp = 140.;
            j.reunion = false;
        }
        self.step(
            dt,
            Input {
                x: (self.elapsed * 0.4).sin() * 0.5,
                z: (self.elapsed * 0.6).cos() * 0.5,
                freeze: true,
                clone: true,
                ..Default::default()
            },
        );
        self.phase = Phase::Playing;
        self.fill_crowd(count);
    }
}
