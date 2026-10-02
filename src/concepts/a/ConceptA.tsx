import { useRef, useState } from 'react';
import { useLibrary } from '../shared/useLibrary';
import { ColumnsPopover, LibraryDialogs } from '../shared/LibraryDialogs';
import { CategoryDot, HistoryList, PropList, SourceNotes, orderedProps, propOf } from '../shared/parts';
import { CompareMatrix } from '../shared/CompareMatrix';
import { Scatter } from '../shared/scatter';
import { ConceptBadge } from '../shared/ConceptBadge';
import { StressStrainCurve } from '../../components/StressStrainCurve';
import { EtanPage } from '../../components/EtanPage';
import { COLUMN_BY_ID } from '../../lib/columns';
import type { ColId } from '../../lib/columns';
import { CATEGORIES, CATEGORY_LABEL } from '../../types';
import { UPDATED_OPTIONS } from '../../lib/sort';
import type { SortKey } from '../../lib/sort';
import { formatDay, formatValue, unitFor } from '../../lib/format';
import logo from '../../assets/lenovo-logo.png';

type View = 'grid' | 'compare' | 'map' | 'etan';

/** Concept A — Ledger: a spreadsheet-first grid with a formula-style query bar and a bottom inspector dock. */
export function ConceptA() {
  const L = useLibrary();
  const [view, setView] = useState<View>('grid');
  const [dockH, setDockH] = useState(250);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const startDrag = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, h: dockH };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (drag.current) setDockH(Math.min(520, Math.max(140, drag.current.h + (drag.current.y - e.clientY))));
  };

  const header = (id: ColId) => {
    const def = COLUMN_BY_ID[id];
    const prop = propOf(id);
    const dir = L.sort.key === id ? L.sort.dir : null;
    return (
      <th key={id} className={`${def.numeric ? 'num' : ''} ${id === 'name' ? 'frz' : ''}`} onClick={() => L.onSort(id as SortKey)} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
        <span>{def.label}</span>
        {prop && <small>{unitFor(prop, L.units)}</small>}
        <i className="srt">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}</i>
      </th>
    );
  };

  const cell = (id: ColId, m: (typeof L.rows)[number]) => {
    const prop = propOf(id);
    if (prop) {
      const v = m[prop.key];
      return <td key={id} className={`num ${v === null ? 'missing' : ''}`}>{formatValue(prop.key, v, L.units)}</td>;
    }
    if (id === 'name') return <td key={id} className="frz name">{m.name}</td>;
    if (id === 'category') return <td key={id}><CategoryDot c={m.category} size={7} /> {CATEGORY_LABEL[m.category]}</td>;
    if (id === 'source') return <td key={id} className="src" title={m.source}>{m.source || '—'}</td>;
    return <td key={id} className="mono">{formatDay(m.updatedAt)}</td>;
  };

  return (
    <div className="cx cx-a">
      <header className="a-top">
        <img src={logo} alt="Lenovo" />
        <b>CAE 材料資料庫</b>
        <nav>
          {(
            [
              ['grid', '材料列表'],
              ['compare', `材料比較${L.selected.length ? ` (${L.selected.length})` : ''}`],
              ['map', '材料地圖'],
              ['etan', 'ETAN 算法'],
            ] as [View, string][]
          ).map(([v, t]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t}</button>
          ))}
          <button onClick={() => L.setDialog('help')}>使用說明</button>
        </nav>
      </header>

      <div className="a-formula">
        <span className="fx" title="查詢列">fx</span>
        <input ref={searchRef} type="search" value={L.query} onChange={(e) => { L.setQuery(e.target.value); setView('grid'); }} placeholder="搜尋材料名稱、關鍵字或來源..." aria-label="搜尋" />
        <label>類別
          <select value={L.filters.category} onChange={(e) => L.setFilters({ ...L.filters, category: e.target.value as typeof L.filters.category })}>
            <option value="all">全部</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label>來源
          <select value={L.filters.source} onChange={(e) => L.setFilters({ ...L.filters, source: e.target.value })}>
            <option value="all">全部</option>
            {L.sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>更新
          <select value={L.filters.updated} onChange={(e) => L.setFilters({ ...L.filters, updated: e.target.value as typeof L.filters.updated })}>
            {UPDATED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <span className="sp" />
        <div className="popover-anchor">
          <button className="a-btn" onClick={() => L.setColumnsOpen(!L.columnsOpen)} data-col-settings-trigger>欄位設定</button>
          <ColumnsPopover L={L} />
        </div>
        <button className="a-btn" onClick={() => L.setDialog('io')}>匯入 / 匯出</button>
        <button className="a-btn pri" onClick={() => L.setEditing('new')}>＋ 新增材料</button>
      </div>

      <main className="a-main">
        {view === 'grid' && (
          <div className="a-grid-wrap">
            <table className="a-grid">
              <thead>
                <tr>
                  <th className="gut" aria-label="列號" />
                  <th className="chk"><input type="checkbox" checked={false} disabled={!L.selected.length} onChange={L.clearSelection} aria-label="清除選取" /></th>
                  {L.cols.visible.map(header)}
                  <th className="act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {L.rows.map((m, i) => (
                  <tr key={m.id} className={`${L.detailId === m.id ? 'active' : ''} ${L.selected.includes(m.id) ? 'sel' : ''}`} onClick={() => L.setDetailId(m.id)} onDoubleClick={() => L.setEditing(m)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && L.setDetailId(m.id)}>
                    <td className="gut">{i + 1}</td>
                    <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={L.selected.includes(m.id)} onChange={() => L.toggle(m.id)} aria-label={`選取 ${m.name}`} /></td>
                    {L.cols.visible.map((id) => cell(id, m))}
                    <td className="act" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => L.setEditing(m)} aria-label={`編輯 ${m.name}`}>編輯</button>
                      <button className="del" onClick={() => L.setDeleting(m)} aria-label={`刪除 ${m.name}`}>刪除</button>
                    </td>
                  </tr>
                ))}
                {!L.rows.length && <tr><td colSpan={L.cols.visible.length + 3} className="none">沒有符合條件的材料</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && L.detail && (
          <section className="a-dock" style={{ height: dockH }} aria-label="材料檢視">
            <div className="dock-grip" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => (drag.current = null)} title="拖曳調整高度" />
            <div className="dock-head">
              <CategoryDot c={L.detail.category} />
              <b>{L.detail.name}</b>
              <span className="muted">{CATEGORY_LABEL[L.detail.category]}</span>
              <span className="sp" />
              <button className="a-btn" onClick={() => L.setEditing(L.detail!)}>編輯</button>
              <button className="a-btn danger" onClick={() => L.setDeleting(L.detail!)}>刪除</button>
              <button className="a-btn" onClick={() => L.setDetailId(null)} aria-label="關閉檢視">✕</button>
            </div>
            <div className="dock-body">
              <div className="dock-col"><h4>基本性質</h4><PropList m={L.detail} units={L.units} props={orderedProps(L)} /></div>
              <div className="dock-col"><h4>材料曲線</h4><StressStrainCurve m={L.detail} /></div>
              <div className="dock-col"><h4>來源與備註</h4><SourceNotes m={L.detail} /><h4>歷史記錄</h4><HistoryList m={L.detail} /></div>
            </div>
          </section>
        )}

        {view === 'compare' && (
          <div className="a-pane">
            <div className="a-picker">
              <b>比較材料</b>
              {L.materials.map((m) => (
                <label key={m.id} className={L.selected.includes(m.id) ? 'on' : ''}>
                  <input type="checkbox" checked={L.selected.includes(m.id)} onChange={() => L.toggle(m.id)} /> {m.name}
                </label>
              ))}
              {L.selected.length > 0 && <button className="a-btn" onClick={L.clearSelection}>清除選取</button>}
            </div>
            {L.picked.length < 2 ? <div className="cx-empty">請勾選至少 2 個材料，數量不限。</div> : (
              <div className="a-cmp-scroll"><CompareMatrix materials={L.picked} units={L.units} onOpen={(m) => { L.setDetailId(m.id); setView('grid'); }} onRemove={L.toggle} /></div>
            )}
          </div>
        )}

        {view === 'map' && (
          <div className="a-pane">
            <div className="a-maphead">
              <b>材料地圖</b> 輕量化 vs. 剛性（Lightweight vs. Stiffness, ρ – E）
              <button className="info" onClick={() => L.setDialog('mapInfo')} aria-label="如何閱讀這張圖">ⓘ</button>
            </div>
            <div className="a-map"><Scatter materials={L.materials} onPick={(m) => { L.setDetailId(m.id); setView('grid'); }} /></div>
          </div>
        )}

        {view === 'etan' && <div className="a-pane scroll"><EtanPage materials={L.materials} /></div>}
      </main>

      <footer className="a-status">
        <span>顯示 {L.rows.length} / {L.materials.length} 筆</span>
        {L.selected.length > 0 && <span>已選取 <b>{L.selected.length}</b> 筆 <button onClick={() => setView('compare')}>比較</button> <button onClick={L.clearSelection}>清除</button></span>}
        <span className="sp" />
        <span>單位 {L.units.density} · {L.units.stress}</span>
        <span className="hint">單擊列＝檢視　雙擊列＝編輯　拖曳底部面板邊緣調整高度</span>
      </footer>
      <LibraryDialogs L={L} />
      <ConceptBadge id="a" />
    </div>
  );
}
