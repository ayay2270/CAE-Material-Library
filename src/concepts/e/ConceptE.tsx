import { useRef, useState } from 'react';
import { useLibrary } from '../shared/useLibrary';
import { ColumnsPopover, LibraryDialogs } from '../shared/LibraryDialogs';
import { CategoryDot, HistoryList, PropList, SourceNotes, orderedProps, propOf } from '../shared/parts';
import { CompareMatrix } from '../shared/CompareMatrix';
import { Scatter } from '../shared/scatter';
import { ConceptBadge } from '../shared/ConceptBadge';
import { StressStrainCurve } from '../../components/StressStrainCurve';
import { EtanPage } from '../../components/EtanPage';
import { CATEGORIES, CATEGORY_LABEL } from '../../types';
import type { Material } from '../../types';
import { UPDATED_OPTIONS } from '../../lib/sort';
import type { SortKey } from '../../lib/sort';
import { COLUMN_BY_ID } from '../../lib/columns';
import type { ColId } from '../../lib/columns';
import { formatDay, formatValue, unitFor } from '../../lib/format';
import logo from '../../assets/lenovo-logo.png';

/** Concept E — Atlas: map-first split pane. Map ⇄ table are linked; category tiles are the filters; right inspector. */
export function ConceptE() {
  const L = useLibrary();
  const [hover, setHover] = useState<string | null>(null);
  const [mapH, setMapH] = useState(360);
  const [pane, setPane] = useState<'list' | 'compare'>('list');
  const [etan, setEtan] = useState(false);
  const [insp, setInsp] = useState(true);
  const split = useRef<{ y: number; h: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<HTMLDivElement>(null);

  const startSplit = (e: React.PointerEvent) => { split.current = { y: e.clientY, h: mapH }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const moveSplit = (e: React.PointerEvent) => {
    if (!split.current) return;
    const max = (wsRef.current?.clientHeight ?? 800) - 150;
    setMapH(Math.min(max, Math.max(170, split.current.h + (e.clientY - split.current.y))));
  };

  const f = L.filters;
  const sel = new Set(L.selected);
  const focusId = hover ?? L.detailId;

  const pickFromMap = (m: Material) => {
    L.setDetailId(m.id);
    setInsp(true);
    setPane('list');
    requestAnimationFrame(() => bodyRef.current?.querySelector(`[data-id="${m.id}"]`)?.scrollIntoView({ block: 'nearest' }));
  };

  const cell = (id: ColId, m: Material) => {
    const p = propOf(id);
    if (p) { const v = m[p.key]; return <td key={id} className={`num ${v === null ? 'missing' : ''}`}>{formatValue(p.key, v, L.units)}</td>; }
    if (id === 'name') return <td key={id} className="nm"><CategoryDot c={m.category} /> {m.name}</td>;
    if (id === 'category') return <td key={id}>{CATEGORY_LABEL[m.category]}</td>;
    if (id === 'source') return <td key={id} className="src">{m.source || '—'}</td>;
    return <td key={id} className="mono">{formatDay(m.updatedAt)}</td>;
  };

  return (
    <div className="cx cx-e">
      <header className="e-top">
        <img src={logo} alt="Lenovo" /><b>CAE 材料資料庫</b>
        <div className="e-search"><input type="search" value={L.query} onChange={(e) => L.setQuery(e.target.value)} placeholder="搜尋材料名稱、關鍵字或來源..." aria-label="搜尋" /></div>
        <span className="sp" />
        <button onClick={() => setEtan(true)}>ETAN 算法</button>
        <div className="popover-anchor"><button onClick={() => L.setColumnsOpen(!L.columnsOpen)} data-col-settings-trigger>欄位設定</button><ColumnsPopover L={L} /></div>
        <button onClick={() => L.setDialog('io')}>匯入 / 匯出</button>
        <button onClick={() => L.setDialog('help')}>使用說明</button>
        <button className="pri" onClick={() => L.setEditing('new')}>＋ 新增材料</button>
      </header>

      <div className="e-kpis" role="group" aria-label="材料類別">
        <button className={`tile ${f.category === 'all' ? 'on' : ''}`} onClick={() => L.setFilters({ ...f, category: 'all' })}><span>全部材料</span><b>{L.materials.length}</b></button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`tile ${f.category === c ? 'on' : ''}`} aria-pressed={f.category === c} onClick={() => L.setFilters({ ...f, category: f.category === c ? 'all' : c })}>
            <span><CategoryDot c={c} /> {CATEGORY_LABEL[c]}</span><b>{L.materials.filter((m) => m.category === c).length}</b>
          </button>
        ))}
        <span className="sp" />
        <label>來源
          <select value={f.source} onChange={(e) => L.setFilters({ ...f, source: e.target.value })}>
            <option value="all">全部</option>{L.sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>更新時間
          <select value={f.updated} onChange={(e) => L.setFilters({ ...f, updated: e.target.value as typeof f.updated })}>
            {UPDATED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="e-work">
        <div className="e-ws" ref={wsRef}>
          <section className="e-map" style={{ height: mapH }} aria-label="材料地圖">
            <div className="e-map-head">
              <b>材料地圖</b><span>輕量化 vs. 剛性（Lightweight vs. Stiffness, ρ – E）</span>
              <button className="info" onClick={() => L.setDialog('mapInfo')} aria-label="如何閱讀這張圖">ⓘ</button>
              <span className="sp" />
              <span className="muted">懸停＝連動高亮　點選＝檢視並定位到表格</span>
            </div>
            <div className="e-map-plot">
              <Scatter materials={L.rows} ringed={sel} highlight={focusId} onHover={setHover} onPick={pickFromMap} />
            </div>
          </section>
          <div className="e-split" role="separator" aria-orientation="horizontal" aria-label="拖曳調整地圖與表格比例" onPointerDown={startSplit} onPointerMove={moveSplit} onPointerUp={() => (split.current = null)} />
          <section className="e-tab" aria-label="材料列表與比較">
            <div className="e-tab-head">
              <button className={pane === 'list' ? 'on' : ''} onClick={() => setPane('list')}>材料列表 <em>{L.rows.length}</em></button>
              <button className={pane === 'compare' ? 'on' : ''} onClick={() => setPane('compare')}>材料比較 <em>{L.selected.length}</em></button>
              {L.selected.length > 0 && <span className="selinfo">已選取 {L.selected.length} 個材料 <button onClick={() => setPane('compare')}>比較材料</button> <button onClick={L.clearSelection}>清除選取</button></span>}
              <span className="sp" />
              {!insp && <button onClick={() => setInsp(true)}>顯示檢視面板 ▸</button>}
            </div>
            <div className="e-tab-body" ref={bodyRef}>
              {pane === 'list' ? (
                <table className="e-table">
                  <thead>
                    <tr>
                      <th className="chk" />
                      {L.cols.visible.map((id) => {
                        const d = COLUMN_BY_ID[id]; const p = propOf(id); const on = L.sort.key === id;
                        return <th key={id} className={d.numeric ? 'num' : ''} onClick={() => L.onSort(id as SortKey)} aria-sort={on ? (L.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>{d.label}{p && <small>{unitFor(p, L.units)}</small>}{on && (L.sort.dir === 'asc' ? ' ▲' : ' ▼')}</th>;
                      })}
                      <th className="act">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {L.rows.map((m) => (
                      <tr key={m.id} data-id={m.id} className={`${L.detailId === m.id ? 'active' : ''} ${hover === m.id ? 'hov' : ''}`} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} onClick={() => { L.setDetailId(m.id); setInsp(true); }}>
                        <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(m.id)} onChange={() => L.toggle(m.id)} aria-label={`選取 ${m.name}`} /></td>
                        {L.cols.visible.map((id) => cell(id, m))}
                        <td className="act" onClick={(e) => e.stopPropagation()}><button onClick={() => L.setEditing(m)}>編輯</button><button className="del" onClick={() => L.setDeleting(m)}>刪除</button></td>
                      </tr>
                    ))}
                    {!L.rows.length && <tr><td colSpan={L.cols.visible.length + 2} className="none">沒有符合條件的材料</td></tr>}
                  </tbody>
                </table>
              ) : L.picked.length >= 2 ? (
                <CompareMatrix materials={L.picked} units={L.units} bars hoverId={hover} onHover={setHover} onOpen={(m) => { L.setDetailId(m.id); setInsp(true); }} onRemove={L.toggle} props={orderedProps(L, true)} />
              ) : <div className="cx-empty">請在「材料列表」勾選至少 2 個材料（數量不限），地圖上會以虛線環標示。</div>}
            </div>
          </section>
        </div>

        {insp && (
          <aside className="e-insp" aria-label="檢視面板">
            <div className="e-insp-head"><b>檢視面板</b><span className="sp" /><button onClick={() => setInsp(false)} aria-label="收合檢視面板">收合 ▸</button></div>
            {L.detail ? (
              <div className="e-insp-body">
                <h2><CategoryDot c={L.detail.category} size={10} /> {L.detail.name}</h2>
                <div className="e-insp-act"><button onClick={() => L.setEditing(L.detail!)}>編輯</button><button className="danger" onClick={() => L.setDeleting(L.detail!)}>刪除</button><button onClick={() => L.toggle(L.detail!.id)}>{sel.has(L.detail.id) ? '✓ 已加入比較' : '＋ 加入比較'}</button></div>
                <h4>基本性質</h4><PropList m={L.detail} units={L.units} props={orderedProps(L)} />
                <h4>材料曲線</h4><StressStrainCurve m={L.detail} />
                <h4>來源與備註</h4><SourceNotes m={L.detail} />
                <h4>歷史記錄</h4><HistoryList m={L.detail} />
              </div>
            ) : <div className="cx-empty">在地圖或表格中點選材料，<br />即可在此檢視詳細資料。</div>}
          </aside>
        )}
      </div>

      {etan && (
        <div className="e-sheet" role="dialog" aria-modal="true">
          <header><h2>ETAN 算法</h2><span className="sp" /><button onClick={() => setEtan(false)}>返回材料列表</button></header>
          <div className="e-sheet-body"><EtanPage materials={L.materials} /></div>
        </div>
      )}
      <LibraryDialogs L={L} />
      <ConceptBadge id="e" />
    </div>
  );
}
