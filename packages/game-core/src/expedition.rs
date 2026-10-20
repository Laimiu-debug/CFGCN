//! Map construction mode: a continuous, deterministic world, independent of combat saves.
use crate::{Input, JourneyCheckpoint, Phase, Point, Run};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    sync::{Mutex, OnceLock},
};

pub const CHUNK_SIZE: f32 = 64.;
/// Stable world-space detail levels, unrelated to camera position or FPS.
fn map_grid_step(cx: i32, cz: i32) -> f32 {
    let x = cx as f32 * CHUNK_SIZE;
    let z = cz as f32 * CHUNK_SIZE;
    let region = &map_regions()[map_region(z + CHUNK_SIZE * 0.5)];
    if region.water <= 0. {
        return 2.;
    }
    let river = &layout().river;
    let center = region.z + river.offset;
    let radius = river.meander.abs()
        + river.small_meander.abs()
        + river.half_width
        + region.water * river.water_width
        + river.width_ripple.abs()
        + river.outer_bank;
    if x + CHUNK_SIZE < region.x - 456.
        || x > region.x + 456.
        || z + CHUNK_SIZE < center - radius - 16.
        || z > center + radius + 16.
    {
        return 2.;
    }
    if x + CHUNK_SIZE >= region.x - 440.
        && x <= region.x + 440.
        && z + CHUNK_SIZE >= center - radius
        && z <= center + radius
    {
        // A conservative river bound can barely touch several extra rows.
        // Inspect actual wet land before spending fine geometry on them. The
        // immutable result has a bounded cache; no terrain sampling under lock.
        type StepCache = VecDeque<((i32, i32), f32)>;
        static CACHE: OnceLock<Mutex<StepCache>> = OnceLock::new();
        let cache = CACHE.get_or_init(|| Mutex::new(VecDeque::new()));
        let cached = {
            let entries = cache.lock().expect("grid step cache");
            entries
                .iter()
                .find(|(key, _)| *key == (cx, cz))
                .map(|(_, step)| *step)
        };
        if let Some(step) = cached {
            return step;
        }
        let wet_land = (0..=4).any(|iz| {
            (0..=4).any(|ix| {
                let px = x + ix as f32 * 16.;
                let pz = z + iz as f32 * 16.;
                let (wet, level) = map_water(px, pz);
                wet > 0.1 && map_height(px, pz) < level + 1.
            })
        });
        let step = if wet_land { 0.5 } else { 1. };
        let mut entries = cache.lock().expect("grid step cache");
        if entries.len() >= 96 {
            entries.pop_front();
        }
        entries.push_back(((cx, cz), step));
        step
    } else {
        1.
    }
}

