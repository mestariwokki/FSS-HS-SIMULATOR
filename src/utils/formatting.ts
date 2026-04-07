export function formatValue(val: number, decimals: number = 2): string {
  return val.toFixed(decimals);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}

export function formatPower(watts: number): { value: string; unit: string } {
  if (Math.abs(watts) >= 1000) {
    return { value: (watts / 1000).toFixed(2), unit: 'kW' };
  }
  return { value: watts.toFixed(0), unit: 'W' };
}
