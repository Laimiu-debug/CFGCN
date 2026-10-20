//! Construction counts from the same grid topology as the browser renderer.
//! These are allocated ground vertices / triangles, not FPS or GPU timing.
use cfgcn_game_core::{CHUNK_SIZE, map_anchor_x, map_grid, map_regions};
use serde::Serialize;

#[derive(Serialize)]
struct Geometry<'a> {
    region: &'a str,
    cells: usize,
    half_metre_cells: usize,
    one_metre_cells: usize,
    two_metre_cells: usize,
    ground_vertices: usize,
    ground_triangles: usize,
}

fn main() {
    let mut records = Vec::new();
    for region in map_regions() {
        let cx = (map_anchor_x(region.z) / CHUNK_SIZE).floor() as i32;
        let cz = (region.z / CHUNK_SIZE).floor() as i32;
        let mut record = Geometry {
            region: &region.id,
            cells: 0,
            half_metre_cells: 0,
            one_metre_cells: 0,
            two_metre_cells: 0,
            ground_vertices: 0,
            ground_triangles: 0,
        };
        for x in cx - 2..=cx + 2 {
            for z in cz - 2..=cz + 2 {
                let grid = map_grid(x, z);
                record.cells += 1;
                if grid.step == 0.5 {
                    record.half_metre_cells += 1;
                } else if grid.step == 1. {
                    record.one_metre_cells += 1;
                } else {
                    record.two_metre_cells += 1;
                }
                record.ground_vertices += (grid.divisions + 1).pow(2);
                for iz in 0..grid.divisions {
                    for ix in 0..grid.divisions {
                        for tri in grid.triangles(ix, iz) {
                            if tri[0] != tri[1] && tri[0] != tri[2] && tri[1] != tri[2] {
                                record.ground_triangles += 1;
                            }
                        }
                    }
                }
            }
        }
        records.push(record);
    }
    println!("{}", serde_json::to_string_pretty(&records).unwrap());
}
