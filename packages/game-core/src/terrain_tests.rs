use crate::*;

#[test]
fn curved_water_and_shallow_ford_use_the_same_profile() {
    let j = Run::new_journey(
        42,
        JourneyCheckpoint {
            chapter: 3,
            ..Default::default()
        },
    )
    .journey
    .unwrap();
    for x in [-11., -8., -4., 4., 8., 11.] {
        let centre = river_center(x);
        assert!((centre - 90.).abs() > 0.5);
        assert!(j.water(Point::new(x, centre)));
        assert!(!j.water(Point::new(x, centre + river_width(x) + 0.1)));
        assert!(terrain_height(x, centre) < 0.12);
    }
    for x in [-2., 0., 2.] {
        assert!(!j.water(Point::new(x, river_center(x))));
        assert!(terrain_height(x, river_center(x)) > -0.11);
        assert!(terrain_height(x, river_center(x)) < 0.12);
    }
}

#[test]
fn route_height_is_continuous_and_has_no_steps_at_streaming_seam() {
    for x in [-6., -2., 0., 2., 6.] {
        assert!((terrain_height(x, 58.001) - terrain_height(x, 57.999)).abs() < 0.002);
    }
    // End toes are intentionally steep visible boundaries; the route between
    // them remains gentle and continuous.
    for i in -15..1070 {
        let z = i as f32 / 10.;
        let h = terrain_height(0., z);
        assert!(h.is_finite() && h > -0.11 && h < 5.);
        assert!(
            (h - terrain_height(0., z + 0.1)).abs() < 0.12,
            "steep centre path at {z}"
        );
    }
}

#[test]
fn open_shoulders_have_no_old_width_steps_and_limits_meet_rocky_relief() {
    let j = Run::new_journey(
        42,
        JourneyCheckpoint {
            chapter: 3,
            events: 31,
            dragon_joined: true,
            ..Default::default()
        },
    )
    .journey
    .unwrap();
    for z in [39.99, 40.01, 58.99, 59.01] {
        for x in [-10., 10.] {
            let mut p = Point::new(x, z);
            j.bound(&mut p);
            assert_eq!(
                p,
                Point::new(x, z),
                "open ground unexpectedly blocked at {x},{z}"
            );
        }
    }
    for i in 0..1080 {
        let z = i as f32 / 10.;
        let width = valley_width(z);
        assert!(
            (valley_width(z + 0.01) - width).abs() < 0.02,
            "width jumps at {z}"
        );
        for sign in [-1., 1.] {
            let toe = terrain_height(valley_center(z) + sign * width, z);
            let outside = terrain_height(valley_center(z) + sign * (width + 0.8), z);
            assert!(
                outside - toe > 0.9,
                "boundary must be a visible steep mineral toe, {z}"
            );
        }
    }
    for x in [-10., 0., 10.] {
        assert!(
            terrain_height(x, 108.8) - terrain_height(x, 108.) > 1.,
            "north limit must meet the same visible steep toe"
        );
        assert!(
            terrain_height(x, -3.8) - terrain_height(x, -3.) > 1.,
            "south limit must meet a visible steep toe"
        );
    }
}
