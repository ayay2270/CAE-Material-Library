import type { Material } from '../types';
import { PROPS, filledCount, PROP_COUNT } from '../lib/props';
import { formatDateLong, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import { ArrowLeftIcon } from './icons';

interface Props {
  materials: Material[];
  selected: string[];
  units: UnitPrefs;
  onToggle: (id: string) => boolean;
  onBack: () => void;
  onOpen: (m: Material) => void;
}

export function ComparePage({ materials, selected, units, onToggle, onBack, onOpen }: Props) {
  const picked = selected.map((id) => materials.find((m) => m.id === id)).filter((m): m is Material => !!m);

  return (
    <main className="page compare-page">
      <div className="page-head">
        <button className="back-link" onClick={onBack}>
          <ArrowLeftIcon /> Back to materials
        </button>
        <h1>Compare Materials</h1>
        <span className="page-sub">Side-by-side view of the stored properties — no scoring or ranking.</span>
      </div>

      <div className="compare-picker" role="group" aria-label="Choose materials to compare">
        <span className="picker-label">Selected ({picked.length}/3):</span>
        {materials.map((m) => (
          <label key={m.id} className={`pick ${selected.includes(m.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={selected.includes(m.id)} onChange={() => onToggle(m.id)} />
            {m.name}
          </label>
        ))}
      </div>

      {picked.length < 2 ? (
        <div className="empty-state">Choose 2–3 materials above (or tick rows in the main table) to compare them.</div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="mat-table compare-table">
              <thead>
                <tr>
                  <th className="prop-col">Property</th>
                  {picked.map((m) => (
                    <th key={m.id} className="num">
                      <button className="link-btn" onClick={() => onOpen(m)} title="Open details">
                        {m.name}
                      </button>
                      <span className="th-sub">{m.category}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROPS.map((p) => {
                  const nums = picked.map((m) => m[p.key]).filter((v): v is number => v !== null);
                  const differs = new Set(nums).size > 1;
                  return (
                    <tr key={p.key}>
                      <td className="prop-col">
                        <span className="sym">{p.symbol}</span> {p.label} {unitFor(p, units) !== '—' && <small className="muted">{unitFor(p, units)}</small>}
                      </td>
                      {picked.map((m) => {
                        const v = m[p.key];
                        return (
                          <td key={m.id} className={`num ${v === null ? 'missing' : ''} ${differs && v !== null ? 'differs' : ''}`}>
                            {formatValue(p.key, v, units)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr>
                  <td className="prop-col">Completeness</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num">{filledCount(m)}/{PROP_COUNT}</td>
                  ))}
                </tr>
                <tr>
                  <td className="prop-col">Source</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num">{m.source || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="prop-col">Last updated</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num">{formatDateLong(m.updatedAt)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="prop-col">Notes</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num notes-cell">{m.notes || '—'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>Values that differ between the selected materials are shown in bold. “—” means the value is not recorded.</span>
          </div>
        </div>
      )}
    </main>
  );
}
