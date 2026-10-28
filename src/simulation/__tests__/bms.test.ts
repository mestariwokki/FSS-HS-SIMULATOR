import { describe, it, expect } from 'vitest';
import { bmsCheck, defaultBmsLimits, BMS_TIMERS_ZERO, type BmsTimers } from '../bms';

const S = 13;
const LIM = defaultBmsLimits(2);
const V_OK = 3.9 * S;

function run(n: number, V: number, I: number, T: number, dt = 0.1) {
  let timers: BmsTimers = BMS_TIMERS_ZERO;
  for (let k = 1; k <= n; k++) {
    const r = bmsCheck(timers, LIM, V, S, I, T, dt);
    if (r.trip) return { trip: r.trip, t: k * dt };
    timers = r.timers;
  }
  return { trip: null, t: n * dt };
}

describe('defaultBmsLimits — EP9343126VVP 13S2P', () => {
  it('uses datasheet currents × 2P', () => {
    expect(LIM.i_dis_cont).toBe(198);
    expect(LIM.i_dis_peak).toBe(330);
    expect(LIM.i_chg_cont).toBeCloseTo(52.8, 6);
    expect(LIM.i_chg_peak).toBe(106);
  });
  it('never allows more than 60 °C (T11.7.7)', () => {
    expect(defaultBmsLimits(2, 80).t_dis_max_C).toBe(60);
  });
});

describe('bmsCheck', () => {
  it('no trip in normal operation', () => {
    expect(run(1000, V_OK, 100, 30).trip).toBeNull();
  });
  it('198 A continuous is allowed', () => {
    expect(run(600, V_OK, 198, 30).trip).toBeNull();
  });
  it('250 A trips after the 3 s peak time', () => {
    const r = run(100, V_OK, 250, 30);
    expect(r.trip).toMatch(/discharge/);
    expect(r.t).toBeCloseTo(3.1, 5);
  });
  it('above 330 A trips immediately', () => {
    expect(run(1, V_OK, 340, 30).trip).toMatch(/peak/);
  });
  it('regen 106 A is allowed for 3 s, then trips', () => {
    const r = run(100, V_OK, -106, 30);
    expect(r.t).toBeCloseTo(3.1, 5);
  });
  it('undervoltage needs more than 500 ms', () => {
    const r = run(100, 2.7 * S, 10, 30);
    expect(r.trip).toMatch(/undervoltage/);
    expect(r.t).toBeCloseTo(0.6, 5);
  });
  it('overtemperature needs more than 1 s', () => {
    const r = run(100, V_OK, 50, 61);
    expect(r.trip).toMatch(/temperature/);
    expect(r.t).toBeCloseTo(1.1, 5);
  });
  it('charging above 45 °C trips, discharging at 50 °C does not', () => {
    expect(run(100, V_OK, -20, 50).trip).toMatch(/charge/);
    expect(run(100, V_OK, 20, 50).trip).toBeNull();
  });
  it('charging below 0 °C trips', () => {
    expect(run(100, V_OK, -10, -5).trip).toMatch(/temperature/);
  });
});
