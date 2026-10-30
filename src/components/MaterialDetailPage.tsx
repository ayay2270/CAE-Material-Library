import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Material, StressStrainData } from '../types';
import { useIndexes } from '../lib/indexes';
import { ORTHOTROPIC_GROUPS, PROPS, type PropDef } from '../lib/props';
import { displayedModel, isOrthotropic, materialValue } from '../lib/materialProperties';
import { formatDateLong, formatDay, formatValue, unitFor, type UnitPrefs } from '../lib/format';
import { isStressStrainData } from '../lib/curveData';
import { StressStrainSection } from './StressStrainSection';
import { EtanPanel } from './EtanPanel';
import { HyperMeshNu31 } from './HyperMeshNu31';
import { EditIcon } from './icons';
import { LOCAL_EDITING_HINT } from '../lib/localEditing';
import type { MaterialPropertyKey } from '../types';
import laminateAxes from '../assets/orthotropic-laminate-axes.png';
import './MaterialDetailPage.css';

interface Props {
  editable: boolean;
  materialCrudEnabled?: boolean;
  curveEditable?: boolean;
  curvePending?: boolean;
  material: Material;
  units: UnitPrefs;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaveCurve: (data: StressStrainData) => string | null | Promise<string | null>;
  onDeleteCurve?: () => string | null | Promise<string | null>;
  readOnlyTitle?: string;
  initialTab?: Tab;
}

type Tab = 'props' | 'curve' | 'source' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'props', label: '基本性質' },
  { id: 'curve', label: '材料曲線' },
  { id: 'source', label: '來源與備註' },
  { id: 'history', label: '歷史記錄' },
];
const ISO_KEYS = ['density', 'youngsModulus', 'poissonRatio', 'yieldStress', 'ultimateStress', 'elongation'] as const;
const GROUP_TITLE: Record<string, string> = {
  "Young's Modulus": "Young's Modulus (MPa)",
  'Shear Modulus': 'Shear Modulus (MPa)',
  "Poisson's Ratio": "Poisson's Ratio",
};
const HISTORY_TITLE = { created: '建立材料', edited: '更新材料資料', imported: '匯入材料' } as const;

function detailNumber(key: MaterialPropertyKey, value: number | null, units: UnitPrefs) {
  if (value === null) return '—';
  if (key === 'nu12' || key === 'nu13' || key === 'nu23') return value.toFixed(2);
  return formatValue(key, value, units);
}

function PropertyCard({ prop, material, units, featured = false }: { prop: PropDef<MaterialPropertyKey>; material: Material; units: UnitPrefs; featured?: boolean }) {
  const value = materialValue(material, prop.key);
  const unit = value !== null ? unitFor(prop, units) : '';
  return (
    <article className={`detail-prop${featured ? ' featured' : ''}${value === null ? ' missing' : ''}`}>
      <span>{prop.label}</span>
      <strong>{detailNumber(prop.key, value, units)}</strong>
      {unit && unit !== '—' ? <small>{unit}</small> : <small className="unit-spacer" aria-hidden="true" />}
    </article>
  );
}

function DirectionSchematic() {
  return (
    <section className="detail-axes" aria-label="材料方向">
      <header className="detail-axes-head">
        <strong>材料方向</strong>
        <span>材料主方向</span>
      </header>
      <img src={laminateAxes} alt="1 (In-plane), 2 (In-plane), 3 (Through-thickness)" />
      <p className="detail-axes-foot">1 / 2：板內方向 · 3：板厚方向</p>
    </section>
  );
}

