import { readFileSync } from 'node:fs';
import { solveParallelCurrent } from '../src/simulation/parallel.ts';

const trace = JSON.parse(readFileSync(0, 'utf8')).map(([step, time, current, ...cells]) => ({
  step, time, total_A: -current, measured_A: cells.map(value => -value),
}));
const calibration = trace.filter(row => row.step === 2 && row.time >= 300 && row.time < 600);
const heldOut = trace.filter(row => row.step === 7 && row.time >= 300);
const discharge = trace.filter(row => row.step === 5 && row.time >= 300);
if (!calibration.length || !heldOut.length || !discharge.length) throw new Error('Missing test stages');

const units = [
  { label: '4P', group: currents => currents },
  { label: 'kaksi 2P-osasummaa', group: ([one, two, three, four]) => [one + two, three + four] },
];

for (const { label, group } of units) {
  const summed = group(calibration[0].measured_A).map((_, index) =>
    calibration.reduce((sum, row) => sum + group(row.measured_A)[index], 0));
  const total = summed.reduce((sum, value) => sum + value, 0);
  const shares = summed.map(value => value / total);
  const branches = shares.map(share => ({
    openCircuit_V: 3.8, polarization_V: 0, resistance_Ohm: 0.01 / share,
  }));
  console.log(label, 'sovitetut jako-osuudet', shares);
  for (const [phase, rows] of [['CC-lataus', heldOut], ['CC-purku', discharge]]) {
    let equalSquared = 0;
    let modelSquared = 0;
    let mismatchSquared = 0;
    for (const row of rows) {
      const measured = group(row.measured_A);
      const { currents_A } = solveParallelCurrent(row.total_A, branches);
      measured.forEach((value, index) => {
        equalSquared += (row.total_A / branches.length - value) ** 2;
        modelSquared += (currents_A[index] - value) ** 2;
      });
      mismatchSquared += (row.total_A - measured.reduce((sum, value) => sum + value, 0)) ** 2;
    }
    const rmse = squared => Math.sqrt(squared / (rows.length * branches.length)).toFixed(4);
    console.log(phase, rows.length, 'näytettä; tasa / malli RMSE (A):', rmse(equalSquared),
      rmse(modelSquared), 'virtasumman RMSE (A):', Math.sqrt(mismatchSquared / rows.length).toFixed(4));
  }
}
