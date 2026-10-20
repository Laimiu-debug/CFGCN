//! Small, bounded A* routes are recalculated by companion brains, never every frame.
use crate::*;
use std::{cmp::Reverse, collections::BinaryHeap};
const WIDTH: usize = 73;
const HEIGHT: usize = 112;
fn point(id: usize) -> Point {
    Point::new((id % WIDTH) as f32 - 36., (id / WIDTH) as f32 - 3.)
}
fn index(p: Point) -> usize {
    ((p.z + 3.).round().clamp(0., (HEIGHT - 1) as f32) as usize) * WIDTH
        + (p.x + 36.).round().clamp(0., (WIDTH - 1) as f32) as usize
}
fn heuristic(a: usize, b: usize) -> u32 {
    let dx = (a % WIDTH).abs_diff(b % WIDTH) as u32;
    let dz = (a / WIDTH).abs_diff(b / WIDTH) as u32;
    10 * dx.max(dz) + 4 * dx.min(dz)
}
impl Journey {
    pub(crate) fn route_waypoint(&self, from: Point, goal: Point, member: u8) -> Point {
        if self.world.is_none() {
            return goal;
        }
        let rocks = self.world_obstacles();
        let mut bounded = goal;
        self.bound(&mut bounded);
        if bounded.distance(goal) < 0.01
            && rocks
                .iter()
                .all(|body| !body.blocks_segment(from, goal, 0.48))
            && (member == 2
                || (0..=16).all(|i| {
                    let t = i as f32 / 16.;
                    !self.water(Point::new(
                        from.x + (goal.x - from.x) * t,
                        from.z + (goal.z - from.z) * t,
                    ))
                }))
        {
            return goal;
        }
        let free = |id: usize| {
            let p = point(id);
            let mut clamped = p;
            self.bound(&mut clamped);
            (p.x - clamped.x).abs() + (p.z - clamped.z).abs() < 0.01
                && rocks.iter().all(|body| !body.contains(p, 0.48))
        };
        let start = index(from);
        let wanted = index(goal);
        let (gx, gz) = ((wanted % WIDTH) as i32, (wanted / WIDTH) as i32);
        let nearby = (-5..=5)
            .flat_map(|dz| (-5..=5).map(move |dx| (gx + dx, gz + dz)))
            .filter(|(x, z)| *x >= 0 && *x < WIDTH as i32 && *z >= 0 && *z < HEIGHT as i32)
            .map(|(x, z)| z as usize * WIDTH + x as usize);
        let end = nearby
            .filter(|id| free(*id) && heuristic(*id, wanted) < 65)
            .min_by_key(|id| heuristic(*id, wanted))
            .unwrap_or(start);
        if end == start {
            return from;
        }
        let mut costs = vec![u32::MAX; WIDTH * HEIGHT];
        let mut previous = vec![usize::MAX; WIDTH * HEIGHT];
        let mut open = BinaryHeap::new();
        costs[start] = 0;
        open.push(Reverse((heuristic(start, end), 0, start)));
        let mut expanded = 0;
        while let Some(Reverse((_, cost, id))) = open.pop() {
            if cost != costs[id] {
                continue;
            }
            if id == end {
                break;
            }
            expanded += 1;
            if expanded > 1800 {
                return from;
            }
            let x = (id % WIDTH) as i32;
            let z = (id / WIDTH) as i32;
            for (dx, dz) in [
                (-1, -1),
                (-1, 0),
                (-1, 1),
                (0, -1),
                (0, 1),
                (1, -1),
                (1, 0),
                (1, 1),
            ] {
                let (nx, nz) = (x + dx, z + dz);
                if nx < 0 || nx >= WIDTH as i32 || nz < 0 || nz >= HEIGHT as i32 {
                    continue;
                }
                let next = nz as usize * WIDTH + nx as usize;
                if !free(next) {
                    continue;
                }
                if dx != 0
                    && dz != 0
                    && (!free(z as usize * WIDTH + nx as usize)
                        || !free(nz as usize * WIDTH + x as usize))
                {
                    continue;
                }
                let cost = cost
                    + if dx != 0 && dz != 0 { 14 } else { 10 }
                    + if member != 2 && self.water(point(next)) {
                        40
                    } else {
                        0
                    };
                if cost < costs[next] {
                    costs[next] = cost;
                    previous[next] = id;
                    open.push(Reverse((cost + heuristic(next, end), cost, next)));
                }
            }
        }
        if previous[end] == usize::MAX {
            return from;
        }
        let mut route = vec![end];
        let mut id = end;
        while previous[id] != start {
            id = previous[id];
            if id == usize::MAX {
                return from;
            }
            route.push(id);
        }
        route.push(start);
        route.reverse();
        point(route[3.min(route.len() - 1)])
    }
}
