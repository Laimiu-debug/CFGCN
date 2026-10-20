//! Body footprints of the same placed Studio meshes used by the renderer.
use crate::*;

#[derive(Clone, Copy, Debug)]
pub struct WorldObstacle {
    pub center: Point,
    pub radii: [f32; 2],
    pub angle: f32,
}
impl WorldObstacle {
    fn local(&self, p: Point) -> Point {
        let (s, c) = self.angle.sin_cos();
        let dx = p.x - self.center.x;
        let dz = p.z - self.center.z;
        Point::new(c * dx - s * dz, s * dx + c * dz)
    }
    pub fn contains(&self, p: Point, padding: f32) -> bool {
        let p = self.local(p);
        (p.x / (self.radii[0] + padding)).powi(2) + (p.z / (self.radii[1] + padding)).powi(2) < 1.
    }
    pub fn blocks_segment(&self, from: Point, to: Point, padding: f32) -> bool {
        let a = self.local(from);
        let b = self.local(to);
        let scale = |p: Point| {
            Point::new(
                p.x / (self.radii[0] + padding),
                p.z / (self.radii[1] + padding),
            )
        };
        segment_distance(Point::default(), scale(a), scale(b)) < 1.
    }
    pub fn resolve(&self, p: &mut Point, padding: f32) {
        if !self.contains(*p, padding) {
            return;
        }
        let local = self.local(*p);
        let rx = self.radii[0] + padding;
        let rz = self.radii[1] + padding;
        let d = ((local.x / rx).powi(2) + (local.z / rz).powi(2)).sqrt();
        let local = if d > 0.0001 {
            Point::new(local.x / d, local.z / d)
        } else {
            Point::new(0., -rz)
        };
        let (s, c) = self.angle.sin_cos();
        *p = Point::new(
            self.center.x + c * local.x + s * local.z,
            self.center.z - s * local.x + c * local.z,
        );
    }
}

impl Journey {
    pub fn world_obstacles(&self) -> Vec<WorldObstacle> {
        use crate::world_layout_profile::{STONE_FOOTPRINT, TREE_FOOTPRINT};
        let mut bodies = WORLD_STONES
            .iter()
            .filter(|s| {
                self.world.as_ref().map_or(s.event == 128, |world| {
                    s.event != 128 && (s.event == 0 || world.events & s.event == 0)
                })
            })
            .map(|s| WorldObstacle {
                center: s.pos,
                radii: [
                    s.scale[0] * STONE_FOOTPRINT[0],
                    s.scale[2] * STONE_FOOTPRINT[1],
                ],
                angle: s.angle.to_radians(),
            })
            .collect::<Vec<_>>();
        for region in 0..if self.world.is_some() { 3 } else { 2 } {
            bodies.extend(world_props(region).into_iter().map(|(p, s)| WorldObstacle {
                center: p,
                radii: [s * TREE_FOOTPRINT[0], s * TREE_FOOTPRINT[1]],
                angle: 0.,
            }));
        }
        bodies
    }
}
