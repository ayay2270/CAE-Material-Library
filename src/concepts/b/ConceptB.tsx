import { useEffect, useRef, useState } from 'react';
import { useLibrary, NO_FILTERS } from '../shared/useLibrary';
import { ColumnsPopover, LibraryDialogs } from '../shared/LibraryDialogs';
import { CategoryDot, CategoryTag, HistoryList, PropList, SourceNotes, orderedProps, propOf } from '../shared/parts';
import { CompareMatrix } from '../shared/CompareMatrix';
import { Scatter } from '../shared/scatter';
import { ConceptBadge } from '../shared/ConceptBadge';
import { StressStrainCurve } from '../../components/StressStrainCurve';
import { EtanPage } from '../../components/EtanPage';
import { CATEGORIES, CATEGORY_LABEL } from '../../types';
import { UPDATED_OPTIONS, matchesUpdated } from '../../lib/sort';
import type { SortKey } from '../../lib/sort';
import { PROPS } from '../../lib/props';
import { formatValue } from '../../lib/format';
import { COLUMN_BY_ID } from '../../lib/columns';
import logo from '../../assets/lenovo-logo.png';

type View = 'library' | 'compare' | 'map' | 'etan';

/** Concept B — Explorer: database-explorer facet tree → compact list → permanent property sheet. */
export function ConceptB() {
  const L = useLibrary();
  const [view, setView] = useState<View>('library');
  const listRef = useRef<HTMLDivElement>(null);

  // Always have something selected in the library view: the right pane is persistent.
  useEffect(() => {
    if (view === 'library' && L.rows.length && !L.rows.some((r) => r.id === L.detailId)) L.setDetailId(L.rows[0].id);
  }, [view, L.rows, L.detailId]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = L.filters;
  const setCat = (c: typeof f.category) => L.setFilters({ ...f, category: f.category === c ? 'all' : c });
  const setSrc = (s: string) => L.setFilters({ ...f, source: f.source === s ? 'all' : s });
  const setUpd = (u: typeof f.updated) => L.setFilters({ ...f, updated: f.updated === u ? 'all' : u });
  const filtersActive = f.category !== 'all' || f.source !== 'all' || f.updated !== 'all';

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = L.rows.findIndex((r) => r.id === L.detailId);
    const n = L.rows[Math.min(L.rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (n) {
      L.setDetailId(n.id);
      listRef.current?.querySelector<HTMLElement>(`[data-id="${n.id}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  };

  const shown = L.cols.prefs.order.filter((id) => !L.cols.prefs.hidden.includes(id)).map(propOf).filter(Boolean).slice(0, 3);

  const Facet = ({ on, onClick, children, n }: { on: boolean; onClick: () => void; children: React.ReactNode; n: number }) => (
    <button className={`b-facet ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span>{children}</span>
      <em>{n}</em>
    </button>
  );

  return (
    <div className={`cx cx-b v-${view}`}>
      <aside className="b-side">
        <div className="b-brand"><img src={logo} alt="Lenovo" /><b>CAE 材料資料庫</b></div>
        <nav className="b-nav">
          <button className={view === 'library' ? 'on' : ''} onClick={() => setView('library')}>▤ 材料庫</button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>◉ 材料地圖</button>
          <button className={view === 'compare' ? 'on' : ''} onClick={() => setView('compare')}>▥ 材料比較{L.selected.length > 0 && <em>{L.selected.length}</em>}</button>
          <button className={view === 'etan' ? 'on' : ''} onClick={() => setView('etan')}>ƒ ETAN 算法</button>
        </nav>

        <div className="b-tree" aria-label="篩選樹">
          <Facet on={!filtersActive} onClick={() => L.setFilters(NO_FILTERS)} n={L.materials.length}><b>全部材料</b></Facet>
          <h5>材料類別</h5>
          {CATEGORIES.map((c) => (
            <Facet key={c} on={f.category === c} onClick={() => setCat(c)} n={L.materials.filter((m) => m.category === c).length}>
              <CategoryDot c={c} /> {CATEGORY_LABEL[c]}
            </Facet>
          ))}
          <h5>來源</h5>
          {L.sources.map((s) => (
            <Facet key={s} on={f.source === s} onClick={() => setSrc(s)} n={L.materials.filter((m) => m.source === s).length}>{s}</Facet>
          ))}
          <h5>更新時間</h5>
          {UPDATED_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
            <Facet key={o.value} on={f.updated === o.value} onClick={() => setUpd(o.value)} n={L.materials.filter((m) => matchesUpdated(m, o.value)).length}>{o.label}</Facet>
          ))}
        </div>

        <div className="b-tray">
          <h5>比較托盤 <em>{L.selected.length}</em></h5>
          {L.picked.length === 0 && <p>在清單中勾選材料，加入比較（數量不限）。</p>}
          <ul>
            {L.picked.map((m) => (
              <li key={m.id}><CategoryDot c={m.category} /> {m.name}<button onClick={() => L.toggle(m.id)} aria-label={`移除 ${m.name}`}>×</button></li>
            ))}
          </ul>
          {L.picked.length > 0 && (
            <div className="b-tray-act">
              <button className="b-btn pri" disabled={L.picked.length < 2} onClick={() => setView('compare')}>比較材料</button>
              <button className="b-btn" onClick={L.clearSelection}>清除選取</button>
            </div>
          )}
        </div>

        <div className="b-tools">
          <div className="popover-anchor">
            <button onClick={() => L.setColumnsOpen(!L.columnsOpen)} data-col-settings-trigger>欄位設定</button>
            <ColumnsPopover L={L} />
          </div>
          <button onClick={() => L.setDialog('io')}>匯入 / 匯出</button>
          <button onClick={() => L.setDialog('help')}>使用說明</button>
        </div>
      </aside>

      {view === 'library' && (
        <>
          <section className="b-list" aria-label="材料清單">
            <div className="b-list-head">
              <input type="search" value={L.query} onChange={(e) => L.setQuery(e.target.value)} placeholder="搜尋材料名稱、關鍵字或來源..." aria-label="搜尋" />
              <div className="b-list-sub">
                <span>{L.rows.length} / {L.materials.length} 筆</span>
                <span className="sp" />
                <select value={L.sort.key} onChange={(e) => L.setSort({ ...L.sort, key: e.target.value as SortKey })} aria-label="排序欄位">
                  {L.cols.visible.map((id) => <option key={id} value={id}>{COLUMN_BY_ID[id].label}</option>)}
                </select>
                <button onClick={() => L.setSort({ ...L.sort, dir: L.sort.dir === 'asc' ? 'desc' : 'asc' })} aria-label="切換排序方向">{L.sort.dir === 'asc' ? '↑' : '↓'}</button>
                <button className="add" onClick={() => L.setEditing('new')}>＋ 新增</button>
              </div>
            </div>
            <div className="b-items" ref={listRef} onKeyDown={onListKey} role="listbox" aria-label="材料" tabIndex={0}>
              {L.rows.map((m) => (
                <div key={m.id} data-id={m.id} role="option" aria-selected={L.detailId === m.id} className={`b-item ${L.detailId === m.id ? 'on' : ''}`} onClick={() => L.setDetailId(m.id)}>
                  <input type="checkbox" checked={L.selected.includes(m.id)} onClick={(e) => e.stopPropagation()} onChange={() => L.toggle(m.id)} aria-label={`加入比較 ${m.name}`} />
                  <div>
                    <div className="b-item-top"><b>{m.name}</b><CategoryTag c={m.category} /></div>
                    <div className="b-item-sub mono">
                      {shown.map((p) => <span key={p!.key} className={m[p!.key] === null ? 'na' : ''}>{p!.symbol} {formatValue(p!.key, m[p!.key], L.units)}</span>)}
                    </div>
                  </div>
                </div>
              ))}
              {!L.rows.length && <div className="cx-empty">沒有符合條件的材料</div>}
            </div>
          </section>

          <section className="b-detail" aria-label="材料詳細資料">
            {L.detail ? (
              <>
                <header className="b-dhead">
                  <div>
                    <h1>{L.detail.name}</h1>
                    <div className="b-dmeta"><CategoryTag c={L.detail.category} /><span>Source：{L.detail.source || '—'}</span><span>Updated：{L.detail.updatedAt.slice(0, 10)}</span></div>
                  </div>
                  <span className="sp" />
                  <button className={`b-btn ${L.selected.includes(L.detail.id) ? 'on' : ''}`} onClick={() => L.toggle(L.detail!.id)}>{L.selected.includes(L.detail.id) ? '✓ 已加入比較' : '＋ 加入比較'}</button>
                  <button className="b-btn" onClick={() => L.setEditing(L.detail!)}>編輯</button>
                  <button className="b-btn danger" onClick={() => L.setDeleting(L.detail!)}>刪除</button>
                </header>
                <div className="b-dbody">
                  <div className="b-card"><h4>基本性質</h4><PropList m={L.detail} units={L.units} props={orderedProps(L)} /></div>
                  <div className="b-card"><h4>材料曲線</h4><StressStrainCurve m={L.detail} /></div>
                  <div className="b-card"><h4>來源與備註</h4><SourceNotes m={L.detail} /></div>
                  <div className="b-card"><h4>歷史記錄</h4><HistoryList m={L.detail} /></div>
                  <div className="b-card b-solver">
                    <h4>Solver 材料卡 <em>概念示意・尚未實作</em></h4>
                    <p>未來可在此依 Material Model 產生各 Solver 的材料卡。目前資料庫沒有 MAT ID / Material Model 欄位，因此不顯示任何數值。</p>
                    <div>{['LS-DYNA', 'Abaqus', 'Radioss', 'OptiStruct'].map((s) => <button key={s} className="b-btn" disabled title="尚未實作">{s}</button>)}</div>
                  </div>
                </div>
              </>
            ) : <div className="cx-empty">請從左側清單選擇材料</div>}
          </section>
        </>
      )}

      {view === 'compare' && (
        <section className="b-wide">
          <header className="b-whead"><h1>材料比較</h1><span className="muted">{L.picked.length >= 2 ? `已選擇 ${L.picked.length} 個材料進行比較，可同時比較更多材料。` : '請在清單勾選至少 2 個材料。'}</span></header>
          {L.picked.length >= 2 ? <div className="b-cmp"><CompareMatrix materials={L.picked} units={L.units} onOpen={(m) => { L.setDetailId(m.id); setView('library'); }} onRemove={L.toggle} /></div> : <div className="cx-empty">請先加入材料到「比較托盤」。</div>}
        </section>
      )}

      {view === 'map' && (
        <section className="b-wide">
          <header className="b-whead"><h1>材料地圖</h1><span>輕量化 vs. 剛性（Lightweight vs. Stiffness, ρ – E）</span><button className="b-info" onClick={() => L.setDialog('mapInfo')} aria-label="如何閱讀這張圖">ⓘ</button></header>
          <div className="b-map"><Scatter materials={L.rows} onPick={(m) => { L.setDetailId(m.id); setView('library'); }} /></div>
        </section>
      )}

      {view === 'etan' && <section className="b-wide scroll"><EtanPage materials={L.materials} /></section>}

      <LibraryDialogs L={L} />
      <ConceptBadge id="b" />
      <span hidden>{PROPS.length}</span>
    </div>
  );
}
