import type { Material } from '../../types';
import { CATEGORY_LABEL } from '../../types';
import { PROPS } from '../../lib/props';
import type { PropDef } from '../../lib/props';
import { formatDateLong, formatValue, unitFor } from '../../lib/format';
import type { UnitPrefs } from '../../lib/format';
import { CATEGORY_COLOR } from '../../components/MaterialMap';

interface Props {
  materials: Material[];
  units: UnitPrefs;
  /** Draw a magnitude bar behind each numeric cell (relative to the largest value in that row). */
  bars?: boolean;
  /** Mark the row minimum / maximum (informational only — no scoring). */
  extremes?: boolean;
  onOpen?: (m: Material) => void;
  onRemove?: (id: string) => void;
  hoverId?: string | null;
  onHover?: (id: string | null) => void;
  /** Property rows (defaults to all, in table order) — lets a concept follow the 欄位設定 order. */
  props?: PropDef[];
}

/** Side-by-side matrix: rows = properties, columns = materials. No ranking, no scoring. */
export function CompareMatrix({ materials, units, bars, extremes, onOpen, onRemove, hoverId, onHover, props = PROPS }: Props) {
  return (
    <table className="cmp" data-testid="compare-table" style={{ minWidth: 190 + materials.length * 128 }}>
      <thead>
        <tr>
          <th className="cmp-prop">Property</th>
          {materials.map((m) => (
            <th key={m.id} className={hoverId === m.id ? 'hov' : ''} onMouseEnter={() => onHover?.(m.id)} onMouseLeave={() => onHover?.(null)}>
              <span className="cmp-h">
                <i className="cat-dot" style={{ background: CATEGORY_COLOR[m.category] }} />
                <button className="link-btn" onClick={() => onOpen?.(m)}>{m.name}</button>
                {onRemove && <button className="icon-btn" onClick={() => onRemove(m.id)} aria-label={`移除 ${m.name}`}>×</button>}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="cmp-prop">Category</td>
          {materials.map((m) => (
            <td key={m.id} className="txt">{CATEGORY_LABEL[m.category]}</td>
          ))}
        </tr>
        {props.map((p) => {
          const nums = materials.map((m) => m[p.key]).filter((v): v is number => v !== null);
          const max = nums.length ? Math.max(...nums) : 0;
          const min = nums.length ? Math.min(...nums) : 0;
          const u = unitFor(p, units);
          return (
            <tr key={p.key}>
              <td className="cmp-prop">
                {p.label}
                <small> {u !== '—' ? `(${u})` : ''}</small>
              </td>
              {materials.map((m) => {
                const v = m[p.key];
                const pct = v !== null && max > 0 ? Math.max(3, (v / max) * 100) : 0;
                const tag = extremes && nums.length > 1 && v !== null ? (v === max && max !== min ? 'max' : v === min && max !== min ? 'min' : '') : '';
                return (
                  <td key={m.id} className={`num ${v === null ? 'missing' : ''} ${tag} ${hoverId === m.id ? 'hov' : ''}`}>
                    {bars && v !== null && <span className="bar" style={{ width: `${pct}%` }} />}
                    <span className="val">{formatValue(p.key, v, units)}</span>
                    {tag === 'max' && <span className="ext" title="本列最大值">▲</span>}
                    {tag === 'min' && <span className="ext" title="本列最小值">▼</span>}
                  </td>
                );
              })}
            </tr>
          );
        })}
        <tr>
          <td className="cmp-prop">Source</td>
          {materials.map((m) => (
            <td key={m.id} className="txt">{m.source || '—'}</td>
          ))}
        </tr>
        <tr>
          <td className="cmp-prop">Updated</td>
          {materials.map((m) => (
            <td key={m.id} className="txt">{formatDateLong(m.updatedAt).slice(0, 10)}</td>
          ))}
        </tr>
        <tr>
          <td className="cmp-prop">備註</td>
          {materials.map((m) => (
            <td key={m.id} className="txt notes">{m.notes || '—'}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
