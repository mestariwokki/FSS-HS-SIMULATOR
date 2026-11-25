export interface ParallelBranch {
  openCircuit_V: number;
  polarization_V: number;
  resistance_Ohm: number;
}

/** Solve a common bus voltage with frozen branch states. Positive current discharges. */
export function solveParallelCurrent(total_A: number, branches: readonly ParallelBranch[]) {
  if (!Number.isFinite(total_A) || branches.length === 0) {
    throw new RangeError('A finite total current and at least one branch are required');
  }

  const sources = branches.map(branch => {
    const source_V = branch.openCircuit_V - branch.polarization_V;
    const conductance_S = 1 / branch.resistance_Ohm;
    if (!Number.isFinite(source_V) || !Number.isFinite(conductance_S) || conductance_S <= 0) {
      throw new RangeError('Branch voltage and positive conductance must be finite');
    }
    return { source_V, conductance_S };
  });

  // Subtract a reference before summing to retain small voltage differences.
  const reference_V = sources[0].source_V;
  let conductance_S = 0;
  let weightedOffset_A = 0;
  for (const source of sources) {
    conductance_S += source.conductance_S;
    weightedOffset_A += (source.source_V - reference_V) * source.conductance_S;
  }
  const busOffset_V = (weightedOffset_A - total_A) / conductance_S;
  return {
    voltage_V: reference_V + busOffset_V,
    currents_A: sources.map(source =>
      (source.source_V - reference_V - busOffset_V) * source.conductance_S),
  };
}
