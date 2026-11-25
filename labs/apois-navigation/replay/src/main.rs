use ferrostar::{
    deviation_detection::RouteDeviationTracking,
    navigation_controller::{
        NavigationController, Navigator,
        models::{CourseFiltering, NavigationControllerConfig, TripState, WaypointAdvanceMode},
        step_advance::step_advance_distance_to_end_of_step,
    },
    routing_adapters::{RouteResponseParser, osrm::OsrmResponseParser},
    simulation::{LocationBias, advance_location_simulation, location_simulation_from_coordinates},
};
use std::{env, fs, time::{Duration, SystemTime}};

fn main() {
    let path = env::args().nth(1).expect("OSRM fixture path");
    let route = OsrmResponseParser::new(6).parse_response(fs::read(&path).expect("read fixture"))
        .expect("actual Ferrostar OSRM parser").into_iter().next().expect("route");
    assert!(route.geometry.len() >= 2 && route.steps.len() >= 2 && route.distance > 0.0);
    let mut location = location_simulation_from_coordinates(&route.geometry, Some(5.0), LocationBias::None)
        .expect("actual Ferrostar GPS simulation");
    let config = NavigationControllerConfig {
        waypoint_advance: WaypointAdvanceMode::WaypointWithinRange(30.0),
        step_advance_condition: step_advance_distance_to_end_of_step(15, 25),
        arrival_step_advance_condition: step_advance_distance_to_end_of_step(15, 25),
        route_deviation_tracking: RouteDeviationTracking::StaticThreshold {
            minimum_horizontal_accuracy: 25, max_acceptable_deviation: 50.0,
        },
        snapped_location_course_filtering: CourseFiltering::SnapToRoute,
    };
    let controller = NavigationController::new(route.clone(), config);
    let initial = controller.get_initial_state(location.current_location.clone());
    let initial_distance = match initial.trip_state() {
        TripState::Navigating { progress, .. } => progress.distance_remaining,
        _ => panic!("route should start in navigation"),
    };
    // Separate deviation test: precise synthetic fix 1 km off the route.
    // No operational arrival or completion RPC.
    let mut off = location.current_location.clone();
    off.coordinates.lat += 0.01;
    off.horizontal_accuracy = 5.0;
    let deviated = controller.update_user_location(off, initial.clone());
    match deviated.trip_state() {
        TripState::Navigating { deviation, .. } => assert!(deviation.is_completely_off_route()),
        _ => panic!("off-route sample must not complete navigation"),
    };
    let mut state = initial;
    let base_time = SystemTime::now();
    let mut fixes = 0u64;
    let mut last_remaining = initial_distance;
    let mut spoken = 0usize;
    loop {
        let next = advance_location_simulation(&location);
        if next == location { break; }
        location = next;
        fixes += 1;
        assert!(fixes < 100_000, "simulation bounded");
        let mut fix = location.current_location.clone();
        fix.timestamp = base_time + Duration::from_secs(fixes);
        fix.horizontal_accuracy = 5.0;
        state = controller.update_user_location(fix, state);
        match state.trip_state() {
            TripState::Navigating { progress, spoken_instruction, .. } => {
                assert!(progress.distance_remaining.is_finite());
                last_remaining = progress.distance_remaining;
                if spoken_instruction.is_some() { spoken += 1; }
            },
            TripState::Complete { .. } => { last_remaining = 0.0; break; },
            _ => panic!("unexpected idle"),
        }
    }
    assert!(fixes > 1 && last_remaining < initial_distance * 0.1, "progress must advance toward destination");
    for i in 1..=5 {
        if matches!(state.trip_state(), TripState::Complete { .. }) { break; }
        let mut fix = location.current_location.clone();
        fix.timestamp = base_time + Duration::from_secs(fixes + i);
        fix.horizontal_accuracy = 5.0;
        state = controller.update_user_location(fix, state);
    }
    assert!(matches!(state.trip_state(), TripState::Complete { .. }), "arrival must be recognized by navigation engine");
    println!("APOIS_REPLAY_OK fixture={path} route_m={:.2} fixes={fixes} initial_m={initial_distance:.2} off_route=true arrival=true spoken_instruction_fixes={spoken}", route.distance);
    // Spoken instruction presence is not proof of audible TTS or pt-BR.
}
