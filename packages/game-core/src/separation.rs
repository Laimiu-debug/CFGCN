//! Reused spatial buckets keep local crowd avoidance bounded, even in a pile.
use crate::*;
const CELL: f32 = 1.6;
const WIDTH: usize = 32;
const HEIGHT: usize = 96;
const PER_CELL: usize = 24;
#[derive(Clone, Debug, Default)]
pub(crate) struct CrowdScratch {
    heads: Vec<usize>,
    next: Vec<usize>,
    positions: Vec<Point>,
    radii: Vec<f32>,
    checks: usize,
    steer_ids: Vec<u32>,
    velocities: Vec<Point>,
    time_left: f32,
}
fn cell(p: Point) -> (usize, usize) {
    (
        ((p.x + 25.6) / CELL).floor().clamp(0., (WIDTH - 1) as f32) as usize,
        ((p.z + 16.) / CELL).floor().clamp(0., (HEIGHT - 1) as f32) as usize,
    )
}
fn radius(e: &Enemy) -> f32 {
    if e.boss {
        0.85
    } else {
        match e.kind {
            EnemyKind::Brute => 0.52,
            EnemyKind::Swift => 0.28,
            _ => 0.38,
        }
    }
}
impl Run {
    pub(crate) fn separate_enemies(&mut self, dt: f32, journey: Option<&Journey>) {
        let grid = &mut self.crowd;
        grid.time_left = (grid.time_left - dt).max(0.);
        if self.enemies.len() > 64
            && grid.time_left > 0.
            && grid.steer_ids.len() == self.enemies.len()
            && self
                .enemies
                .iter()
                .zip(&grid.steer_ids)
                .all(|(e, id)| e.id == *id)
        {
            grid.checks = 0;
            apply_velocities(&mut self.enemies, &grid.velocities, dt, journey);
            return;
        }
        // Decisions at 20 Hz for dense crowds, movement every simulation frame.
        // Damage, projectiles and the three party brains retain their cadence.
        grid.time_left = 0.05;
        grid.steer_ids.clear();
        grid.steer_ids.extend(self.enemies.iter().map(|e| e.id));
        grid.velocities.clear();
        grid.velocities.resize(self.enemies.len(), Point::default());
        grid.heads.resize(WIDTH * HEIGHT, usize::MAX);
        grid.heads.fill(usize::MAX);
        grid.next.resize(self.enemies.len(), usize::MAX);
        grid.positions.clear();
        grid.radii.clear();
        grid.checks = 0;
        for (i, e) in self.enemies.iter().enumerate() {
            grid.positions.push(e.pos);
            grid.radii.push(radius(e));
            if e.hp <= 0. {
                continue;
            }
            let (x, z) = cell(e.pos);
            let index = z * WIDTH + x;
            grid.next[i] = grid.heads[index];
            grid.heads[index] = i;
        }
        for (i, e) in self.enemies.iter_mut().enumerate() {
            if e.hp <= 0. || e.boss || e.frozen > 0. {
                continue;
            }
            let p = grid.positions[i];
            let (x, z) = cell(p);
            let mut push = Point::default();
            for cz in z.saturating_sub(1)..=(z + 1).min(HEIGHT - 1) {
                for cx in x.saturating_sub(1)..=(x + 1).min(WIDTH - 1) {
                    let mut other = grid.heads[cz * WIDTH + cx];
                    let mut visits = 0;
                    while other != usize::MAX && visits < PER_CELL {
                        visits += 1;
                        if other != i {
                            grid.checks += 1;
                            let q = grid.positions[other];
                            let dx = p.x - q.x;
                            let dz = p.z - q.z;
                            let squared = dx * dx + dz * dz;
                            let desired = grid.radii[i] + grid.radii[other];
                            if squared < desired * desired {
                                let distance = squared.sqrt();
                                let (ux, uz) = if distance > 0.0001 {
                                    (dx / distance, dz / distance)
                                } else {
                                    // A coincident pair receives opposite, deterministic directions.
                                    let lo = i.min(other) as u32;
                                    let hi = i.max(other) as u32;
                                    let hash =
                                        lo.wrapping_mul(73856093) ^ hi.wrapping_mul(19349663);
                                    let angle =
                                        (hash & 65535) as f32 / 65535. * std::f32::consts::TAU;
                                    let sign = if i < other { 1. } else { -1. };
                                    (angle.cos() * sign, angle.sin() * sign)
                                };
                                let overlap = desired - distance;
                                push.x += ux * overlap;
                                push.z += uz * overlap;
                            }
                        }
                        other = grid.next[other];
                    }
                }
            }
            let magnitude = (push.x * push.x + push.z * push.z).sqrt();
            if magnitude > 0.0001 {
                let amount = (magnitude * 7.).min(3.5) / magnitude;
                grid.velocities[i] = Point::new(push.x * amount, push.z * amount);
            }
        }
        apply_velocities(&mut self.enemies, &grid.velocities, dt, journey);
    }
}
fn apply_velocities(
    enemies: &mut [Enemy],
    velocities: &[Point],
    dt: f32,
    journey: Option<&Journey>,
) {
    for (e, v) in enemies.iter_mut().zip(velocities) {
        if e.hp <= 0. || e.boss || e.frozen > 0. {
            continue;
        }
        e.pos.x += v.x * dt.clamp(0., 0.05);
        e.pos.z += v.z * dt.clamp(0., 0.05);
        if let Some(j) = journey {
            j.bound(&mut e.pos);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn pile(count: usize) -> Run {
        let mut run = Run::default();
        run.spawn(EnemyKind::Wolf);
        let source = run.enemies[0].clone();
        run.enemies = (0..count)
            .map(|i| {
                let mut e = source.clone();
                e.id = i as u32;
                e.pos = Point::default();
                e
            })
            .collect();
        run
    }
    #[test]
    fn coincident_mobs_separate_deterministically_without_damage_or_rank_changes() {
        let mut a = pile(8);
        let mut b = a.clone();
        for _ in 0..120 {
            a.separate_enemies(1. / 60., None);
            b.separate_enemies(1. / 60., None);
        }
        assert_eq!(a.enemies.len(), 8);
        assert_eq!(a.hp, 100.);
        assert_eq!(a.xp, 0);
        for (i, e) in a.enemies.iter().enumerate() {
            assert_eq!(e.pos.x, b.enemies[i].pos.x);
            assert_eq!(e.pos.z, b.enemies[i].pos.z);
            assert!(e.pos.x.is_finite() && e.pos.z.is_finite());
            for other in a.enemies.iter().skip(i + 1) {
                assert!(e.pos.distance(other.pos) > 0.5);
            }
        }
    }
    #[test]
    fn dense_grid_work_is_bounded_and_frozen_mobs_remain_still() {
        let mut run = pile(1000);
        run.enemies[0].frozen = 1.;
        run.separate_enemies(0.05, None);
        assert!(run.crowd.checks <= 1000 * 9 * PER_CELL);
        assert_eq!(run.enemies[0].pos.distance(Point::default()), 0.);
        assert!(
            run.enemies
                .iter()
                .any(|e| e.pos.distance(Point::default()) > 0.01)
        );
    }
    #[test]
    fn steering_reuse_keeps_moving_and_new_ids_invalidate_the_cache() {
        let mut run = pile(200);
        run.separate_enemies(0.016, None);
        let before = run.enemies[1].pos;
        run.separate_enemies(0.016, None);
        assert_eq!(run.crowd.checks, 0);
        assert!(before.distance(run.enemies[1].pos) > 0.001);
        run.enemies[1].id = 9000;
        run.separate_enemies(0.016, None);
        assert!(run.crowd.checks > 0);
    }
}
