import { useEffect, useState } from 'react';
import { useLibrary } from '../shared/useLibrary';
import { ColumnsPopover, LibraryDialogs } from '../shared/LibraryDialogs';
import { CategoryDot, orderedProps } from '../shared/parts';
import { CompareMatrix } from '../shared/CompareMatrix';
import { Scatter } from '../shared/scatter';
import { ConceptBadge } from '../shared/ConceptBadge';
import { MaterialDrawer } from '../../components/MaterialDrawer';
import { EtanPage } from '../../components/EtanPage';
import { CATEGORIES, CATEGORY_LABEL } from '../../types';
import { formatValue } from '../../lib/format';
import logo from '../../assets/lenovo-logo.png';

/** Concept D — Workbench: comparison-centric dark workspace. Rail = candidates, centre = live matrix, right = linked ρ–E map. */
export function ConceptD() {
  const L = useLibrary();
  const [tab, setTab] = useState<'bench' | 'etan'>('bench');
  const [bars, setBars] = useState(true);
  const [ext, setExt] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  // Demo convenience: start with a few candidates on the bench (selection is runtime-only, never persisted).
  useEffect(() => {
    if (L.materials.length && L.selected.length === 0) {
      const first = ['ADC12', 'Al7050', 'SGCC', 'ZAMAK3'].map((n) => L.materials.find((m) => m.name === n)?.id).filter((x): x is string => !!x);
      if (first.length) L.setSelected(first);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = new Set(L.selected);
  const props = orderedProps(L, true);
  const open = (id: string) => { L.setDetailId(id); setDrawer(true); };

  return (
    <div className="cx cx-d">
      <header className="d-top">
        <img src={logo} alt="Lenovo" />
        <b>CAE 材料資料庫</b>
        <nav>
          <button className={tab === 'bench' ? 'on' : ''} onClick={() => setTab('bench')}>比較工作台</button>
          <button className={tab === 'etan' ? 'on' : ''} onClick={() => setTab('etan')}>ETAN 算法</button>
        </nav>
        <span className="sp" />
        <div className="popover-anchor"><button onClick={() => L.setColumnsOpen(!L.columnsOpen)} data-col-settings-trigger>欄位設定</button><ColumnsPopover L={L} /></div>
        <button onClick={() => L.setDialog('io')}>匯入 / 匯出</button>
        <button onClick={() => L.setDialog('help')}>使用說明</button>
        <button className="pri" onClick={() => L.setEditing('new')}>＋ 新增材料</button>
      </header>

      {tab === 'etan' ? <div className="d-etan"><EtanPage materials={L.materials} /></div> : (
        <div className="d-main">
          <aside className="d-rail" aria-label="候選材料">
            <div className="d-rail-head">
              <h3>候選材料 <em>{L.rows.length}</em></h3>
              <input type="search" value={L.query} onChange={(e) => L.setQuery(e.target.value)} placeholder="搜尋材料名稱、關鍵字或來源..." aria-label="搜尋" />
              <div className="d-cats">
                <button className={L.filters.category === 'all' ? 'on' : ''} onClick={() => L.setFilters({ ...L.filters, category: 'all' })}>全部</button>
                {CATEGORIES.map((c) => (
                  <button key={c} className={L.filters.category === c ? 'on' : ''} onClick={() => L.setFilters({ ...L.filters, category: L.filters.category === c ? 'all' : c })}><CategoryDot c={c} /> {CATEGORY_LABEL[c]}</button>
                ))}
              </div>
              <div className="d-rail-act">
                <button onClick={() => L.setSelected([...new Set([...L.selected, ...L.rows.map((r) => r.id)])])}>全部加入</button>
                <button onClick={L.clearSelection} disabled={!L.selected.length}>清除選取</button>
              </div>
            </div>
            <ul className="d-cands">
              {L.rows.map((m) => (
                <li key={m.id} className={`${sel.has(m.id) ? 'in' : ''} ${hover === m.id ? 'hov' : ''}`} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)}>
                  <label>
                    <input type="checkbox" checked={sel.has(m.id)} onChange={() => L.toggle(m.id)} />
                    <CategoryDot c={m.category} />
                    <span className="nm">{m.name}</span>
                    <span className="mini mono">ρ {formatValue('density', m.density, L.units)}</span>
                    <span className="mini mono">E {formatValue('youngsModulus', m.youngsModulus, L.units)}</span>
                  </label>
                  <span className="rowact"><button onClick={() => open(m.id)} aria-label={`檢視 ${m.name}`}>檢視</button><button onClick={() => L.setEditing(m)} aria-label={`編輯 ${m.name}`}>編輯</button><button onClick={() => L.setDeleting(m)} aria-label={`刪除 ${m.name}`}>刪除</button></span>
                </li>
              ))}
              {!L.rows.length && <li className="none">沒有符合條件的材料</li>}
            </ul>
          </aside>

          <section className="d-bench">
            <div className="d-bench-head">
              <h2>材料比較 <em>{L.picked.length}</em></h2>
              <span className="muted">{L.picked.length >= 2 ? `已選擇 ${L.picked.length} 個材料進行比較，可同時比較更多材料。` : '從左側加入至少 2 個材料。'}</span>
              <span className="sp" />
              <label className="tg"><input type="checkbox" checked={bars} onChange={(e) => setBars(e.target.checked)} /> 數值長條</label>
              <label className="tg"><input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} /> 標示最大 / 最小</label>
            </div>
            <div className="d-matrix">
              {L.picked.length ? <CompareMatrix materials={L.picked} units={L.units} bars={bars} extremes={ext} props={props} hoverId={hover} onHover={setHover} onOpen={(m) => open(m.id)} onRemove={L.toggle} /> : <div className="cx-empty">工作台是空的。<br />請從左側勾選候選材料。</div>}
            </div>
          </section>

          <aside className="d-map" aria-label="材料地圖">
            <div className="d-map-head">
              <b>材料地圖</b><span>ρ – E</span>
              <button className="info" onClick={() => L.setDialog('mapInfo')} aria-label="如何閱讀這張圖">ⓘ</button>
            </div>
            <p className="d-map-sub">輕量化 vs. 剛性（Lightweight vs. Stiffness）；已選材料以虛線環標示，未選材料淡化。</p>
            <div className="d-map-plot">
              <Scatter
                materials={L.materials}
                dimmed={L.selected.length ? new Set(L.materials.filter((m) => !sel.has(m.id)).map((m) => m.id)) : undefined}
                ringed={sel}
                highlight={hover}
                onHover={setHover}
                onPick={(m) => L.toggle(m.id)}
                fontSize={11}
                pad={{ l: 62, r: 14, t: 12, b: 40 }}
                zoneText={false}
              />
            </div>
            <p className="d-map-hint">點選地圖上的點＝加入／移出工作台</p>
          </aside>
        </div>
      )}

      {drawer && L.detail && <MaterialDrawer material={L.detail} units={L.units} onClose={() => setDrawer(false)} onEdit={() => L.setEditing(L.detail!)} onDelete={() => L.setDeleting(L.detail!)} />}
      <LibraryDialogs L={L} />
      <ConceptBadge id="d" />
    </div>
  );
}
