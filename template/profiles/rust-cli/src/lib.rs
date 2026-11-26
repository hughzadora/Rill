use std::num::NonZeroU64;

/// Counts the minimum full or partial batches needed for `items`.
///
/// ```
/// use batch_plan::minimum_batches;
/// use std::num::NonZeroU64;
///
/// assert_eq!(minimum_batches(13, NonZeroU64::new(5).unwrap()), 3);
/// ```
pub fn minimum_batches(items: u64, capacity: NonZeroU64) -> u64 {
    let capacity = capacity.get();
    items / capacity + u64::from(!items.is_multiple_of(capacity))
}
