import { useState } from 'react';
import type { Material, StressStrainData } from '../types';
import { useIndexes } from '../lib/indexes';
import { PROPS } from '../lib/props';
import { isOrthotropic } from '../lib/materialProperties';
import { OrthotropicProperties } from './OrthotropicProperties';
import { formatDateLong, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import { Modal } from './Modal';
import { StressStrainSection } from './StressStrainSection';
import { EtanPanel } from './EtanPanel';
import { EditIcon, TrashIcon } from './icons';
import { LOCAL_EDITING_HINT } from '../lib/localEditing';

interface Props {
  editable: boolean;
  /** Edit and delete. Defaults to `editable` so legacy callers stay unchanged. */
  materialCrudEnabled?: boolean;
  /** Curve editor. Defaults to `editable` so legacy callers stay unchanged. */
  curveEditable?: boolean;
  /** Shared Supabase write already in flight. */
  curvePending?: boolean;
  material: Material;
  units: UnitPrefs;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveCurve: (data: StressStrainData) => string | null | Promise<string | null>;
  readOnlyTitle?: string;
}

type Tab = 'props' | 'curve' | 'source' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'props', label: '基本性質' },
  { id: 'curve', label: '材料曲線' },
  { id: 'source', label: '來源與備註' },
  { id: 'history', label: '歷史記錄' },
];

const ACTION_LABEL = { created: '建立', edited: '編輯', imported: '匯入' } as const;

export function MaterialDrawer({ material: m, units, onClose, onEdit, onDelete, onSaveCurve, editable, materialCrudEnabled = editable, curveEditable = editable, curvePending = false, readOnlyTitle = LOCAL_EDITING_HINT }: Props) {
  const indexes = useIndexes();
  const [tab, setTab] = useState<Tab>('props');

  return (
    <Modal
      variant="drawer"
      width={540}
      onClose={onClose}
      title={
        <span className="drawer-title">
          {m.name} <span className="cat-tag">{indexes.label(m.category)}</span>
        </span>
      }
      footer={
        <>
          <button className="btn danger-outline" onClick={onDelete} title={materialCrudEnabled ? '刪除' : readOnlyTitle}>
            <TrashIcon /> 刪除
          </button>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>關閉</button>
          <button className="btn primary" onClick={onEdit} title={materialCrudEnabled ? '編輯' : readOnlyTitle}>
            <EditIcon /> 編輯
          </button>
        </>
      }
    >
      <div className="tabs" role="tablist" aria-label="材料詳細資料">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'props' && (
          <>
          {m.category === 'Composite' && <p className="muted">{m.subCategory ? `${m.subCategory} · ` : ''}{isOrthotropic(m) ? 'Orthotropic' : 'Isotropic Equivalent'}</p>}
          {/* H is calculated in the Solver Plasticity section, so the stored H field is not listed here. */}
          <dl className="prop-grid prop-grid-open">
            {PROPS.filter(p => p.key !== 'etan' && (!isOrthotropic(m) || p.key === 'density')).map((p) => {
              const v = m[p.key];
              return (
                <div key={p.key} className={v === null ? 'missing' : ''}>
                  <dt>{p.label}</dt>
                  <dd>
                    {formatValue(p.key, v, units)}
                    {v !== null && unitFor(p, units) !== '—' && <small>{unitFor(p, units)}</small>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {isOrthotropic(m) ? <OrthotropicProperties material={m} units={units} /> : <EtanPanel key={m.id} material={m} />}
          </>
        )}

        {tab === 'curve' && <StressStrainSection key={m.id} material={m} units={units} onSave={onSaveCurve} editable={curveEditable} pending={curvePending} />}

        {tab === 'source' && (
          <dl className="meta-grid">
            <dt>Source</dt>
            <dd>{m.source || <span className="muted">—</span>}</dd>
            <dt>Updated</dt>
            <dd>{formatDateLong(m.updatedAt)}</dd>
            <dt>備註</dt>
            <dd className="notes">{m.notes || <span className="muted">無備註</span>}</dd>
          </dl>
        )}

        {tab === 'history' && (
          <ol className="history">
            {m.history.map((h, i) => (
              <li key={i}>
                <time>{formatDateLong(h.at)}</time>
                <span className={`h-action ${h.action}`}>{ACTION_LABEL[h.action]}</span>
                <span className="h-sum">{h.summary}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