export function MaterialDetailPage({
  material: m,
  units,
  onClose,
  onEdit,
  onDelete,
  onSaveCurve,
  onDeleteCurve,
  editable,
  materialCrudEnabled = editable,
  curveEditable = editable,
  curvePending = false,
  readOnlyTitle = LOCAL_EDITING_HINT,
  initialTab = 'props',
}: Props) {
  const indexes = useIndexes();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const model = displayedModel(m);
  const orthotropic = isOrthotropic(m);
  const curve = isStressStrainData(m.stressStrainCurve) ? m.stressStrainCurve : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <main className="page material-detail" data-testid="material-detail">
      <button type="button" className="detail-back" onClick={onClose}>← 返回材料庫</button>
      <header className="detail-head">
        <div className="detail-identity">
          <div className="detail-title-row">
            <h1 className="detail-name">{m.name}</h1>
            <span className={`model-badge is-${model.toLowerCase()}`}>{model}</span>
            <span className="cat-tag" style={{ '--cat': indexes.color(m.category) } as CSSProperties}>{indexes.label(m.category)}</span>
          </div>
          {m.subCategory && <p className="detail-sub">{m.subCategory}</p>}
        </div>
        <div className="detail-tools">
          <div className="detail-meta">
            <span>來源</span>
            <strong>{m.source || '—'}</strong>
          </div>
          <div className="detail-meta">
            <span>更新時間</span>
            <strong>{formatDay(m.updatedAt)}</strong>
          </div>
          <button type="button" className="btn primary" onClick={onEdit} title={materialCrudEnabled ? '編輯' : readOnlyTitle}>
            <EditIcon /> 編輯
          </button>
          <div className="detail-overflow" ref={menuRef}>
            <button type="button" className="btn detail-more" aria-label="更多動作" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋯</button>
            {menuOpen && (
              <div className="detail-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(); }} title={materialCrudEnabled ? '刪除材料' : readOnlyTitle}>刪除材料</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="detail-tabs" role="tablist" aria-label="材料詳細資料">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="detail-body" role="tabpanel">
        {tab === 'props' && (orthotropic ? (
          <>
            <section className="detail-section" aria-label="基本資訊">
              <h2>基本資訊</h2>
              <div className="detail-basic">
                <PropertyCard prop={PROPS.find((item) => item.key === 'density')!} material={m} units={units} featured />
                <DirectionSchematic />
              </div>
            </section>
            <div className="detail-ortho-groups">
              {ORTHOTROPIC_GROUPS.map((group) => (
                <section className="detail-group" key={group.label} aria-label={GROUP_TITLE[group.label] ?? group.label}>
                  <h3>{GROUP_TITLE[group.label] ?? group.label}</h3>
                  <div className="detail-group-values">
                    {group.props.map((prop) => <PropertyCard key={prop.key} prop={prop} material={m} units={units} />)}
                  </div>
                  {group.label === "Poisson's Ratio" && <HyperMeshNu31 key={m.id} material={m} />}
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <section className="detail-section" aria-label="基本材料性質">
              <h2>基本材料性質</h2>
              <div className="detail-iso-grid">
                {ISO_KEYS.map((key) => {
                  const prop = PROPS.find((item) => item.key === key)!;
                  return <PropertyCard key={key} prop={prop} material={m} units={units} />;
                })}
              </div>
            </section>
            <EtanPanel key={m.id} material={m} />
          </>
        ))}

        {tab === 'curve' && (
          <div className={`detail-curve${curve ? ' has-points' : ''}`}>
            <StressStrainSection key={m.id} material={m} units={units} onSave={onSaveCurve} onDelete={onDeleteCurve} editable={curveEditable} pending={curvePending} />
            {curve && (
              <div className="detail-point-table">
                <table>
                  <thead>
                    <tr><th>應變 (mm/mm)</th><th>應力 ({units.stress})</th></tr>
                  </thead>
                  <tbody>
                    {curve.points.map((point, index) => (
                      <tr key={`${point.strain}-${point.stress}-${index}`}>
                        <td>{point.strain}</td>
                        <td>{formatValue('youngsModulus', point.stress, units)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'source' && (
          <dl className="detail-source">
            <div><dt>來源</dt><dd>{m.source || <span className="muted">—</span>}</dd></div>
            <div><dt>更新時間</dt><dd>{formatDay(m.updatedAt)}</dd></div>
            <div><dt>備註</dt><dd className="notes">{m.notes || <span className="muted">無備註</span>}</dd></div>
          </dl>
        )}

        {tab === 'history' && (
          <ol className="detail-timeline">
            {m.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <time>{formatDateLong(entry.at)}</time>
                <strong>{HISTORY_TITLE[entry.action]}</strong>
                {entry.summary && <p>{entry.summary}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
