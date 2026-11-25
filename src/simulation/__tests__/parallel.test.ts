import { describe, expect, it } from 'vitest';
import { solveParallelCurrent } from '../parallel';

describe('parallel group current', () => {
  const cell = { openCircuit_V: 3.8, polarization_V: 0.1, resistance_Ohm: 0.02 };

  it.each([10, -10, 0])('splits %s A equally across identical branches', total_A => {
    const solution = solveParallelCurrent(total_A, [cell, cell]);
    expect(solution.currents_A).toEqual([total_A / 2, total_A / 2]);
    expect(solution.voltage_V).toBeCloseTo(3.7 - total_A * 0.01, 12);
  });

  it('conserves current and enforces the same voltage with unequal resistances and states', () => {
    const branches = [cell, { openCircuit_V: 3.75, polarization_V: 0, resistance_Ohm: 0.04 }];
    const solution = solveParallelCurrent(5, branches);
    const [first, second] = solution.currents_A;
    expect(first + second).toBeCloseTo(5, 12);
    expect(first).toBeCloseTo(2.5, 12);
    for (const [index, branch] of branches.entries()) {
      expect(branch.openCircuit_V - branch.polarization_V - solution.currents_A[index] * branch.resistance_Ohm)
        .toBeCloseTo(solution.voltage_V, 12);
    }
  });

  it('allows circulating current at rest', () => {
    const solution = solveParallelCurrent(0, [cell, { ...cell, polarization_V: 0 }]);
    expect(solution.currents_A[0]).toBeCloseTo(-2.5, 12);
    expect(solution.currents_A[1]).toBeCloseTo(2.5, 12);
    expect(solution.voltage_V).toBeCloseTo(3.75, 12);
  });

  it('rejects a shorted branch in the finite-resistance solver', () => {
    expect(() => solveParallelCurrent(0, [{ ...cell, resistance_Ohm: 0 }])).toThrow(RangeError);
  });
});
