//! Small CPU height table for crowds; heroes and hit ranges keep exact terrain.
use crate::terrain_height;
const STEP: f32 = 0.125;
const X0: f32 = -25.;
const Z0: f32 = -12.;
const W: usize = 401;
const H: usize = 1089;
pub struct TerrainGrid {
    heights: Vec<f32>,
}
impl Default for TerrainGrid {
    fn default() -> Self {
        let heights = (0..H)
            .flat_map(|z| {
                (0..W).map(move |x| terrain_height(X0 + x as f32 * STEP, Z0 + z as f32 * STEP))
            })
            .collect();
        Self { heights }
    }
}
impl TerrainGrid {
    pub fn sample(&self, x: f32, z: f32) -> f32 {
        let gx = (x - X0) / STEP;
        let gz = (z - Z0) / STEP;
        if !(0. ..(W - 1) as f32).contains(&gx) || !(0. ..(H - 1) as f32).contains(&gz) {
            return terrain_height(x, z);
        }
        let ix = gx.floor() as usize;
        let iz = gz.floor() as usize;
        let tx = gx - ix as f32;
        let tz = gz - iz as f32;
        let a = self.heights[iz * W + ix] * (1. - tx) + self.heights[iz * W + ix + 1] * tx;
        let b =
            self.heights[(iz + 1) * W + ix] * (1. - tx) + self.heights[(iz + 1) * W + ix + 1] * tx;
        a * (1. - tz) + b * tz
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn crowded_actor_heights_stay_within_two_centimetres_of_shared_ground() {
        let grid = TerrainGrid::default();
        let mut seed = 171u32;
        let mut error = 0f32;
        for _ in 0..15000 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let x = -18. + 36. * (seed >> 8) as f32 / 16777216.;
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let z = -3. + 111. * (seed >> 8) as f32 / 16777216.;
            error = error.max((grid.sample(x, z) - terrain_height(x, z)).abs());
        }
        assert!(error < 0.02, "height error {error}");
        assert_eq!(grid.sample(40., 200.), terrain_height(40., 200.));
    }
}
