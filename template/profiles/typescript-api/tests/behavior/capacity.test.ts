import { expect, test } from "bun:test";
import fc from "fast-check";
import { canAccommodate } from "../../src/domain/capacity";

test("admission agrees with the position of the last guest in an independent seat model", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 0, max: 100 }),
      (requested, available) => {
        const seats = Array.from({ length: available }, (_, index) => index + 1);
        expect(canAccommodate(requested, available)).toBe(seats.includes(requested));
      },
    ),
    {
      seed: 94191,
      numRuns: 200,
      examples: [
        [1, 0],
        [1, 1],
        [100, 99],
        [100, 100],
      ],
    },
  );
});
