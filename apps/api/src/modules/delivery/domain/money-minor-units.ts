const MINOR_UNITS = Object.freeze({
  perMajorUnit: 100,
  roundHalfAwayFromZero: (value: number): number => {
    const rounded = value < 0 ? -Math.round(-value) : Math.round(value);
    return rounded === 0 ? 0 : rounded;
  },
  roundingGuardDigits: 6,
  scale: 2,
});

type WeightShare = {
  base: number;
  index: number;
  remainder: number;
};

export function distributeMinorUnits({
  totalMinorUnits,
  weights,
}: {
  totalMinorUnits: number;
  weights: readonly number[];
}): number[] {
  if (weights.length === 0) {
    return [];
  }

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const spreadEvenly = weightSum === 0;
  const effectiveWeights = spreadEvenly ? weights.map(() => 1) : weights;
  const effectiveWeightSum = spreadEvenly ? effectiveWeights.length : weightSum;

  const shares: WeightShare[] = effectiveWeights.map((weight, index) => {
    const exactShare = (totalMinorUnits * weight) / effectiveWeightSum;
    const base = Math.floor(exactShare);
    return { base, index, remainder: exactShare - base };
  });

  const allocatedBase = shares.reduce((sum, share) => sum + share.base, 0);
  const unitsLeftOver = totalMinorUnits - allocatedBase;
  const boostedIndexes = new Set(
    [...shares]
      .sort(byLargestRemainderThenEarliestIndex)
      .slice(0, unitsLeftOver)
      .map((share) => share.index),
  );

  return shares.map((share) => (boostedIndexes.has(share.index) ? share.base + 1 : share.base));
}

export function fromMinorUnits(minorUnits: number): number {
  return Number.parseFloat((minorUnits / MINOR_UNITS.perMajorUnit).toFixed(MINOR_UNITS.scale));
}

export function toMinorUnits(majorUnits: number): number {
  const scaled = Number.parseFloat(
    (majorUnits * MINOR_UNITS.perMajorUnit).toFixed(MINOR_UNITS.roundingGuardDigits),
  );
  return MINOR_UNITS.roundHalfAwayFromZero(scaled);
}

function byLargestRemainderThenEarliestIndex(left: WeightShare, right: WeightShare): number {
  if (left.remainder === right.remainder) {
    return left.index - right.index;
  }
  return right.remainder - left.remainder;
}
