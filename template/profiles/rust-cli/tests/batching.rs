use std::num::NonZeroU64;

use batch_plan::minimum_batches;
use proptest::prelude::*;
use proptest::test_runner::FileFailurePersistence;

#[test]
fn exact_loads_and_extreme_inputs_have_known_answers() {
    for (items, capacity, expected) in [
        (0, 5, 0),
        (20, 5, 4),
        (21, 5, 5),
        (u64::MAX, 1, u64::MAX),
        (u64::MAX, 2, 1 << 63),
        (u64::MAX, u64::MAX, 1),
    ] {
        assert_eq!(
            minimum_batches(items, NonZeroU64::new(capacity).unwrap()),
            expected
        );
    }
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 256,
        failure_persistence: Some(Box::new(FileFailurePersistence::Direct(
            "reports/batching.proptest-regressions",
        ))),
        ..ProptestConfig::default()
    })]

    #[test]
    fn the_answer_fits_all_items_and_one_fewer_cannot(
        items in any::<u64>(),
        capacity in prop_oneof![1..=1024u64, 1..=u64::MAX],
    ) {
        let actual = minimum_batches(items, NonZeroU64::new(capacity).unwrap());
        let (items, capacity, actual) = (u128::from(items), u128::from(capacity), u128::from(actual));
        prop_assert!(actual * capacity >= items, "computed batches cannot fit all items");
        if items == 0 {
            prop_assert_eq!(actual, 0);
        } else {
            prop_assert!(actual > 0);
            prop_assert!((actual - 1) * capacity < items, "computed batches are not minimal");
        }
    }
}