/// Rendering and actor foot-height queries share this stitched topology.
#[derive(Clone, Copy)]
pub struct MapGrid {
    pub step: f32,
    pub divisions: usize,
    origin: Point,
    edges: [usize; 4],
}
pub fn map_grid(cx: i32, cz: i32) -> MapGrid {
    let step = map_grid_step(cx, cz);
    MapGrid {
        step,
        divisions: (CHUNK_SIZE / step) as usize,
        origin: Point::new(cx as f32 * CHUNK_SIZE, cz as f32 * CHUNK_SIZE),
        edges: [(cx - 1, cz), (cx + 1, cz), (cx, cz - 1), (cx, cz + 1)]
            .map(|(x, z)| (map_grid_step(x, z) / step).max(1.) as usize),
    }
}
impl MapGrid {
    pub fn point(&self, index: u32) -> Point {
        let index = index as usize;
        Point::new(
            self.origin.x + (index % (self.divisions + 1)) as f32 * self.step,
            self.origin.z + (index / (self.divisions + 1)) as f32 * self.step,
        )
    }
    /// Collapse boundary indices onto the coarser neighbour's vertices.
    /// Discard degenerate triangles; the adjacent fans also cover corners.
    pub fn triangles(&self, x: usize, z: usize) -> [[u32; 3]; 2] {
        let index = |mut x: usize, mut z: usize| {
            if x == 0 {
                z = z / self.edges[0] * self.edges[0];
            }
            if x == self.divisions {
                // Opposite collapse direction keeps the corner fans from
                // folding across the regular grid's shared diagonal.
                z = z.div_ceil(self.edges[1]) * self.edges[1];
            }
            if z == 0 {
                x = x / self.edges[2] * self.edges[2];
            }
            if z == self.divisions {
                x = x / self.edges[3] * self.edges[3];
            }
            (z * (self.divisions + 1) + x) as u32
        };
        let a = index(x, z);
        let b = index(x + 1, z);
        let c = index(x, z + 1);
        let d = index(x + 1, z + 1);
        [[a, c, b], [b, c, d]].map(|triangle| {
            let [a, b, c] = triangle.map(|index| {
                let index = index as usize;
                (
                    (index % (self.divisions + 1)) as i32,
                    (index / (self.divisions + 1)) as i32,
                )
            });
            if (b.0 - a.0) * (c.1 - a.1) == (b.1 - a.1) * (c.0 - a.0) {
                [triangle[0]; 3]
            } else {
                triangle
            }
        })
    }
    fn triangle_height(&self, p: Point, indices: [u32; 3]) -> Option<f32> {
        if indices[0] == indices[1] || indices[0] == indices[2] || indices[1] == indices[2] {
            return None;
        }
        let [a, b, c] = indices.map(|i| self.point(i));
        let area = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if area.abs() < f32::EPSILON {
            return None;
        }
        let u = ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.z - c.z)) / area;
        let v = ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.z - c.z)) / area;
        let w = 1. - u - v;
        if u.min(v).min(w) < -0.0001 {
            return None;
        }
        Some(map_height(a.x, a.z) * u + map_height(b.x, b.z) * v + map_height(c.x, c.z) * w)
    }
}
#[derive(Clone, Debug, Deserialize)]
pub struct MapRegion {
    pub id: String,
    pub names: [String; 3],
    pub x: f32,
    pub z: f32,
    pub biome: String,
    pub height: f32,
    pub relief: f32,
    pub groves: f32,
    pub water: f32,
}
pub fn map_regions() -> &'static [MapRegion] {
    static REGIONS: OnceLock<Vec<MapRegion>> = OnceLock::new();
    REGIONS.get_or_init(|| {
        #[derive(Deserialize)]
        struct Map {
            regions: Vec<MapRegion>,
        }
        serde_json::from_str::<Map>(include_str!("../data/xiyou-world.json"))
            .expect("validated world map")
            .regions
    })
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RiverLayout {
    offset: f32,
    meander: f32,
    meander_rate: f32,
    small_meander: f32,
    small_rate: f32,
    small_phase: f32,
    half_width: f32,
    water_width: f32,
    width_ripple: f32,
    width_rate: f32,
    inner_bank: f32,
    outer_bank: f32,
}
#[derive(Deserialize)]
struct GroveLayout {
    region: String,
    props: Vec<[f32; 4]>,
}
#[derive(Deserialize)]
struct ShoreLayout {
    region: String,
    reach: f32,
    spacing: f32,
}
#[derive(Deserialize)]
struct MapLayout {
    river: RiverLayout,
    groves: Vec<GroveLayout>,
    landmarks: Vec<LandmarkSpec>,
    courts: Vec<CourtLayout>,
    fields: Vec<FieldLayout>,
    #[serde(default)]
    hills: Vec<HillLayout>,
    #[serde(default)]
    shores: Vec<ShoreLayout>,
}
#[derive(Deserialize)]
struct HillLayout {
    region: String,
    offset: [f32; 2],
    extent: [f32; 2],
    rise: f32,
}
#[derive(Deserialize)]
struct CourtLayout {
    region: String,
    offset: [f32; 2],
    extent: [f32; 2],
    #[serde(default)]
    stone: bool,
}
#[derive(Deserialize)]
struct FieldLayout {
    region: String,
    offset: [f32; 2],
    extent: [f32; 2],
    angle: f32,
}
struct MapField {
    pos: Point,
    extent: [f32; 2],
    angle: f32,
}
fn map_fields() -> &'static [MapField] {
    static FIELDS: OnceLock<Vec<MapField>> = OnceLock::new();
    FIELDS.get_or_init(|| {
        layout()
            .fields
            .iter()
            .map(|field| {
                let r = map_regions()
                    .iter()
                    .find(|r| r.id == field.region)
                    .expect("field region");
                MapField {
                    pos: Point::new(map_anchor_x(r.z) + field.offset[0], r.z + field.offset[1]),
                    extent: field.extent,
                    angle: field.angle,
                }
            })
            .collect()
    })
}
/// Static crop / stone-court brushwork shares terrain UVs, with no extra props.
/// The second UV uses angles for crops and 100 for stone, decoded by mode 16.
pub fn map_field_sample(x: f32, z: f32) -> [f32; 2] {
    let mut sample = [0., 0.];
    for field in map_fields() {
        let dx = x - field.pos.x;
        let dz = z - field.pos.z;
        if dx.abs() > field.extent[0] + field.extent[1] + 4.
            || dz.abs() > field.extent[0] + field.extent[1] + 4.
        {
            continue;
        }
        let (s, c) = field.angle.sin_cos();
        let u = dx * c + dz * s;
        let v = dz * c - dx * s;
        let distance = ((u.abs() - field.extent[0]).max(0.).powi(2)
            + (v.abs() - field.extent[1]).max(0.).powi(2))
        .sqrt();
        let mask = 1. - smooth(0., 2., distance);
        if mask > sample[0] {
            sample = [mask, field.angle];
        }
    }
    for court in map_courts().iter().filter(|c| c.stone) {
        let mask = 1. - smooth(0., 2., court.distance(Point::new(x, z)));
        if mask > sample[0] {
            sample = [mask, 100.];
        }
    }
    sample
}
struct MapCourt {
    pos: Point,
    extent: [f32; 2],
    height: f32,
    stone: bool,
}
impl MapCourt {
    fn distance(&self, p: Point) -> f32 {
        let dx = ((p.x - self.pos.x).abs() - self.extent[0]).max(0.);
        let dz = ((p.z - self.pos.z).abs() - self.extent[1]).max(0.);
        (dx * dx + dz * dz).sqrt()
    }
}
fn map_courts() -> &'static [MapCourt] {
    static COURTS: OnceLock<Vec<MapCourt>> = OnceLock::new();
    COURTS.get_or_init(|| {
        layout()
            .courts
            .iter()
            .map(|c| {
                let r = map_regions()
                    .iter()
                    .find(|r| r.id == c.region)
                    .expect("court region");
                let pos = Point::new(map_anchor_x(r.z) + c.offset[0], r.z + c.offset[1]);
                MapCourt {
                    pos,
                    extent: c.extent,
                    height: raw_land_height(pos.x, pos.z),
                    stone: c.stone,
                }
            })
            .collect()
    })
}
#[derive(Deserialize)]
struct LandmarkSpec {
    id: String,
    region: String,
    names: [String; 3],
    scene: usize,
    #[serde(default)]
    pack: usize,
    offset: [f32; 2],
    width: f32,
    #[serde(default)]
    approach: Option<[f32; 4]>,
    feet: Vec<[f32; 4]>,
}
pub struct MapLandmark {
    pub id: String,
    pub names: [String; 3],
    pub scene: usize,
    pub pack: usize,
    pub width: f32,
    pub pos: Point,
    ground: f32,
    approach: Option<[f32; 4]>,
    feet: Vec<[f32; 4]>,
}
impl MapLandmark {
    pub fn distance_to_foot(&self, p: Point) -> f32 {
        self.feet
            .iter()
            .map(|f| {
                let dx = ((p.x - self.pos.x - f[0]).abs() - f[2]).max(0.);
                let dz = ((p.z - self.pos.z - f[1]).abs() - f[3]).max(0.);
                dx * dx + dz * dz
            })
            .fold(f32::INFINITY, f32::min)
            .sqrt()
    }
    fn pad(&self, p: Point) -> f32 {
        let d = ((p.x - self.pos.x).abs() - self.width * 0.5).max(0.);
        let z = ((p.z - self.pos.z - 0.5).abs() - 2.5).max(0.);
        1. - smooth(0.1, 3.5, (d * d + z * z).sqrt())
    }
    fn reserves_approach(&self, p: Point) -> bool {
        // Leave the visible entrance clear of both authored and scattered props.
        // The margin includes the largest prop foot and the actor's body radius.
        self.approach.is_some_and(|a| {
            (p.x - self.pos.x - a[0]).abs() < a[2] + 2.
                && (p.z - self.pos.z - a[1]).abs() < a[3] + 2.
        })
    }
}
pub fn map_landmarks() -> &'static [MapLandmark] {
    static MARKS: OnceLock<Vec<MapLandmark>> = OnceLock::new();
    MARKS.get_or_init(|| {
        layout()
            .landmarks
            .iter()
            .map(|l| {
                let region = map_regions()
                    .iter()
                    .find(|r| r.id == l.region)
                    .expect("landmark region");
                let z = region.z + l.offset[1];
                let pos = Point::new(map_anchor_x(z) + l.offset[0], z);
                MapLandmark {
                    id: l.id.clone(),
                    names: l.names.clone(),
                    scene: l.scene,
                    pack: l.pack,
                    width: l.width,
                    pos,
                    ground: land_height(pos.x, pos.z),
                    approach: l.approach,
                    feet: l.feet.clone(),
                }
            })
            .collect()
    })
}
fn layout() -> &'static MapLayout {
    static LAYOUT: OnceLock<MapLayout> = OnceLock::new();
    LAYOUT.get_or_init(|| {
        serde_json::from_str(include_str!("../data/xiyou-map-layout.json")).expect("map layout")
    })
}
/// Same parameters drive visible river meshes, collision and the nearby map.
pub fn map_river_course(region: usize, x: f32) -> f32 {
    let r = &map_regions()[region];
    let l = &layout().river;
    let dx = x - r.x;
    r.z + l.offset
        + l.meander * (dx * l.meander_rate).sin()
        + l.small_meander * (dx * l.small_rate + l.small_phase).sin()
}
pub fn map_river_half_width(region: usize, x: f32) -> f32 {
    let r = &map_regions()[region];
    let l = &layout().river;
    l.half_width + r.water * l.water_width + l.width_ripple * ((x - r.x) * l.width_rate).sin()
}
fn smooth(a: f32, b: f32, x: f32) -> f32 {
    let t = ((x - a) / (b - a)).clamp(0., 1.);
    t * t * (3. - 2. * t)
}
fn pair(z: f32) -> (usize, usize, f32) {
    let regions = map_regions();
    let next = regions.partition_point(|r| r.z <= z).min(regions.len() - 1);
    let previous = next.saturating_sub(1);
    let t = if next == previous {
        0.
    } else {
        smooth(regions[previous].z, regions[next].z, z)
    };
    (previous, next, t)
}
pub fn map_region(z: f32) -> usize {
    let (a, b, t) = pair(z);
    if t < 0.5 { a } else { b }
}
fn blend(z: f32, value: impl Fn(&MapRegion) -> f32) -> f32 {
    let (a, b, t) = pair(z);
    let regions = map_regions();
    value(&regions[a]) * (1. - t) + value(&regions[b]) * t
}
pub fn map_anchor_x(z: f32) -> f32 {
    blend(z, |r| r.x) + (z * 0.013).sin() * 9. + (z * 0.031).sin() * 2.
}
pub fn map_sites(region: usize) -> [Point; 4] {
    let r = &map_regions()[region.min(map_regions().len() - 1)];
    let x = map_anchor_x(r.z);
    [
        Point::new(x - 240., r.z),
        Point::new(x + 240., r.z),
        Point::new(x - 170., r.z + 190.),
        Point::new(x + 180., r.z - 190.),
    ]
}
fn noise(x: f32, z: f32) -> f32 {
    let a = x.floor() as i32;
    let b = z.floor() as i32;
    let hash = |i: i32, j: i32| {
        let mut v =
            (i as u32).wrapping_mul(374761393) ^ (j as u32).wrapping_mul(668265263) ^ 657871;
        v = (v ^ (v >> 13)).wrapping_mul(1274126177);
        (v ^ (v >> 16)) as f32 / u32::MAX as f32
    };
    let u = smooth(0., 1., x - a as f32);
    let v = smooth(0., 1., z - b as f32);
    (hash(a, b) * (1. - u) + hash(a + 1, b) * u) * (1. - v)
        + (hash(a, b + 1) * (1. - u) + hash(a + 1, b + 1) * u) * v
}
pub fn map_water(x: f32, z: f32) -> (f32, f32) {
    let i = map_region(z);
    let region = &map_regions()[i];
    if region.water <= 0. {
        return (0., 0.);
    }
    // Local water borders a broad bank, rather than an endless world-row barrier.
    let course = map_river_course(i, x);
    let width = map_river_half_width(i, x);
    let l = &layout().river;
    let mask =
        (1. - smooth(
            width - l.inner_bank,
            width + l.outer_bank,
            (z - course).abs(),
        )) * (1. - smooth(340., 440., (x - region.x).abs()));
    (mask, region.height - 1.)
}
fn raw_land_height(x: f32, z: f32) -> f32 {
    let relief = blend(z, |r| r.relief);
    let base = blend(z, |r| r.height);
    // Continuous landform. No authored road or cleared linear corridor.
    let broad = noise(x / 130., z / 145.);
    let shoulder = noise(x / 44. + 17., z / 52. - 9.);
    let rolls = (noise(x / 19., z / 23.) - 0.5) * 0.65;
    let ridge = smooth(0.37, 0.77, broad) * relief * 0.64;
    let ledges = smooth(0.34, 0.72, shoulder) * relief * 0.17;
    let mut height = base + ridge + ledges + rolls;
    for hill in &layout().hills {
        let region = map_regions()
            .iter()
            .find(|r| r.id == hill.region)
            .expect("hill region");
        let dx = (x - map_anchor_x(region.z) - hill.offset[0]) / hill.extent[0];
        let dz = (z - region.z - hill.offset[1]) / hill.extent[1];
        if dx.abs() < 1. && dz.abs() < 1. {
            let shape = 1. - smooth(0.2, 1., (dx * dx + dz * dz).sqrt());
            height += hill.rise * shape;
        }
    }
    height
}
fn land_height(x: f32, z: f32) -> f32 {
    let mut h = raw_land_height(x, z);
    for court in map_courts() {
        let blend = 1. - smooth(0., 6., court.distance(Point::new(x, z)));
        h = h * (1. - blend) + court.height * blend;
    }
    h
}
pub fn map_height(x: f32, z: f32) -> f32 {
    let mut land = land_height(x, z);
    for landmark in map_landmarks() {
        if (z - landmark.pos.z).abs() > 8. || (x - landmark.pos.x).abs() > landmark.width * 0.5 + 4.
        {
            continue;
        }
        let weight = landmark.pad(Point::new(x, z));
        land = land * (1. - weight) + landmark.ground * weight;
    }
    let (water, level) = map_water(x, z);
    if water <= 0. {
        return land;
    }
    let ford = 1. - smooth(3.3, 7.2, (x - map_anchor_x(z)).abs());
    let bed = level - 2.0 + 1.8 * ford + (noise(x * 0.15, z * 0.15) - 0.5) * 0.12;
    land * (1. - water) + bed * water
}
pub fn map_ground_mask(x: f32, z: f32) -> [f32; 4] {
    map_ground_sample(
        x,
        z,
        map_height(x, z),
        (map_height(x + 1., z) - map_height(x - 1., z)) * 0.5,
        (map_height(x, z + 1.) - map_height(x, z - 1.)) * 0.5,
    )
}
pub fn map_ground_sample(x: f32, z: f32, h: f32, gx: f32, gz: f32) -> [f32; 4] {
    let bare = blend(z, |r| {
        if r.biome == "ochre" || r.biome == "volcanic" {
            0.8
        } else {
            0.
        }
    });
    let slope = (gx * gx + gz * gz).sqrt();
    let rock = smooth(0.15, 0.49, slope);
    let (water, level) = map_water(x, z);
    let shore = if water > 0. {
        1. - smooth(0.4, 2.5, (h - level).abs())
    } else {
        0.
    };
    let nx = (-gx, -gz);
    let length = (nx.0 * nx.0 + 1. + nx.1 * nx.1).sqrt();
    let light = ((nx.0 * -0.51 + 0.78 + nx.1 * -0.35) / length).max(0.);
    // Quiet grass / soil patches are drawn into this mesh, not thousands of
    // separate blades. They cost no model downloads or extra draw calls.
    let soil = smooth(0.58, 0.85, noise(x / 13. + 8., z / 15.)) * 0.38;
    let court = map_courts()
        .iter()
        .map(|c| 1. - smooth(0., 4., c.distance(Point::new(x, z))))
        .fold(0., f32::max);
    [
        bare.max(soil).max(court * 0.82),
        rock * (1. - court),
        shore,
        0.67 + light * 0.28,
    ]
}
/// Matches rendered grid triangles, including their shared diagonal.
pub fn map_surface_height(x: f32, z: f32) -> f32 {
    let grid = map_grid(
        (x / CHUNK_SIZE).floor() as i32,
        (z / CHUNK_SIZE).floor() as i32,
    );
    let step = grid.step;
    let x0 = (x / step).floor() * step;
    let z0 = (z / step).floor() * step;
    let u = (x - x0) / step;
    let v = (z - z0) / step;
    let ix = ((x0 - grid.origin.x) / step) as usize;
    let iz = ((z0 - grid.origin.z) / step) as usize;
    let mut xr = ix..=ix;
    let mut zr = iz..=iz;
    for (active, ratio) in [
        (ix == 0, grid.edges[0]),
        (ix + 1 == grid.divisions, grid.edges[1]),
    ] {
        if active && ratio > 1 {
            let lo = iz / ratio * ratio;
            zr = lo..=lo + ratio - 1;
        }
    }
    for (active, ratio) in [
        (iz == 0, grid.edges[2]),
        (iz + 1 == grid.divisions, grid.edges[3]),
    ] {
        if active && ratio > 1 {
            let lo = ix / ratio * ratio;
            xr = lo..=lo + ratio - 1;
        }
    }
    if xr.end() > xr.start() || zr.end() > zr.start() {
        for j in zr {
            for i in xr.clone() {
                for triangle in grid.triangles(i, j) {
                    if let Some(height) = grid.triangle_height(Point::new(x, z), triangle) {
                        return height;
                    }
                }
            }
        }
    }
    if u + v <= 1. {
        let a = map_height(x0, z0);
        a + (map_height(x0 + step, z0) - a) * u + (map_height(x0, z0 + step) - a) * v
    } else {
        let d = map_height(x0 + step, z0 + step);
        d + (map_height(x0, z0 + step) - d) * (1. - u) + (map_height(x0 + step, z0) - d) * (1. - v)
    }
}
#[derive(Clone, Copy, Debug)]
pub struct MapProp {
    pub pos: Point,
    /// Plant family; reeds have no solid root collision.
    pub tree: bool,
    /// Plants: pine, open pine, willow, broadleaf, bamboo, reeds, bank willow, apricot,
    /// low grass, wildflowers, fern. Low flora are a separate non-solid layer.
    /// Stones: ordinary boulder, low slate family.
    pub variant: u8,
    pub scale: f32,
    pub angle: f32,
}
impl MapProp {
    pub fn solid(&self) -> bool {
        !(self.tree && (self.variant == 5 || self.variant >= 8))
    }
    /// Indices in the scenery-derived map atlas; old symbols stay stable.
    pub fn symbol(&self) -> u8 {
        match (self.tree, self.variant) {
            (true, 6) => 19,
            (true, 5) => 20,
            (false, 1) => 21,
            (true, 7) => 24,
            (true, 8..=10) => self.variant + 17,
            (true, variant) => variant + 1,
            _ => 0,
        }
    }
    pub fn radius(&self) -> f32 {
        self.scale
            * if self.tree {
                match self.variant {
                    2 => 0.55,
                    3 => 0.68,
                    4 => 0.62,
                    5 | 8..=10 => 0.,
                    6 => 0.58,
                    7 => 0.58,
                    _ => 0.62,
                }
            } else if self.variant == 1 {
                1.45
            } else {
                1.18
            }
    }
    pub fn blocks(&self, p: Point) -> bool {
        if !self.solid() {
            return false;
        }
        if !self.tree && self.variant == 1 {
            // The low slate drawing is broad but shallow at its visible base.
            let x = (p.x - self.pos.x) / (self.radius() + 0.38);
            let z = (p.z - self.pos.z) / (self.scale * 0.55 + 0.38);
            x * x + z * z < 1.
        } else {
            p.distance(self.pos) < self.radius() + 0.38
        }
    }
    pub fn dimensions(&self) -> [f32; 3] {
        // The new boulder painting is authored at 2 * radius() width and
        // already has a low natural silhouette, rather than a stretched column.
        [self.scale, self.scale, self.scale]
    }
}
fn random(seed: &mut u32) -> f32 {
    *seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
    (*seed >> 8) as f32 / 16777216.
}
pub fn map_props(cx: i32, cz: i32) -> Vec<MapProp> {
    // The visible and collision neighbourhoods repeatedly ask for the same
    // deterministic layout. Keep a small CPU-only working set, never an
    // unbounded cache of all places visited in the extendable world.
    type PropCache = VecDeque<((i32, i32), Vec<MapProp>)>;
    static CACHE: OnceLock<Mutex<PropCache>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(VecDeque::new()));
    if let Some(props) = cache
        .lock()
        .expect("map layout cache")
        .iter()
        .find(|(key, _)| *key == (cx, cz))
        .map(|(_, props)| props.clone())
    {
        return props;
    }
    let props = build_map_props(cx, cz);
    let mut cache = cache.lock().expect("map layout cache");
    if cache.len() >= 96 {
        cache.pop_front();
    }
    cache.push_back(((cx, cz), props.clone()));
    props
}
fn build_map_props(cx: i32, cz: i32) -> Vec<MapProp> {
    let mut seed = (cx as u32).wrapping_mul(73856093) ^ (cz as u32).wrapping_mul(19349663) ^ 657871;
    let family_origin = seed;
    let mut props = Vec::with_capacity(24);
    // Authored first views are small, asymmetric groves around playable space.
    // Both rendering and collision obtain these exact same objects and roots.
    for grove in &layout().groves {
        let r = map_regions()
            .iter()
            .find(|r| r.id == grove.region)
            .expect("grove region");
        if (r.z - (cz as f32 + 0.5) * CHUNK_SIZE).abs() > 100. {
            continue;
        }
        let origin = map_anchor_x(r.z);
        for &[dx, dz, scale, kind] in &grove.props {
            let pos = Point::new(origin + dx, r.z + dz);
            if (pos.x / CHUNK_SIZE).floor() as i32 != cx
                || (pos.z / CHUNK_SIZE).floor() as i32 != cz
                || map_water(pos.x, pos.z).0 > 0.1
                || map_courts().iter().any(|c| c.distance(pos) < 2.)
                || map_field_sample(pos.x, pos.z)[0] > 0.2
                || map_landmarks()
                    .iter()
                    .any(|l| l.distance_to_foot(pos) < 2. || l.reserves_approach(pos))
            {
                continue;
            }
            props.push(MapProp {
                pos,
                tree: kind > 0.,
                variant: if kind >= 2. {
                    kind as u8
                } else {
                    (dx.abs() as u8) % 2
                },
                scale,
                angle: dx * 0.27 + dz * 0.13,
            });
        }
    }
    // Riverbank modules follow the actual curved banks. Small groups and gaps
    // leave the shallows and two-dimensional exploration open, not a hedge wall.
    for shore in &layout().shores {
        let region = map_regions()
            .iter()
            .position(|r| r.id == shore.region)
            .expect("shore region");
        let r = &map_regions()[region];
        if (r.z - (cz as f32 + 0.5) * CHUNK_SIZE).abs() > 110. {
            continue;
        }
        let count = (shore.reach / shore.spacing).floor() as i32;
        for side in [-1i32, 1] {
            for i in -count..=count {
                let mut seed = (i as u32).wrapping_mul(1597334677)
                    ^ (side as u32).wrapping_mul(3812015801)
                    ^ region as u32;
                let x =
                    map_anchor_x(r.z) + i as f32 * shore.spacing + (random(&mut seed) - 0.5) * 3.;
                let course = map_river_course(region, x);
                if (x - map_anchor_x(course)).abs() < 11. {
                    continue;
                }
                let (tree, variant, extension, scale) = match i.rem_euclid(7) {
                    0 => (true, 6, 10., 0.82 + random(&mut seed) * 0.24),
                    3 | 6 => (false, 1, 7.4, 0.85 + random(&mut seed) * 0.5),
                    _ => (true, 5, 6.8, 0.65 + random(&mut seed) * 0.5),
                };
                let pos = Point::new(
                    x,
                    course + side as f32 * (map_river_half_width(region, x) + extension),
                );
                let prop = MapProp {
                    pos,
                    tree,
                    variant,
                    scale,
                    angle: random(&mut seed) * std::f32::consts::TAU,
                };
                if (pos.x / CHUNK_SIZE).floor() as i32 != cx
                    || (pos.z / CHUNK_SIZE).floor() as i32 != cz
                    || map_water(pos.x, pos.z).0 > 0.1
                    || map_courts().iter().any(|c| c.distance(pos) < 2.)
                    || map_landmarks().iter().any(|l| {
                        l.distance_to_foot(pos) < prop.radius() + 1. || l.reserves_approach(pos)
                    })
                    || props
                        .iter()
                        .any(|p| p.pos.distance(pos) < p.radius() + prop.radius() + 0.7)
                {
                    continue;
                }
                props.push(prop);
                if tree && variant == 5 && i.rem_euclid(7) != 5 {
                    // Two or three rooted clumps form an irregular patch;
                    // other anchors remain empty gaps between these patches.
                    for j in 0..2 {
                        let px = x + (j as f32 * 2. - 1.) * (1.5 + random(&mut seed) * 1.2);
                        let pz = map_river_course(region, px)
                            + side as f32
                                * (map_river_half_width(region, px) + 7.5 + random(&mut seed) * 2.);
                        let pos = Point::new(px, pz);
                        if (pos.x / CHUNK_SIZE).floor() as i32 != cx
                            || (pos.z / CHUNK_SIZE).floor() as i32 != cz
                            || props.len() >= 48
                            || map_water(pos.x, pos.z).0 > 0.1
                            || map_landmarks()
                                .iter()
                                .any(|l| l.distance_to_foot(pos) < 1. || l.reserves_approach(pos))
                            || props.iter().any(|p| p.blocks(pos))
                        {
                            continue;
                        }
                        props.push(MapProp {
                            pos,
                            tree: true,
                            variant: 5,
                            scale: 0.5 + random(&mut seed) * 0.4,
                            angle: 0.,
                        });
                    }
                }
            }
        }
    }
    // Small groves and rock families have shared centres. Empty land remains
    // between them; individual props are no longer evenly sprinkled confetti.
    for i in 0..44 {
        let family = i / 11;
        let mut family_seed = family_origin.wrapping_add(family * 96973);
        let gx = 0.19 + random(&mut family_seed) * 0.62;
        let gz = 0.19 + random(&mut family_seed) * 0.62;
        let angle = random(&mut seed) * std::f32::consts::TAU;
        let offset = random(&mut seed).sqrt() * if family < 3 { 13. } else { 6. };
        let x = (cx as f32 + gx) * CHUNK_SIZE + angle.cos() * offset;
        let z = (cz as f32 + gz) * CHUNK_SIZE + angle.sin() * offset;
        let tree = family < 3;
        let density = blend(z, |r| r.groves);
        let accept = random(&mut seed);
        let scale = if tree {
            0.72 + random(&mut seed) * 0.66
        } else {
            0.42 + random(&mut seed) * 0.88
        };
        let angle = random(&mut seed) * std::f32::consts::TAU;
        let region = &map_regions()[map_region(z)];
        let near_arrival =
            Point::new(x, z).distance(Point::new(map_anchor_x(region.z), region.z)) < 8.;
        if tree && accept > (density * 1.18).min(1.)
            || near_arrival
            || map_courts()
                .iter()
                .any(|c| c.distance(Point::new(x, z)) < 2.)
            || map_water(x, z).0 > 0.1
            || map_field_sample(x, z)[0] > 0.2
            || map_landmarks().iter().any(|l| {
                l.distance_to_foot(Point::new(x, z)) < 3. || l.reserves_approach(Point::new(x, z))
            })
        {
            continue;
        }
        let prop = MapProp {
            pos: Point::new(x, z),
            tree,
            variant: if tree {
                let n = (random(&mut seed) * 10.) as u8;
                match region.biome.as_str() {
                    "river" | "garden" => [2, 4, 3, 2, 4][n as usize % 5],
                    "meadow" => [3, 2, 3, 0, 4][n as usize % 5],
                    _ => [0, 1, 3, 4, 0][n as usize % 5],
                }
            } else {
                0
            },
            scale,
            angle,
        };
        if props
            .iter()
            .any(|p: &MapProp| p.pos.distance(prop.pos) < p.radius() + prop.radius() + 0.6)
        {
            continue;
        }
        if props.len() < 48 {
            props.push(prop);
        }
    }
    props
}
/// Low, walk-through plants grow in irregular patches and around existing
/// groves. Their roots and family IDs are shared with the exploration map;
/// they never enter the solid-prop layer or form an invisible vegetation wall.
pub fn map_flora(cx: i32, cz: i32) -> Vec<MapProp> {
    type FloraCache = VecDeque<((i32, i32), Vec<MapProp>)>;
    static CACHE: OnceLock<Mutex<FloraCache>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(VecDeque::new()));
    if let Some(props) = cache
        .lock()
        .expect("flora cache")
        .iter()
        .find(|(key, _)| *key == (cx, cz))
        .map(|(_, props)| props.clone())
    {
        return props;
    }
    let mut seed =
        (cx as u32).wrapping_mul(374761393) ^ (cz as u32).wrapping_mul(668265263) ^ 120107;
    let grove = map_props(cx, cz)
        .into_iter()
        .filter(|p| p.tree && p.solid())
        .collect::<Vec<_>>();
    let mut plants = Vec::with_capacity(48);
    for family in 0..10 {
        let sheltered = family < 4 && !grove.is_empty();
        let origin = if sheltered {
            grove[family % grove.len()].pos
        } else {
            Point::new(
                (cx as f32 + 0.08 + random(&mut seed) * 0.84) * CHUNK_SIZE,
                (cz as f32 + 0.08 + random(&mut seed) * 0.84) * CHUNK_SIZE,
            )
        };
        let region = &map_regions()[map_region(origin.z)];
        let variant = if sheltered && family % 2 == 0 {
            10
        } else if random(&mut seed)
            < if matches!(region.biome.as_str(), "garden" | "meadow" | "river") {
                0.5
            } else {
                0.24
            }
        {
            9
        } else {
            8
        };
        let members = 3 + (random(&mut seed) * 3.) as usize;
        let phase = random(&mut seed) * std::f32::consts::TAU;
        for member in 0..members {
            let angle = phase + member as f32 * 2.4 + random(&mut seed) * 0.7;
            let radius = if sheltered {
                2.4 + random(&mut seed) * 3.4
            } else {
                random(&mut seed).sqrt() * 4.8
            };
            let pos = Point::new(
                origin.x + angle.cos() * radius,
                origin.z + angle.sin() * radius,
            );
            let scale = 0.68 + random(&mut seed) * 0.52;
            if (pos.x / CHUNK_SIZE).floor() as i32 != cx
                || (pos.z / CHUNK_SIZE).floor() as i32 != cz
                || map_water(pos.x, pos.z).0 > 0.1
                || map_field_sample(pos.x, pos.z)[0] > 0.1
                || map_courts().iter().any(|c| c.distance(pos) < 0.8)
                || map_landmarks()
                    .iter()
                    .any(|l| l.distance_to_foot(pos) < 1. || l.reserves_approach(pos))
                || !map_passable(pos)
                || (map_height(pos.x + 0.8, pos.z) - map_height(pos.x - 0.8, pos.z)).abs() > 0.9
                || (map_height(pos.x, pos.z + 0.8) - map_height(pos.x, pos.z - 0.8)).abs() > 0.9
                || plants.iter().any(|p: &MapProp| p.pos.distance(pos) < 0.65)
            {
                continue;
            }
            plants.push(MapProp {
                pos,
                tree: true,
                variant,
                scale,
                angle,
            });
        }
    }
    let mut cache = cache.lock().expect("flora cache");
    if cache.len() >= 96 {
        cache.pop_front();
    }
    cache.push_back(((cx, cz), plants.clone()));
    plants
}
pub fn map_passable(p: Point) -> bool {
    if map_landmarks().iter().any(|l| l.distance_to_foot(p) < 0.38) {
        return false;
    }
    let (water, level) = map_water(p.x, p.z);
    if water > 0.1 && level - map_surface_height(p.x, p.z) > 0.6 {
        return false;
    }
    let cx = (p.x / CHUNK_SIZE).floor() as i32;
    let cz = (p.z / CHUNK_SIZE).floor() as i32;
    (cx - 1..=cx + 1)
        .all(|x| (cz - 1..=cz + 1).all(|z| map_props(x, z).iter().all(|prop| !prop.blocks(p))))
}
/// Survey relief and objects from the same terrain / layout used by gameplay.
/// Requested only when a map window changes, never attached to every frame.
#[derive(Serialize)]
pub struct MapChart {
    x: f32,
    z: f32,
    span: f32,
    size: usize,
    terrain: Vec<[i16; 3]>,
    props: Vec<[f32; 4]>,
}
pub fn map_chart(x: f32, z: f32, span: f32) -> MapChart {
    let span = span.clamp(128., 1024.);
    let size = 65;
    let mut terrain = Vec::with_capacity(size * size);
    for j in 0..size {
        for i in 0..size {
            let px = x - span * 0.5 + i as f32 * span / (size - 1) as f32;
            let pz = z - span * 0.5 + j as f32 * span / (size - 1) as f32;
            let h = map_height(px, pz);
            let (wet, level) = map_water(px, pz);
            let depth = if wet > 0.1 { (level - h).max(0.) } else { 0. };
            terrain.push([
                (h * 10.).round() as i16,
                (depth.min(2.) * 100.).round() as i16,
                (noise(px / 13. + 8., pz / 15.) * 100.).round() as i16,
            ]);
        }
    }
    let mut props = Vec::new();
    let x0 = ((x - span * 0.5) / CHUNK_SIZE).floor() as i32;
    let x1 = ((x + span * 0.5) / CHUNK_SIZE).floor() as i32;
    let z0 = ((z - span * 0.5) / CHUNK_SIZE).floor() as i32;
    let z1 = ((z + span * 0.5) / CHUNK_SIZE).floor() as i32;
    for cx in x0..=x1 {
        for cz in z0..=z1 {
            for p in map_props(cx, cz) {
                if (p.pos.x - x).abs() <= span * 0.5 && (p.pos.z - z).abs() <= span * 0.5 {
                    props.push([p.pos.x, p.pos.z, f32::from(p.symbol()), p.scale]);
                }
            }
            for (i, p) in map_flora(cx, cz).into_iter().enumerate() {
                if (span <= 512. || i % 3 == 0)
                    && (p.pos.x - x).abs() <= span * 0.5
                    && (p.pos.z - z).abs() <= span * 0.5
                {
                    props.push([p.pos.x, p.pos.z, f32::from(p.symbol()), p.scale]);
                }
            }
        }
    }
    MapChart {
        x,
        z,
        span,
        size,
        terrain,
        props,
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Expedition {
    pub version: u8,
    pub region: usize,
    pub visited: u32,
    pub distance: f32,
    pub pos: Point,
    pub restored_from: Option<Point>,
}
fn restore_map_position(p: Point) -> Point {
    if map_passable(p) {
        return p;
    }
    // A scenery revision can put a visible tree/river over an old footpoint.
    // Move to nearby safe ground instead of erasing a distant map checkpoint.
    for ring in 1..=16 {
        for step in 0..16 {
            let angle = step as f32 * std::f32::consts::TAU / 16.;
            let radius = ring as f32 * 0.75;
            let candidate = Point::new(p.x + angle.cos() * radius, p.z + angle.sin() * radius);
            if map_passable(candidate) {
                return candidate;
            }
        }
    }
    Point::new(map_anchor_x(p.z), p.z)
}
impl Run {
    fn new_expedition(&self, input: Input) -> Self {
        let mut run = Self::new_journey(self.seed, JourneyCheckpoint::default());
        let requested = input.map_position.filter(|p| {
            p.x.is_finite() && p.z.is_finite() && p.x.abs() < 1_000_000. && p.z.abs() < 1_000_000.
        });
        let p = requested
            .map(restore_map_position)
            .unwrap_or(Point::new(map_anchor_x(0.), 0.));
        run.master = p;
        run.hero = p;
        let region = map_region(p.z);
        run.expedition = Some(Expedition {
            version: 1,
            region,
            visited: input.map_visited | (1u32 << region),
            distance: 0.,
            pos: p,
            restored_from: requested,
        });
        run
    }
    pub(crate) fn step_expedition(&mut self, dt: f32, input: Input) {
        if input.action == 13 {
            *self = Self::new(self.seed);
            return;
        }
        if input.action == 11 {
            *self = self.new_expedition(input);
            return;
        }
        if input.action == 2 && self.phase == Phase::Playing {
            self.phase = Phase::Paused;
        }
        if input.action == 3 && self.phase == Phase::Paused {
            self.phase = Phase::Playing;
        }
        if input.action == 12 && self.phase == Phase::Paused {
            let region = &map_regions()[usize::from(input.map_target).min(map_regions().len() - 1)];
            self.master = Point::new(map_anchor_x(region.z), region.z);
            self.hero = self.master;
            let e = self.expedition.as_mut().expect("map mode");
            e.pos = self.master;
            e.region = map_region(self.master.z);
            e.visited |= 1u32 << e.region;
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
        let length = (x * x + z * z).sqrt().max(1.);
        let delta = Point::new(x / length * 7.4 * dt, z / length * 7.4 * dt);
        let old = self.master;
        let wanted = Point::new(old.x + delta.x, old.z + delta.z);
        if map_passable(wanted) {
            self.master = wanted;
        } else {
            let horizontal = Point::new(old.x + delta.x, old.z);
            if map_passable(horizontal) {
                self.master = horizontal;
            }
            let vertical = Point::new(self.master.x, old.z + delta.z);
            if map_passable(vertical) {
                self.master = vertical;
            }
        }
        self.hero = self.master;
        if let Some(j) = &mut self.journey
            && x.abs() + z.abs() > 0.01
        {
            j.monk_facing = x.atan2(z);
        }
        let e = self.expedition.as_mut().expect("map mode");
        e.distance += self.master.distance(old);
        e.pos = self.master;
        e.region = map_region(self.master.z);
        e.visited |= 1u32 << e.region;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn gao_estate_gate_fields_and_fence_gaps_keep_two_dimensional_access() {
        let gate = map_landmarks()
            .iter()
            .find(|m| m.id == "gaolao_estate_gate")
            .unwrap();
        for step in -50..=50 {
            let p = Point::new(gate.pos.x, gate.pos.z + step as f32 * 0.2);
            assert!(map_passable(p), "estate gate passage blocked {p:?}");
        }
        // Each visible side opening must leave usable width after the actor's
        // body radius, not only a mathematically passable centre point.
        for side in [-6.45, 6.45] {
            for across in [-0.45, 0., 0.45] {
                for step in -20..=20 {
                    let p = Point::new(gate.pos.x + side + across, gate.pos.z + step as f32 * 0.2);
                    assert!(map_passable(p), "gate-fence gap too narrow {p:?}");
                }
            }
        }
        for fence in map_landmarks()
            .iter()
            .filter(|m| m.id.starts_with("gaolao_fence_"))
        {
            assert!(!map_passable(fence.pos), "visible fence must remain solid");
            for z in [-2., 2.] {
                assert!(
                    map_passable(Point::new(fence.pos.x, fence.pos.z + z)),
                    "fence side blocks exploration {}",
                    fence.id
                );
            }
            for x in [-3.6, 3.6] {
                assert!(
                    map_passable(Point::new(fence.pos.x + x, fence.pos.z)),
                    "fence end blocks exploration {}",
                    fence.id
                );
            }
        }
        let mut checked_fields = 0;
        for (spec, field) in layout()
            .fields
            .iter()
            .zip(map_fields())
            .filter(|(s, _)| s.region == "gaolao")
        {
            let (s, c) = field.angle.sin_cos();
            for i in -4..=4 {
                for j in -4..=4 {
                    let u = field.extent[0] * 0.8 * i as f32 / 4.;
                    let v = field.extent[1] * 0.8 * j as f32 / 4.;
                    let p = Point::new(field.pos.x + u * c - v * s, field.pos.z + u * s + v * c);
                    assert!(
                        map_passable(p),
                        "field should be open {:?} {p:?}",
                        spec.offset
                    );
                }
            }
            checked_fields += 1;
        }
        assert_eq!(checked_fields, 8);
        let chart = map_chart(map_anchor_x(3200.), 3200., 256.);
        let flowers = chart
            .props
            .iter()
            .filter(|p| p[2] == 24.)
            .collect::<Vec<_>>();
        println!(
            "gaolao flowering trees={} chart props={}",
            flowers.len(),
            chart.props.len()
        );
        assert!(
            flowers.len() >= 8,
            "flower trees must survive actual court/field exclusions"
        );
        for tree in flowers {
            assert!(
                !map_passable(Point::new(tree[0], tree[1])),
                "visible flower-tree root must be solid"
            );
        }
    }
    #[test]
    fn stitched_grid_covers_chunks_and_actor_height_matches_real_triangle_planes() {
        let mut cases = Vec::<MapGrid>::new();
        for x in -10..=8 {
            for z in 27..=33 {
                let grid = map_grid(x, z);
                if grid.edges.iter().all(|e| *e == 1)
                    || cases
                        .iter()
                        .any(|c| c.step == grid.step && c.edges == grid.edges)
                {
                    continue;
                }
                cases.push(grid);
            }
        }
        assert!(cases.iter().any(|g| g.step == 0.5));
        assert!(cases.iter().any(|g| g.step == 1.));
        let mut tested = 0;
        for grid in cases {
            let mut area_sum = 0.;
            for z in 0..grid.divisions {
                for x in 0..grid.divisions {
                    for tri in grid.triangles(x, z) {
                        if tri[0] == tri[1] || tri[0] == tri[2] || tri[1] == tri[2] {
                            continue;
                        }
                        let [a, b, c] = tri.map(|i| grid.point(i));
                        let area = ((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) * -0.5;
                        assert!(area > 0., "inverted or collapsed stitch");
                        area_sum += area;
                        for index in tri {
                            let ix = index as usize % (grid.divisions + 1);
                            let iz = index as usize / (grid.divisions + 1);
                            if ix == 0 {
                                assert_eq!(iz % grid.edges[0], 0);
                            }
                            if ix == grid.divisions {
                                assert_eq!(iz % grid.edges[1], 0);
                            }
                            if iz == 0 {
                                assert_eq!(ix % grid.edges[2], 0);
                            }
                            if iz == grid.divisions {
                                assert_eq!(ix % grid.edges[3], 0);
                            }
                        }
                        if x == 0 || z == 0 || x + 1 == grid.divisions || z + 1 == grid.divisions {
                            let p = Point::new((a.x + b.x + c.x) / 3., (a.z + b.z + c.z) / 3.);
                            let expected = (map_height(a.x, a.z)
                                + map_height(b.x, b.z)
                                + map_height(c.x, c.z))
                                / 3.;
                            assert!(
                                (map_surface_height(p.x, p.z) - expected).abs() < 0.03,
                                "actor left stitched triangle at {p:?}"
                            );
                            tested += 1;
                        }
                    }
                }
            }
            assert!(
                (area_sum - CHUNK_SIZE * CHUNK_SIZE).abs() < 0.001,
                "stitched chunk must have no holes or double area"
            );
        }
        assert!(tested > 1000);
    }
    #[test]
    fn rendered_shore_follows_analytic_land_and_grid_vertices_keep_actor_contact() {
        let region = &map_regions()[3];
        let crossing = |x: f32, side: f32, sample: fn(f32, f32) -> f32| {
            let course = map_river_course(3, x);
            let mut lo = 0.;
            let mut hi = map_river_half_width(3, x) + 12.;
            for _ in 0..24 {
                let mid = (lo + hi) * 0.5;
                if sample(x, course + side * mid) < region.height - 1. {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            course + side * (lo + hi) * 0.5
        };
        let mut worst: f32 = 0.;
        let mut worst_point = [0.; 4];
        let mut squared = 0.;
        for i in -60..=60 {
            let x = region.x + i as f32 * 2.5 + 0.37;
            for side in [-1., 1.] {
                let analytic = crossing(x, side, map_height);
                let rendered = crossing(x, side, map_surface_height);
                let error = (rendered - analytic).abs();
                if error > worst {
                    worst = error;
                    worst_point = [x, side, analytic, rendered];
                }
                squared += error * error;
            }
        }
        println!(
            "shore contour max={worst:.5}m rms={:.5}m point={worst_point:?}",
            (squared / 242.).sqrt()
        );
        assert!(worst < 0.12, "shore approximation displaced {worst}m");
        for r in map_regions() {
            let grid = map_grid(
                (map_anchor_x(r.z) / CHUNK_SIZE).floor() as i32,
                (r.z / CHUNK_SIZE).floor() as i32,
            );
            for x in [2, grid.divisions / 2, grid.divisions - 2] {
                for z in [2, grid.divisions / 2, grid.divisions - 2] {
                    let p = grid.point((z * (grid.divisions + 1) + x) as u32);
                    assert!((map_surface_height(p.x, p.z) - map_height(p.x, p.z)).abs() < 0.001);
                }
            }
        }
    }
    #[test]
    fn riverbank_plants_are_grounded_non_solid_reeds_do_not_close_the_banks() {
        let r = &map_regions()[3];
        let cx = (map_anchor_x(r.z) / CHUNK_SIZE).floor() as i32;
        let cz = (r.z / CHUNK_SIZE).floor() as i32;
        let props = (-4..=4)
            .flat_map(|x| (-2..=2).flat_map(move |z| map_props(cx + x, cz + z)))
            .collect::<Vec<_>>();
        let reeds = props
            .iter()
            .filter(|p| p.symbol() == 20)
            .collect::<Vec<_>>();
        let willows = props
            .iter()
            .filter(|p| p.symbol() == 19)
            .collect::<Vec<_>>();
        let slate = props
            .iter()
            .filter(|p| p.symbol() == 21)
            .collect::<Vec<_>>();
        assert!(reeds.len() >= 20 && willows.len() >= 4 && slate.len() >= 10);
        println!(
            "riverbank scenery reeds={} willows={} slate={}",
            reeds.len(),
            willows.len(),
            slate.len()
        );
        for p in &reeds {
            assert!(map_passable(p.pos), "reeds block walking {:?}", p.pos);
            assert!(map_water(p.pos.x, p.pos.z).0 <= 0.1);
        }
        for p in willows.iter().chain(&slate) {
            assert!(
                !map_passable(p.pos),
                "visible solid foot missing {:?}",
                p.pos
            );
        }
        for p in &slate {
            let approach = Point::new(p.pos.x, p.pos.z - p.scale * 0.55 - 0.48);
            assert!(
                map_passable(approach),
                "air gap before slate {:?}",
                approach
            );
        }
        for side in [-1., 1.] {
            assert!(
                reeds
                    .iter()
                    .any(|p| { (p.pos.z - map_river_course(3, p.pos.x)) * side > 0. })
            );
        }
        let reed = reeds
            .iter()
            .find(|p| {
                (-25..=25).all(|i| map_passable(Point::new(p.pos.x, p.pos.z + i as f32 * 0.1)))
            })
            .expect("walk-through reed study");
        let mut run = Run::default();
        run.step(
            0.,
            Input {
                action: 11,
                map_position: Some(Point::new(reed.pos.x, reed.pos.z - 2.)),
                ..Input::default()
            },
        );
        for _ in 0..12 {
            run.step(
                0.05,
                Input {
                    z: 1.,
                    ..Input::default()
                },
            );
        }
        assert!(run.master.z > reed.pos.z + 2.);
        let chart = map_chart(reed.pos.x, reed.pos.z, 256.);
        assert!(chart.props.iter().any(|p| p[2] == 20.));
        for x in -4..=4 {
            for z in -2..=2 {
                assert!(map_props(cx + x, cz + z).len() <= 48);
            }
        }
    }
    #[test]
    fn cave_has_real_backing_relief_and_stone_paving_stays_local() {
        let region = map_regions().iter().find(|r| r.id == "heifeng").unwrap();
        let cave = map_landmarks()
            .iter()
            .find(|m| m.id == "black_wind_cave")
            .unwrap();
        let summit = Point::new(map_anchor_x(region.z) - 72., region.z + 82.);
        assert!(
            map_surface_height(summit.x, summit.z) > cave.ground + 10.,
            "cave backing must be actual relief"
        );
        let court = map_courts().iter().find(|c| c.stone).unwrap();
        assert_eq!(map_field_sample(court.pos.x, court.pos.z), [1., 100.]);
        assert_eq!(map_field_sample(court.pos.x + 100., court.pos.z)[0], 0.);
        for offset in [-34., 34.] {
            let x = summit.x + offset;
            assert!(
                (map_surface_height(x - 0.001, summit.z) - map_surface_height(x + 0.001, summit.z))
                    .abs()
                    < 0.01
            );
        }
    }
    #[test]
    fn monastery_gate_and_bell_are_walk_through_but_closed_doors_are_solid() {
        let find = |id| map_landmarks().iter().find(|m| m.id == id).unwrap();
        let gate = find("guanyin_gate");
        let start = Point::new(gate.pos.x - 0.4, gate.pos.z - 6.);
        let mut run = Run::default();
        run.step(
            0.,
            Input {
                action: 11,
                map_position: Some(start),
                ..Input::default()
            },
        );
        for _ in 0..80 {
            run.step(
                0.05,
                Input {
                    z: 1.,
                    ..Input::default()
                },
            );
        }
        assert!(
            run.master.z > gate.pos.z + 20.,
            "gate passage or open forecourt blocked {:?}",
            run.master
        );
        assert!(run.enemies.is_empty());
        let bell = find("guanyin_bell");
        for step in -30..=30 {
            assert!(
                map_passable(Point::new(bell.pos.x, bell.pos.z + step as f32 * 0.1)),
                "bell opening blocked {step}"
            );
        }
        let hall = find("guanyin_hall");
        let cave = find("black_wind_cave");
        assert!(!map_passable(hall.pos));
        assert!(!map_passable(cave.pos));
        for step in -30..=30 {
            for side in [-1., 1.] {
                assert!(
                    map_passable(Point::new(
                        cave.pos.x + side * 8.6,
                        cave.pos.z + step as f32 * 0.1
                    )),
                    "cave outside edge blocked"
                );
            }
        }
    }
    #[test]
    fn open_court_and_visible_house_feet_remain_consistent() {
        let court = &map_courts()[0];
        for x in -40..=-22 {
            for z in 57..=71 {
                let p = Point::new(x as f32, z as f32);
                assert!(map_passable(p), "open court blocked {p:?}");
                assert!(
                    (map_surface_height(p.x, p.z) - court.height).abs() < 0.02,
                    "uneven house foundation"
                );
            }
        }
        for house in map_landmarks()
            .iter()
            .filter(|m| m.pack == 1 && m.scene == 0)
        {
            assert!(
                !map_passable(house.pos),
                "closed dwelling wall should remain solid"
            );
        }
    }
    #[test]
    fn landmark_feet_are_solid_but_the_passage_and_main_route_are_open() {
        assert_eq!(map_landmarks().len(), 68);
        for l in map_landmarks() {
            for foot in &l.feet {
                assert!(
                    !map_passable(Point::new(l.pos.x + foot[0], l.pos.z + foot[1])),
                    "foot {}",
                    l.id
                );
                let ground = map_surface_height(l.pos.x + foot[0], l.pos.z + foot[1]);
                assert!(
                    (ground - l.ground).abs() < 0.12,
                    "floating foundation {}",
                    l.id
                );
            }
        }
        let gate = &map_landmarks()[1];
        let pavilion = &map_landmarks()[0];
        for step in -20..=3 {
            let p = Point::new(pavilion.pos.x + 0.4, pavilion.pos.z + step as f32 * 0.25);
            assert!(map_passable(p), "pavilion approach blocked {p:?}");
        }
        for step in -50..=50 {
            let z = gate.pos.z + step as f32 * 0.1;
            assert!(
                map_passable(Point::new(map_anchor_x(z), z)),
                "gateway blocked {z}"
            );
        }
    }
    #[test]
    fn scenery_revisions_restore_near_blocked_saves_without_resetting_the_journey() {
        let source = map_props(-2, 30)
            .into_iter()
            .next()
            .expect("ravine prop")
            .pos;
        let mut run = Run::default();
        run.step(
            0.,
            Input {
                action: 11,
                map_position: Some(source),
                map_visited: 15,
                ..Input::default()
            },
        );
        let expedition = run.expedition.as_ref().unwrap();
        assert!(map_passable(run.master));
        assert!(run.master.distance(source) < 12.1);
        assert_eq!(expedition.restored_from, Some(source));
        assert_eq!(expedition.visited & 15, 15);
        assert_eq!(expedition.region, 3);
    }
    #[test]
    fn curved_river_has_a_continuous_crossing_and_keeps_groves_out_of_the_path() {
        let r = &map_regions()[3];
        let heights = (-32..=32)
            .map(|dx| map_river_course(3, r.x + dx as f32))
            .collect::<Vec<_>>();
        assert!(
            heights.iter().copied().fold(f32::NEG_INFINITY, f32::max)
                - heights.iter().copied().fold(f32::INFINITY, f32::min)
                > 15.
        );
        for dz in 0..150 {
            let z = r.z + dz as f32 * 0.5;
            assert!(
                map_passable(Point::new(map_anchor_x(z), z)),
                "ford blocked at {z}"
            );
        }
        for i in 0..4 {
            let r = &map_regions()[i];
            let cx = (map_anchor_x(r.z) / CHUNK_SIZE).floor() as i32;
            let cz = (r.z / CHUNK_SIZE).floor() as i32;
            let nearby = (-1..=1)
                .flat_map(|z| (-1..=1).map(move |x| (cx + x, cz + z)))
                .flat_map(|(x, z)| map_props(x, z))
                .filter(|p| p.pos.distance(Point::new(map_anchor_x(r.z), r.z)) < 30.)
                .collect::<Vec<_>>();
            assert!(
                nearby.iter().any(|p| p.tree),
                "no authored trees near {}",
                r.id
            );
            assert!(
                nearby.iter().any(|p| !p.tree),
                "no authored stones near {}",
                r.id
            );
        }
    }
    #[test]
    fn terrain_keeps_its_shape_across_paths_and_decorations_have_a_budget() {
        let mut trees = 0;
        let mut stones = 0;
        for x in -4..5 {
            for z in -4..5 {
                let props = map_props(x, z);
                assert!(props.len() <= 48);
                for prop in props {
                    if prop.tree {
                        trees += 1;
                    } else {
                        stones += 1;
                    }
                    assert!(map_water(prop.pos.x, prop.pos.z).0 <= 0.1);
                    assert!(prop.dimensions().iter().all(|v| v.is_finite() && *v > 0.));
                }
            }
        }
        assert!(trees > 20 && stones > 20);
        let y = (0..40)
            .map(|z| map_height(map_anchor_x(z as f32), z as f32))
            .collect::<Vec<_>>();
        assert!(
            y.iter().copied().fold(f32::NEG_INFINITY, f32::max)
                - y.iter().copied().fold(f32::INFINITY, f32::min)
                > 0.08
        );
    }
    #[test]
    fn every_region_has_connected_two_dimensional_exploration_without_a_cleared_road() {
        // Flood actual movement cells, rather than assuming a perfectly straight
        // highway or an empty horizontal row. Trees and water remain solid.
        for region in map_regions() {
            let center = Point::new(map_anchor_x(region.z), region.z);
            let n = 65usize;
            let at = |i: usize, j: usize| {
                Point::new(
                    center.x + (i as f32 - 32.) * 2.,
                    center.z + (j as f32 - 32.) * 2.,
                )
            };
            let mut seen = vec![false; n * n];
            let mut queue = VecDeque::from([(32usize, 32usize)]);
            seen[32 * n + 32] = true;
            while let Some((i, j)) = queue.pop_front() {
                for (dx, dz) in [(1isize, 0), (-1, 0), (0, 1), (0, -1)] {
                    let a = i as isize + dx;
                    let b = j as isize + dz;
                    if a < 0 || b < 0 || a >= n as isize || b >= n as isize {
                        continue;
                    }
                    let a = a as usize;
                    let b = b as usize;
                    if !seen[b * n + a] && map_passable(at(a, b)) {
                        seen[b * n + a] = true;
                        queue.push_back((a, b));
                    }
                }
            }
            for (axis, target) in [(0, 4usize), (0, 60), (1, 4), (1, 60)] {
                assert!(
                    (0..n).any(|v| if axis == 0 {
                        seen[v * n + target]
                    } else {
                        seen[target * n + v]
                    }),
                    "inaccessible direction {} {axis} {target}",
                    region.id
                );
            }
        }
        // Objects can occupy the former continuous road and arrival row.
        assert!(
            (-3..=3)
                .flat_map(|cx| (0..=8).flat_map(move |cz| map_props(cx, cz)))
                .any(|p| (p.pos.x - map_anchor_x(p.pos.z)).abs() < 5.)
        );
    }
    #[test]
    fn terrain_has_no_seams_and_chart_uses_actual_world_data() {
        for z in -500..20_500 {
            let z = z as f32;
            let x = map_anchor_x(z);
            assert!(
                (map_height(x, z) - map_height(x, z + 0.01)).abs() < 0.05,
                "height seam {z}"
            );
        }
        let chart = map_chart(0., 0., 256.);
        assert_eq!(chart.terrain.len(), 65 * 65);
        assert_eq!(
            chart.terrain[32 * 65 + 32][0],
            (map_height(0., 0.) * 10.).round() as i16
        );
        assert!(chart.props.iter().any(|p| p[2] >= 3.));
        assert!(chart.props.iter().all(|p| {
            let cx = (p[0] / CHUNK_SIZE).floor() as i32;
            let cz = (p[1] / CHUNK_SIZE).floor() as i32;
            map_props(
                (p[0] / CHUNK_SIZE).floor() as i32,
                (p[1] / CHUNK_SIZE).floor() as i32,
            )
            .iter()
            .chain(map_flora(cx, cz).iter())
            .any(|v| v.pos.distance(Point::new(p[0], p[1])) < 0.01 && f32::from(v.symbol()) == p[2])
        }));
    }
    #[test]
    fn low_flora_are_repeatable_walk_through_patches_shared_with_the_map() {
        let mut families = [0usize; 3];
        let mut total = 0;
        for cz in -2..=65 {
            for cx in -1..=1 {
                let a = map_flora(cx, cz);
                let b = map_flora(cx, cz);
                assert_eq!(a.len(), b.len());
                assert!(a.len() <= 50, "bounded static plant layout");
                for (plant, again) in a.iter().zip(b.iter()) {
                    assert_eq!(plant.pos, again.pos);
                    assert_eq!(plant.variant, again.variant);
                    assert!(!plant.solid() && !plant.blocks(plant.pos));
                    assert_eq!(plant.radius(), 0.);
                    assert!(
                        map_passable(plant.pos),
                        "no low plant can hide a solid root / wall"
                    );
                    assert!(map_water(plant.pos.x, plant.pos.z).0 <= 0.1);
                    assert!(map_field_sample(plant.pos.x, plant.pos.z)[0] <= 0.1);
                    assert_eq!((plant.pos.x / CHUNK_SIZE).floor() as i32, cx);
                    assert_eq!((plant.pos.z / CHUNK_SIZE).floor() as i32, cz);
                    families[(plant.variant - 8) as usize] += 1;
                }
                total += a.len();
            }
        }
        assert!(families.iter().all(|n| *n > 300));
        println!(
            "map flora sampled={} grass/flowers/fern={:?}",
            total, families
        );
        let chart = map_chart(0., 0., 256.);
        assert!(chart.props.iter().any(|p| p[2] == 25.));
        assert!(chart.props.iter().any(|p| p[2] == 26.));
        assert!(chart.props.iter().any(|p| p[2] == 27.));
        assert!(map_chart(0., 0., 1024.).props.len() < 20000);
    }
    #[test]
    fn chunk_sampling_and_decoration_are_repeatable() {
        for (x, z) in [(-4, -3), (0, 0), (2, 19), (5, 304)] {
            let a = map_props(x, z);
            let b = map_props(x, z);
            assert_eq!(a.len(), b.len());
            for (a, b) in a.iter().zip(b.iter()) {
                assert_eq!(a.pos, b.pos);
                assert!(!map_passable(a.pos));
            }
            let edge = (x + 1) as f32 * CHUNK_SIZE;
            for i in 0..17 {
                let z = z as f32 * CHUNK_SIZE + i as f32 * 4.;
                assert!(
                    (map_surface_height(edge - 0.001, z) - map_surface_height(edge + 0.001, z))
                        .abs()
                        < 0.01
                );
            }
        }
    }
    #[test]
    fn movement_pause_and_map_position_do_not_advance_combat() {
        let mut r = Run::default();
        r.step(
            0.,
            Input {
                action: 11,
                ..Input::default()
            },
        );
        for _ in 0..14 {
            r.step(
                0.05,
                Input {
                    z: 1.,
                    ..Input::default()
                },
            );
        }
        assert!(r.master.z > 5.);
        assert!(r.enemies.is_empty());
        assert_eq!(r.level, 1);
        r.step(
            0.,
            Input {
                action: 2,
                ..Input::default()
            },
        );
        let old = r.master;
        r.step(
            0.05,
            Input {
                x: 1.,
                z: 1.,
                ..Input::default()
            },
        );
        assert_eq!(old, r.master);
        r.step(
            0.,
            Input {
                action: 12,
                map_target: 31,
                ..Input::default()
            },
        );
        assert_eq!(r.master.z, 19840.);
        r.step(
            0.,
            Input {
                action: 3,
                ..Input::default()
            },
        );
        r.step(
            0.05,
            Input {
                z: 1.,
                ..Input::default()
            },
        );
        assert!(r.master.z > 19840.);
        assert_eq!(r.phase, Phase::Playing);
    }
}
