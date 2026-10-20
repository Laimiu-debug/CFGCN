//! Small reusable landmarks; no extra model download or per-frame GPU allocation.
use super::*;

#[derive(Component)]
pub struct Landmark {
    pub chapter: u8,
    pub kind: u8,
}

pub fn setup(
    mut commands: Commands,
    sim: Res<Simulation>,
    mut initialized: Local<bool>,
    server: Res<AssetServer>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if *initialized || sim.0.expedition.is_some() {
        return;
    }
    *initialized = true;
    let cube = meshes.add(Cuboid::new(1., 1., 1.));
    let ring = meshes.add(Plane3d::default().mesh().size(2.1, 2.1));
    let wood = materials.add(StandardMaterial {
        base_color: series_color("gold-ink"),
        perceptual_roughness: 0.95,
        ..default()
    });
    let paper = materials.add(StandardMaterial {
        base_color: series_color("paper-raised"),
        perceptual_roughness: 0.95,
        ..default()
    });
    let jade = materials.add(StandardMaterial {
        base_color: series_color("jade"),
        perceptual_roughness: 0.9,
        ..default()
    });
    let gold = materials.add(StandardMaterial {
        base_color: series_color("paper-raised").with_alpha(0.72),
        base_color_texture: Some(server.load("fx/lotus.png")),
        alpha_mode: AlphaMode::Blend,
        unlit: true,
        ..default()
    });
    let mut prop = |chapter,
                    kind,
                    mesh: Handle<Mesh>,
                    material: Handle<StandardMaterial>,
                    position: Vec3,
                    scale: Vec3| {
        let world_z = position.z + if chapter == 3 { 64. } else { 0. };
        let position = Vec3::new(
            position.x,
            position.y + cfgcn_game_core::terrain_height(position.x, world_z),
            world_z,
        );
        commands.spawn((
            Landmark { chapter, kind },
            Mesh3d(mesh),
            MeshMaterial3d(material),
            Transform::from_translation(position).with_scale(scale),
            Visibility::Hidden,
        ));
    };
    // A timber roadside gateway and paper lanterns set the departure scene.
    for z in [-10., 42.] {
        for x in [-4., 4.] {
            prop(
                0,
                0,
                cube.clone(),
                wood.clone(),
                Vec3::new(x, 2.2, z),
                Vec3::new(0.35, 4.4, 0.35),
            );
            prop(
                0,
                0,
                cube.clone(),
                paper.clone(),
                Vec3::new(x * 0.72, 2.9, z),
                Vec3::new(0.55, 0.85, 0.55),
            );
        }
        prop(
            0,
            0,
            cube.clone(),
            wood.clone(),
            Vec3::new(0., 4.2, z),
            Vec3::new(9.6, 0.4, 0.8),
        );
        prop(
            0,
            0,
            cube.clone(),
            jade.clone(),
            Vec3::new(0., 4.55, z),
            Vec3::new(10.2, 0.25, 1.3),
        );
    }
    // The hunter's rest has a cloth shelter, supplies and a low timber fence.
    for x in [5.5, 8.5] {
        for z in [35., 39.] {
            prop(
                1,
                0,
                cube.clone(),
                wood.clone(),
                Vec3::new(x, 1.5, z),
                Vec3::new(0.18, 3., 0.18),
            );
        }
    }
    prop(
        1,
        0,
        cube.clone(),
        paper.clone(),
        Vec3::new(7., 3., 37.),
        Vec3::new(3.8, 0.22, 5.),
    );
    for i in 0..5 {
        prop(
            1,
            0,
            cube.clone(),
            wood.clone(),
            Vec3::new(8. + (i % 2) as f32, 0.45, 31. + i as f32),
            Vec3::new(0.8, 0.9, 0.8),
        );
        prop(
            1,
            0,
            cube.clone(),
            wood.clone(),
            Vec3::new(-5., 0.6, 33. + i as f32 * 1.5),
            Vec3::new(0.15, 1.2, 0.15),
        );
    }
    prop(
        1,
        0,
        cube.clone(),
        wood.clone(),
        Vec3::new(-5., 0.85, 36.),
        Vec3::new(0.16, 0.12, 7.),
    );
    prop(
        2,
        1,
        ring.clone(),
        gold.clone(),
        Vec3::new(0., 0.13, 18.),
        Vec3::ONE,
    );
    prop(
        3,
        3,
        ring.clone(),
        gold.clone(),
        Vec3::new(0., 0.13, 18.),
        Vec3::ONE,
    );
    // Each route has the same readable exit marker when its objective is fulfilled.
    for chapter in 0..4 {
        prop(
            chapter,
            2,
            ring.clone(),
            gold.clone(),
            Vec3::new(0., 0.14, 38.),
            Vec3::ONE,
        );
        if chapter < 2 {
            prop(
                chapter,
                2,
                cube.clone(),
                wood.clone(),
                Vec3::new(-3.8, 1.8, 38.),
                Vec3::new(0.12, 3.6, 0.12),
            );
            prop(
                chapter,
                2,
                cube.clone(),
                paper.clone(),
                Vec3::new(-3., 3., 38.),
                Vec3::new(1.5, 0.9, 0.08),
            );
        }
    }
}

pub fn sync(sim: Res<Simulation>, mut props: Query<(&Landmark, &mut Visibility)>) {
    for (landmark, mut visibility) in &mut props {
        let visible = sim.0.expedition.is_none()
            && sim.0.journey.as_ref().is_some_and(|j| {
                (j.chapter == landmark.chapter
                    || j.world.is_some() && landmark.chapter >= 2
                    || landmark.kind == 6 && j.chapter < 2)
                    && match landmark.kind {
                        1 => !j.joined,
                        2 => j.exit_open,
                        3 => j.dragon_defeated && !j.dragon_joined,
                        4 => j.world.as_ref().is_some_and(|w| w.events & 2 == 0),
                        5 => j.world.is_some(),
                        6 => j.world.is_none() && j.chapter < 2,
                        _ => true,
                    }
            });
        *visibility = if visible {
            Visibility::Inherited
        } else {
            Visibility::Hidden
        };
    }
}
