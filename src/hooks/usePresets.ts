import { useState, useCallback } from 'react';
import type { CellPreset } from '../types';

const STORAGE_KEY = 'fso_presets';

const BUILTIN_PRESETS: CellPreset[] = [
  {
    id: 'EP9343126VVP',
    name: '\u2605 EP9343126VVP \u2014 FSO 13S2P (LiCoO\u2082)',
    series: 13,
    parallel: 2,
    cell: { capacity_Ah: 6.6, v_max: 4.45, v_nom: 3.90, v_min: 2.75 },
    resistance_mOhm: 24,
    thermalMass_JK: 2700,
    coolingUA_WK: 10,
    builtin: true,
  },
  {
    id: 'P45B_14S2P',
    name: 'Molicel P45B 21700 \u2014 14S2P (NMC)',
    series: 14,
    parallel: 2,
    cell: { capacity_Ah: 4.5, v_max: 4.20, v_nom: 3.60, v_min: 2.50 },
    resistance_mOhm: 115,
    thermalMass_JK: 2050,
    coolingUA_WK: 10,
    builtin: true,
  },
  {
    id: 'P26A_14S4P',
    name: 'Molicel P26A 18650 \u2014 14S4P (NMC)',
    series: 14,
    parallel: 4,
    cell: { capacity_Ah: 2.6, v_max: 4.20, v_nom: 3.60, v_min: 2.50 },
    resistance_mOhm: 80,
    thermalMass_JK: 2900,
    coolingUA_WK: 10,
    builtin: true,
  },
  {
    id: '30Q_14S4P',
    name: 'Samsung 30Q 18650 \u2014 14S4P (NCA)',
    series: 14,
    parallel: 4,
    cell: { capacity_Ah: 3.0, v_max: 4.20, v_nom: 3.60, v_min: 2.50 },
    resistance_mOhm: 80,
    thermalMass_JK: 2650,
    coolingUA_WK: 10,
    builtin: true,
  },
  {
    id: 'LFP_26650',
    name: 'LFP 26650 \u2014 16S1P (LFP)',
    series: 16,
    parallel: 1,
    cell: { capacity_Ah: 3.0, v_max: 3.65, v_nom: 3.20, v_min: 2.50 },
    resistance_mOhm: 25,
    thermalMass_JK: 1400,
    coolingUA_WK: 8,
    builtin: true,
  },
];

function loadUserPresets(): CellPreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUserPresetsToStorage(presets: CellPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function usePresets() {
  const [userPresets, setUserPresets] = useState<CellPreset[]>(loadUserPresets);
  const [selectedId, setSelectedId] = useState<string>('EP9343126VVP');

  const allPresets = [...BUILTIN_PRESETS, ...userPresets];

  const selectedPreset = allPresets.find(p => p.id === selectedId) ?? BUILTIN_PRESETS[0];

  const savePreset = useCallback((preset: Omit<CellPreset, 'builtin'>) => {
    setUserPresets(prev => {
      const filtered = prev.filter(p => p.id !== preset.id);
      const updated = [...filtered, { ...preset, builtin: false }];
      saveUserPresetsToStorage(updated);
      return updated;
    });
    setSelectedId(preset.id);
  }, []);

  const deletePreset = useCallback((id: string) => {
    const preset = BUILTIN_PRESETS.find(p => p.id === id);
    if (preset) return; // Cannot delete built-in presets
    setUserPresets(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveUserPresetsToStorage(updated);
      return updated;
    });
    setSelectedId('EP9343126VVP');
  }, []);

  return {
    allPresets,
    builtinPresets: BUILTIN_PRESETS,
    userPresets,
    selectedId,
    selectedPreset,
    setSelectedId,
    savePreset,
    deletePreset,
  };
}
