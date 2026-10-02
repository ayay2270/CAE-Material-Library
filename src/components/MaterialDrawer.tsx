import type { Material } from '../types';
import { PROPS, filledCount } from '../lib/props';
import { formatDateLong, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import { CompletenessBar } from './CompletenessBar';
import { Modal } from './Modal';
import { StressStrainCurve } from './StressStrainCurve';
import { EditIcon, TrashIcon } from './icons';

interface Props {
  material: Material;
  units: UnitPrefs;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PropGrid({ m, units, group }: { m: Material; units: UnitPrefs; group: 'basic' | 'supplemental' }) {
  return (
    <dl className="prop-grid">
      {PROPS.filter((p) => p.group === group).map((p) => {
        const v = m[p.key];
        return (
          <div key={p.key} className={v === null ? 'missing' : ''}>
            <dt>
              <span className="sym">{p.symbol}</span> {p.label}
            </dt>
            <dd>
              {formatValue(p.key, v, units)}
              {v !== null && unitFor(p, units) !== '—' && <small>{unitFor(p, units)}</small>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function MaterialDrawer({ material: m, units, onClose, onEdit, onDelete }: Props) {
  return (
    <Modal
      variant="drawer"
      width={560}
      onClose={onClose}
      title={
        <span className="drawer-title">
          {m.name} <span className="cat-tag">{m.category}</span>
        </span>
      }
      footer={
        <>
          <button className="btn danger-outline" onClick={onDelete}>
            <TrashIcon /> Delete
          </button>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onEdit}>
            <EditIcon /> Edit
          </button>
        </>
      }
    >
      <section>
        <h3>Basic Properties</h3>
        <PropGrid m={m} units={units} group="basic" />
      </section>
      <section>
        <h3>Supplemental Properties</h3>
        <PropGrid m={m} units={units} group="supplemental" />
      </section>
      <section>
        <h3>Material Curve</h3>
        <StressStrainCurve m={m} />
      </section>
      <section>
        <h3>Source &amp; Notes</h3>
        <dl className="meta-grid">
          <dt>Source</dt>
          <dd>{m.source || <span className="muted">—</span>}</dd>
          <dt>Completeness</dt>
          <dd>
            <CompletenessBar filled={filledCount(m)} />
          </dd>
          <dt>Last updated</dt>
          <dd>{formatDateLong(m.updatedAt)}</dd>
          <dt>Notes</dt>
          <dd className="notes">{m.notes || <span className="muted">No notes.</span>}</dd>
        </dl>
      </section>
      <section>
        <h3>History</h3>
        <ol className="history">
          {m.history.map((h, i) => (
            <li key={i}>
              <time>{formatDateLong(h.at)}</time>
              <span className={`h-action ${h.action}`}>{h.action}</span>
              <span className="h-sum">{h.summary}</span>
            </li>
          ))}
        </ol>
      </section>
    </Modal>
  );
}
