import { useEffect, useRef, useState } from 'react';
import { COLUMN_BY_ID } from '../lib/columns';
import type { ColId, ColumnPrefs } from '../lib/columns';
import type { UnitPrefs } from '../lib/format';
import { CloseIcon } from './icons';

interface Props {
  prefs: ColumnPrefs;
  units: UnitPrefs;
  onUnits: (u: UnitPrefs) => void;
  onMove: (from: ColId, to: ColId) => void;
  onStep: (id: ColId, dir: -1 | 1) => void;
  onToggle: (id: ColId) => void;
  onReset: () => void;
  onClose: () => void;
}

/** 欄位設定 popover: drag (or use the arrow buttons) to reorder, tick to show / hide. */
export function ColumnSettings({ prefs, units, onUnits, onMove, onStep, onToggle, onReset, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<ColId | null>(null);
  const [overId, setOverId] = useState<ColId | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-col-settings-trigger]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const last = prefs.order.length - 1;

  return (
    <div className="col-settings" role="dialog" aria-label="欄位設定" ref={ref}>
      <div className="col-settings-head">
        <b>欄位設定</b>
        <span className="muted small">（拖曳或使用箭頭調整順序）</span>
        <button className="icon-btn" onClick={onClose} aria-label="關閉">
          <CloseIcon size={13} />
        </button>
      </div>

      <ul className="col-list">
        <li className="col-item locked" title="Material Name 固定顯示於最左側">
          <span className="grip off" aria-hidden="true">🔒</span>
          <input type="checkbox" checked disabled aria-label="Material Name 固定顯示" />
          <span className="col-label">{COLUMN_BY_ID.name.label}</span>
          <span className="muted small">固定</span>
        </li>
        {prefs.order.map((id, i) => {
          const hidden = prefs.hidden.includes(id);
          return (
            <li
              key={id}
              className={`col-item ${dragId === id ? 'dragging' : ''} ${overId === id && dragId !== id ? 'over' : ''} ${hidden ? 'is-hidden' : ''}`}
              draggable
              data-col={id}
              onDragStart={(e) => {
                setDragId(id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverId(id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) onMove(dragId, id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
            >
              <span className="grip" aria-hidden="true">☰</span>
              <input type="checkbox" checked={!hidden} onChange={() => onToggle(id)} aria-label={`顯示 ${COLUMN_BY_ID[id].label}`} />
              <span className="col-label">{COLUMN_BY_ID[id].label}</span>
              <span className="col-move">
                <button className="icon-btn" disabled={i === 0} onClick={() => onStep(id, -1)} aria-label={`將 ${COLUMN_BY_ID[id].label} 上移`} title="上移">
                  ▲
                </button>
                <button className="icon-btn" disabled={i === last} onClick={() => onStep(id, 1)} aria-label={`將 ${COLUMN_BY_ID[id].label} 下移`} title="下移">
                  ▼
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="col-settings-units">
        <span className="small muted">單位顯示</span>
        <div className="seg">
          {(['t/mm³', 'kg/m³'] as const).map((d) => (
            <button key={d} className={units.density === d ? 'on' : ''} onClick={() => onUnits({ ...units, density: d })}>
              {d}
            </button>
          ))}
        </div>
        <div className="seg">
          {(['MPa', 'GPa'] as const).map((d) => (
            <button key={d} className={units.stress === d ? 'on' : ''} onClick={() => onUnits({ ...units, stress: d })}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="col-settings-foot">
        <button className="btn" onClick={onReset}>還原預設</button>
        <span className="muted small">設定會儲存在此瀏覽器</span>
      </div>
    </div>
  );
}
