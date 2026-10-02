import { useState } from 'react';
import type { Material } from '../types';
import { CATEGORY_LABEL } from '../types';
import { PROPS } from '../lib/props';
import { formatDateLong, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
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

type Tab = 'props' | 'curve' | 'source' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'props', label: '基本性質' },
  { id: 'curve', label: '材料曲線' },
  { id: 'source', label: '來源與備註' },
  { id: 'history', label: '歷史記錄' },
];

const ACTION_LABEL = { created: '建立', edited: '編輯', imported: '匯入' } as const;

export function MaterialDrawer({ material: m, units, onClose, onEdit, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('props');

  return (
    <Modal
      variant="drawer"
      width={540}
      onClose={onClose}
      title={
        <span className="drawer-title">
          {m.name} <span className="cat-tag">{CATEGORY_LABEL[m.category]}</span>
        </span>
      }
      footer={
        <>
          <button className="btn danger-outline" onClick={onDelete}>
            <TrashIcon /> 刪除
          </button>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>關閉</button>
          <button className="btn primary" onClick={onEdit}>
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
          <dl className="prop-grid">
            {PROPS.map((p) => {
              const v = m[p.key];
              return (
                <div key={p.key} className={v === null ? 'missing' : ''}>
                  <dt>
                    {p.label}
                    {p.optional && <small className="muted"> (optional)</small>}
                  </dt>
                  <dd>
                    {formatValue(p.key, v, units)}
                    {v !== null && unitFor(p, units) !== '—' && <small>{unitFor(p, units)}</small>}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {tab === 'curve' && <StressStrainCurve m={m} />}

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
