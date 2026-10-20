//! Fixed-size neighbourhood of a large world; distant cells own no GPU geometry.
use super::*;
use bevy::{
    asset::RenderAssetUsages,
    mesh::{Indices, PrimitiveTopology},
};
use cfgcn_game_core::{
    CHUNK_SIZE, map_field_sample, map_flora, map_grid, map_ground_sample, map_height,
    map_landmarks, map_props, map_surface_height, map_water,
};

struct Cell {
    root: Entity,
    meshes: Vec<Handle<Mesh>>,
}
#[derive(Resource, Default)]
pub struct MapAtlas {
    cells: HashMap<(i32, i32), Cell>,
    pub built: usize,
    pub released: usize,
    pub peak: usize,
    pub center: (i32, i32),
    pub ready: bool,
    art: Option<AtlasArt>,
    shadow: Option<Entity>,
}
struct AtlasArt {
    ground: Handle<paint::PaintedMaterial>,
    water: Handle<paint::PaintedMaterial>,
    shadow: Handle<paint::PaintedMaterial>,
    shadow_mesh: Handle<Mesh>,
    scenery: Handle<Gltf>,
    landmarks: Handle<Gltf>,
    hamlet: Handle<Gltf>,
    settlement: Handle<Gltf>,
    heifeng: Handle<Gltf>,
    riverbank: Handle<Gltf>,
    gaolao: Handle<Gltf>,
    flora: Handle<paint::PaintedMaterial>,
    flora_texture: Handle<Image>,
    texture: Handle<Image>,
}
impl MapAtlas {
    pub fn failed(&self, server: &AssetServer) -> bool {
        self.art.as_ref().is_some_and(|art| {
            matches!(
                server.get_load_state(art.scenery.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.landmarks.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.hamlet.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.settlement.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.heifeng.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.riverbank.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.gaolao.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.flora_texture.id()),
                Some(bevy::asset::LoadState::Failed(_))
            ) || matches!(
                server.get_load_state(art.texture.id()),
                Some(bevy::asset::LoadState::Failed(_))
            )
        })
    }
    pub fn count(&self) -> usize {
        self.cells.len()
    }
    pub fn mesh_count(&self) -> usize {
        self.cells.values().map(|c| c.meshes.len()).sum()
    }
}
fn mesh(cx: i32, cz: i32, water: bool) -> Option<Mesh> {
    let grid = map_grid(cx, cz);
    let step = grid.step;
    let n = grid.divisions;
    let x0 = cx as f32 * CHUNK_SIZE;
    let z0 = cz as f32 * CHUNK_SIZE;
    if water
        && !(0..=4)
            .any(|z| (0..=4).any(|x| map_water(x0 + x as f32 * 16., z0 + z as f32 * 16.).0 > 0.))
    {
        return None;
    }
    // All detail levels derive normals at +/- one metre. Shared vertices have
    // identical normals and painted masks, even where the index density changes.
    let sampling_step = step.min(1.);
    let scale = (step / sampling_step) as usize;
    let padding = (1. / sampling_step) as usize;
    let size = n * scale + padding * 2 + 1;
    let props = (-1..=1)
        .flat_map(|z| (-1..=1).map(move |x| (cx + x, cz + z)))
        .flat_map(|(x, z)| map_props(x, z))
        .filter(|p| {
            p.pos.x > x0 - 14.
                && p.pos.x < x0 + CHUNK_SIZE + 14.
                && p.pos.z > z0 - 14.
                && p.pos.z < z0 + CHUNK_SIZE + 14.
        })
        .collect::<Vec<_>>();
    let heights = (0..size)
        .flat_map(|z| {
            (0..size).map(move |x| {
                map_height(
                    x0 + (x as f32 - padding as f32) * sampling_step,
                    z0 + (z as f32 - padding as f32) * sampling_step,
                )
            })
        })
        .collect::<Vec<_>>();
    let mut positions = Vec::with_capacity((n + 1) * (n + 1));
    let mut normals = Vec::with_capacity((n + 1) * (n + 1));
    let mut uv = Vec::with_capacity((n + 1) * (n + 1));
    let mut colors = Vec::with_capacity((n + 1) * (n + 1));
    let mut indices = Vec::with_capacity(n * n * 6);
    for z in 0..=n {
        for x in 0..=n {
            let wx = x0 + x as f32 * step;
            let wz = z0 + z as f32 * step;
            let hx = x * scale + padding;
            let hz = z * scale + padding;
            let h = heights[hz * size + hx];
            let gx = (heights[hz * size + hx + padding] - heights[hz * size + hx - padding]) * 0.5;
            let gz =
                (heights[(hz + padding) * size + hx] - heights[(hz - padding) * size + hx]) * 0.5;
            let (wet, level) = map_water(wx, wz);
            positions.push([
                x as f32 * step,
                if water { level + 0.035 } else { h },
                z as f32 * step,
            ]);
            let normal = if water {
                Vec3::Y
            } else {
                Vec3::new(-gx, 1., -gz).normalize()
            };
            normals.push(normal.to_array());
            let field = map_field_sample(wx, wz);
            uv.push(field);
            colors.push(if water {
                // Retain signed depth so the shader can soften the true bank
                // intersection instead of interpolating pre-clamped corners.
                [level - h, 0., 0., wet * 0.86]
            } else {
                let mut sample = map_ground_sample(wx, wz, h, gx, gz);
                sample[0] = sample[0].max(field[0] * 0.7);
                let mut shadow: f32 = 0.;
                for prop in &props {
                    let low_cover = !prop.solid();
                    let height = prop.scale
                        * if low_cover {
                            0.7
                        } else if prop.tree {
                            3.7
                        } else {
                            0.8
                        };
                    let dx = wx - prop.pos.x - height * 0.51;
                    let dz = wz - prop.pos.z - height * 0.35;
                    let radius = prop.scale
                        * if low_cover {
                            1.2
                        } else if prop.tree {
                            2.8
                        } else {
                            1.6
                        };
                    let d = (dx * dx + dz * dz) / (radius * radius);
                    shadow =
                        shadow.max((1. - d).max(0.).powi(2) * if low_cover { 0.12 } else { 0.27 });
                    let contact = ((wx - prop.pos.x).powi(2) + (wz - prop.pos.z).powi(2))
                        / (prop.radius() + 0.9).powi(2);
                    shadow = shadow.max((1. - contact).max(0.) * if low_cover { 0.1 } else { 0.3 });
                }
                for landmark in map_landmarks() {
                    if (wz - landmark.pos.z).abs() < 8.
                        && (wx - landmark.pos.x).abs() < landmark.width * 0.5 + 4.
                    {
                        let d =
                            landmark.distance_to_foot(cfgcn_game_core::Point::new(wx, wz)) / 1.5;
                        shadow = shadow.max((1. - d * d).max(0.) * 0.2);
                    }
                }
                sample[3] *= 1. - shadow;
                sample
            });
        }
    }
    for z in 0..n {
        for x in 0..n {
            for triangle in grid.triangles(x, z) {
                if triangle[0] == triangle[1]
                    || triangle[0] == triangle[2]
                    || triangle[1] == triangle[2]
                {
                    continue;
                }
                if !water || triangle.iter().any(|i| colors[*i as usize][3] > 0.04) {
                    indices.extend_from_slice(&triangle);
                }
            }
        }
    }
    if indices.is_empty() {
        return None;
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    );
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uv);
    mesh.insert_attribute(Mesh::ATTRIBUTE_COLOR, colors);
    mesh.insert_indices(Indices::U32(indices));
    Some(mesh)
}
#[derive(serde::Deserialize)]
struct FloraPart {
    rect: [f32; 4],
    metres: f32,
    #[serde(rename = "anchorX")]
    anchor_x: f32,
}
#[derive(serde::Deserialize)]
struct FloraPacking {
    width: f32,
    height: f32,
    parts: Vec<FloraPart>,
}
fn flora_mesh(cx: i32, cz: i32) -> Option<Mesh> {
    static PACKING: std::sync::OnceLock<FloraPacking> = std::sync::OnceLock::new();
    let packing = PACKING.get_or_init(|| {
        serde_json::from_str(include_str!("../../art/ink-flora/packing.json"))
            .expect("validated flora atlas")
    });
    let plants = map_flora(cx, cz);
    if plants.is_empty() {
        return None;
    }
    let mut positions = Vec::with_capacity(plants.len() * 4);
    let mut normals = Vec::with_capacity(plants.len() * 4);
    let mut uv = Vec::with_capacity(plants.len() * 4);
    let mut indices = Vec::with_capacity(plants.len() * 6);
    let rotation = scenery_rotation();
    let normal = (rotation * Vec3::Z).to_array();
    for plant in plants {
        let part = &packing.parts[(plant.variant - 8) as usize];
        let [x0, y0, x1, y1] = part.rect;
        let width = part.metres * plant.scale;
        let height = width * (y1 - y0) / (x1 - x0);
        let left = (x0 - part.anchor_x) / (x1 - x0) * width;
        let index = positions.len() as u32;
        for (x, y) in [
            (left, 0.),
            (left + width, 0.),
            (left + width, height),
            (left, height),
        ] {
            let foot = rotation * Vec3::new(x, 0., 0.);
            let offset = rotation * Vec3::new(x, y, 0.);
            positions.push([
                plant.pos.x - cx as f32 * CHUNK_SIZE + offset.x,
                map_surface_height(plant.pos.x + foot.x, plant.pos.z + foot.z) + 0.015 + offset.y,
                plant.pos.z - cz as f32 * CHUNK_SIZE + offset.z,
            ]);
            normals.push(normal);
        }
        uv.extend([
            [x0 / packing.width, y1 / packing.height],
            [x1 / packing.width, y1 / packing.height],
            [x1 / packing.width, y0 / packing.height],
            [x0 / packing.width, y0 / packing.height],
        ]);
        indices.extend([index, index + 1, index + 2, index, index + 2, index + 3]);
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::RENDER_WORLD,
    );
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uv);
    mesh.insert_indices(Indices::U32(indices));
    Some(mesh)
}
#[allow(clippy::too_many_arguments)]
pub fn stream(
    mut commands: Commands,
    sim: Res<Simulation>,
    server: Res<AssetServer>,
    gltfs: Res<Assets<Gltf>>,
    mut atlas: ResMut<MapAtlas>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<paint::PaintedMaterial>>,
    mut shadows: Query<&mut Transform, Without<Actor>>,
    mut clear: ResMut<ClearColor>,
) {
    if sim.0.expedition.is_none() {
        clear.0 = series_color("scene-mist");
        atlas.released += atlas.cells.len();
        for (_, cell) in atlas.cells.drain() {
            commands.entity(cell.root).despawn();
        }
        if let Some(e) = atlas.shadow.take() {
            commands.entity(e).despawn();
        }
        atlas.art = None;
        atlas.ready = false;
        return;
    }
    clear.0 = series_color("paper");
    if atlas.art.is_none() {
        let mut material = |token, mode, alpha, texture| {
            materials.add(paint::PaintedMaterial {
                tint: if mode == 15. {
                    LinearRgba::WHITE
                } else {
                    series_color(token).to_linear()
                },
                texture,
                mist: series_color("paper").to_linear(),
                unlit: Vec4::new(1., mode, 0., 0.),
                alpha,
                vat_texture: None,
                vat_meta: Vec4::ZERO,
                vat_lower: Vec4::ZERO,
                vat_span: Vec4::ZERO,
            })
        };
        let texture = server.load("ink-terrain.jpg");
        let flora_texture = server.load("ink-flora.png");
        atlas.art = Some(AtlasArt {
            ground: material("paper", 16., AlphaMode::Opaque, Some(texture.clone())),
            water: material("accent-shuihu", 17., AlphaMode::Blend, None),
            shadow: material("ink", 5., AlphaMode::Blend, None),
            shadow_mesh: meshes.add(Plane3d::default().mesh().size(1.5, 1.5)),
            scenery: server.load("ink_scenery.glb"),
            landmarks: server.load("ink_landmarks.glb"),
            hamlet: server.load("ink_hamlet.glb"),
            settlement: server.load("ink_settlement.glb"),
            heifeng: server.load("ink_heifeng.glb"),
            riverbank: server.load("ink_river.glb"),
            gaolao: server.load("ink_gaolao.glb"),
            flora: material(
                "paper",
                15.,
                AlphaMode::Mask(0.18),
                Some(flora_texture.clone()),
            ),
            flora_texture,
            texture,
        });
    }
    let art = atlas.art.as_ref().expect("initialized above");
    let Some(scenery) = gltfs
        .get(&art.scenery)
        .filter(|_| server.is_loaded_with_dependencies(art.scenery.id()))
    else {
        return;
    };
    let Some(landmarks) = gltfs
        .get(&art.landmarks)
        .filter(|_| server.is_loaded_with_dependencies(art.landmarks.id()))
    else {
        return;
    };
    if !server.is_loaded_with_dependencies(art.texture.id())
        || !server.is_loaded_with_dependencies(art.flora_texture.id())
    {
        return;
    }
    let Some(hamlet) = gltfs
        .get(&art.hamlet)
        .filter(|_| server.is_loaded_with_dependencies(art.hamlet.id()))
    else {
        return;
    };
    let ground = art.ground.clone();
    let Some(settlement) = gltfs
        .get(&art.settlement)
        .filter(|_| server.is_loaded_with_dependencies(art.settlement.id()))
    else {
        return;
    };
    let water = art.water.clone();
    let flora = art.flora.clone();
    let Some(heifeng) = gltfs
        .get(&art.heifeng)
        .filter(|_| server.is_loaded_with_dependencies(art.heifeng.id()))
    else {
        return;
    };
    let Some(riverbank) = gltfs
        .get(&art.riverbank)
        .filter(|_| server.is_loaded_with_dependencies(art.riverbank.id()))
    else {
        return;
    };
    let Some(gaolao) = gltfs
        .get(&art.gaolao)
        .filter(|_| server.is_loaded_with_dependencies(art.gaolao.id()))
    else {
        return;
    };
    if let Some(mut material) = materials.get_mut(&water) {
        material.unlit.z = if reduced_motion() { 0. } else { sim.0.elapsed };
    }
    let p = sim.0.master;
    let transform = Transform::from_xyz(p.x, map_surface_height(p.x, p.z) + 0.035, p.z);
    if let Some(e) = atlas.shadow {
        if let Ok(mut t) = shadows.get_mut(e) {
            *t = transform;
        }
    } else {
        atlas.shadow = Some(
            commands
                .spawn((
                    Mesh3d(art.shadow_mesh.clone()),
                    MeshMaterial3d(art.shadow.clone()),
                    transform,
                ))
                .id(),
        );
    }
    let center = (
        (p.x / CHUNK_SIZE).floor() as i32,
        (p.z / CHUNK_SIZE).floor() as i32,
    );
    atlas.center = center;
    let remove = atlas
        .cells
        .keys()
        .copied()
        .filter(|(x, z)| (x - center.0).abs() > 2 || (z - center.1).abs() > 2)
        .collect::<Vec<_>>();
    for key in remove {
        if let Some(cell) = atlas.cells.remove(&key) {
            commands.entity(cell.root).despawn();
            atlas.released += 1;
        }
    }
    let mut desired = (-2i32..=2)
        .flat_map(|z| (-2i32..=2).map(move |x| (center.0 + x, center.1 + z)))
        .collect::<Vec<_>>();
    desired.sort_by_key(|(x, z)| (x - center.0).pow(2) + (z - center.1).pow(2));
    // Build at most two cells per rendered frame. The second ring is prepared
    // well before the camera can see a new cell boundary.
    for (cx, cz) in desired
        .into_iter()
        .filter(|key| !atlas.cells.contains_key(key))
        .take(2)
        .collect::<Vec<_>>()
    {
        let root = commands
            .spawn(Transform::from_xyz(
                cx as f32 * CHUNK_SIZE,
                0.,
                cz as f32 * CHUNK_SIZE,
            ))
            .id();
        let mut handles = vec![];
        for is_water in [false, true] {
            if let Some(mesh) = mesh(cx, cz, is_water) {
                let handle = meshes.add(mesh);
                handles.push(handle.clone());
                commands.spawn((
                    Mesh3d(handle),
                    MeshMaterial3d(if is_water {
                        water.clone()
                    } else {
                        ground.clone()
                    }),
                    Transform::default(),
                    ChildOf(root),
                ));
            }
        }
        // All low plants in this cell share one mesh and atlas material;
        // they do not add a scene hierarchy or draw per grass / flower clump.
        if let Some(mesh) = flora_mesh(cx, cz) {
            let handle = meshes.add(mesh);
            handles.push(handle.clone());
            commands.spawn((
                Mesh3d(handle),
                MeshMaterial3d(flora.clone()),
                Transform::default(),
                ChildOf(root),
            ));
        }
        for landmark in map_landmarks().iter().filter(|l| {
            (l.pos.x / CHUNK_SIZE).floor() as i32 == cx
                && (l.pos.z / CHUNK_SIZE).floor() as i32 == cz
        }) {
            let pack = match landmark.pack {
                1 => hamlet,
                2 => settlement,
                3 => heifeng,
                4 => gaolao,
                _ => landmarks,
            };
            commands.spawn((
                WorldAssetRoot(pack.scenes[landmark.scene].clone()),
                Transform::from_xyz(
                    landmark.pos.x - cx as f32 * CHUNK_SIZE,
                    map_surface_height(landmark.pos.x, landmark.pos.z) - 0.025,
                    landmark.pos.z - cz as f32 * CHUNK_SIZE,
                )
                .with_rotation(scenery_rotation()),
                ChildOf(root),
            ));
        }
        for (index, prop) in map_props(cx, cz).into_iter().enumerate() {
            commands.spawn((
                WorldAssetRoot(if !prop.tree {
                    if prop.variant == 1 {
                        riverbank.scenes[2].clone()
                    } else {
                        scenery.scenes[1].clone()
                    }
                } else {
                    match prop.variant {
                        1 => scenery.scenes[2].clone(),
                        2 => hamlet.scenes[1].clone(),
                        3 => settlement.scenes[3].clone(),
                        4 => settlement.scenes[4].clone(),
                        5 => riverbank.scenes[1].clone(),
                        6 => riverbank.scenes[0].clone(),
                        7 => gaolao.scenes[2].clone(),
                        _ => scenery.scenes[0].clone(),
                    }
                }),
                Transform::from_xyz(
                    prop.pos.x - cx as f32 * CHUNK_SIZE,
                    map_surface_height(prop.pos.x, prop.pos.z) - 0.025,
                    prop.pos.z - cz as f32 * CHUNK_SIZE,
                )
                .with_scale(Vec3::from_array(prop.dimensions()))
                .with_rotation(scenery_rotation()),
                ChildOf(root),
            ));
            // One depth-writing atlas is shared by the projected Studio-derived
            // ink drawings. Groundcover remains visibly low and non-solid.
            if prop.tree && prop.solid() && index % 2 == 0 {
                for side in [-1., 1.] {
                    let x = prop.pos.x + (prop.angle + side).cos() * 2.4;
                    let z = prop.pos.z + (prop.angle + side).sin() * 2.4;
                    commands.spawn((
                        WorldAssetRoot(scenery.scenes[3].clone()),
                        Transform::from_xyz(
                            x - cx as f32 * CHUNK_SIZE,
                            map_surface_height(x, z) - 0.06,
                            z - cz as f32 * CHUNK_SIZE,
                        )
                        .with_scale(Vec3::new(0.8, 0.34, 0.8))
                        .with_rotation(scenery_rotation()),
                        ChildOf(root),
                    ));
                }
            }
        }
        atlas.cells.insert(
            (cx, cz),
            Cell {
                root,
                meshes: handles,
            },
        );
        atlas.built += 1;
    }
    atlas.peak = atlas.peak.max(atlas.cells.len());
    // Walking never waits for the outer prefetch ring. After a cell crossing,
    // the old neighbourhood already contains this complete inner ring.
    atlas.ready =
        (-1..=1).all(|z| (-1..=1).all(|x| atlas.cells.contains_key(&(center.0 + x, center.1 + z))));
}

fn scenery_rotation() -> Quat {
    // Match the puppet's fixed drawing plane, rather than turning a flat tree
    // edge-on according to its procedural placement angle.
    Transform::from_xyz(0., 22., -24.)
        .looking_at(Vec3::ZERO, Vec3::Y)
        .rotation
}
