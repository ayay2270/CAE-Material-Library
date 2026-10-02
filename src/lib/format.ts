import type { PropKey } from '../types';
import type { PropDef } from './props';

export interface UnitPrefs {
  density: 't/mm³' | 'kg/m³';
  stress: 'MPa' | 'GPa';
}
export const DEFAULT_UNITS: UnitPrefs = { density: 't/mm³', stress: 'MPa' };

const STRESS_KEYS: PropKey[] = ['youngsModulus', 'yieldStress', 'etan', 'ultimateStress'];

export function unitFor(p: PropDef, u: UnitPrefs): string {
  if (p.key === 'density') return u.density;
  if (STRESS_KEYS.includes(p.key)) return u.stress;
  return p.unit;
}

/** Converts a stored (t/mm³, MPa) value to the display unit. */
export function toDisplay(key: PropKey, v: number, u: UnitPrefs): number {
  if (key === 'density' && u.density === 'kg/m³') return v * 1e12;
  if (STRESS_KEYS.includes(key) && u.stress === 'GPa') return v / 1000;
  return v;
}

function sci(v: number): string {
  // 2.82e-9 -> "2.82E-9"
  return v.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'E').replace('e', 'E');
}

export function formatValue(key: PropKey, v: number | null, u: UnitPrefs = DEFAULT_UNITS): string {
  if (v === null) return '—';
  const d = toDisplay(key, v, u);
  if (key === 'density' && u.density === 't/mm³') return sci(d);
  const digits = STRESS_KEYS.includes(key) && u.stress === 'GPa' ? 3 : 2;
  return d.toLocaleString('en-US', { maximumFractionDigits: digits });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "9/17 15:17" (year added only when it is not the current year). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const base = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${d.getFullYear()}/${base}`;
}

/** "2026-09-17" */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
