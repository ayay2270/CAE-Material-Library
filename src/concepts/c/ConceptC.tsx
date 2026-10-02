import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../shared/useLibrary';
import { ColumnsPopover, LibraryDialogs } from '../shared/LibraryDialogs';
import { CategoryDot, CategoryTag, HistoryList, PropList, SourceNotes, orderedProps, propOf } from '../shared/parts';
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

type Sheet = 'compare' | 'map' | 'etan' | null;

function Hl({ text, q }: { text: string; q: string }) {
  const s = q.trim();
  const i = s ? text.toLowerCase().indexOf(s.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + s.length)}</mark>{text.slice(i + s.length)}</>;
}

/** Concept C — Quick-Find: search-first screen, keyboard flow, inline data bars, Quick Look preview. */
export function ConceptC() {
  const L = useLibrary();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [cursor, setCursor] = useState(0);
  const [look, setLook] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = L.rows;
  const cur = rows[Math.min(cursor, Math.max(0, rows.length - 1))];
  const lookIdx = look ? rows.findIndex((r) => r.id === look) : -1;
  const lookM = look ? L.materials.find((m) => m.id === look) ?? null : null;

  useEffect(() => setCursor(0), [L.query, L.filters]);

  // bar scale per property column (log for ρ and E which span decades)
  const scales = useMemo(() => {
    const out: Record<string, (v: number) => number> = {};
    for (const p of PROPS_FOR_BARS) {
      const vals = L.materials.map((m) => m[p.key]).filter((v): v is number => v !== null && v > 0);
      if (!vals.length) continue;
      const mx = Math.max(...vals);
      const mn = Math.min(...vals);
      out[p.key] = p.log && mx > mn ? (v) => 8 + 92 * ((Math.log10(v) - Math.log10(mn)) / (Math.log10(mx) - Math.log10(mn))) : (v) => Math.max(3, (v / mx) * 100);
    }
    return out;
  }, [L.materials]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if (document.querySelector('.overlay')) return;
      const go = (d: number) => {
        e.preventDefault();
        if (look) {
          const n = rows[Math.min(rows.length - 1, Math.max(0, lookIdx + d))];
          if (n) setLook(n.id);
        } else {
          setCursor((c) => Math.min(rows.length - 1, Math.max(0, c + d)));
          bodyRef.current?.querySelector(`[data-i="${Math.min(rows.length - 1, Math.max(0, cursor + d))}"]`)?.scrollIntoView({ block: 'nearest' });
        }
      };
      if (e.key === 'Escape') { if (look) setLook(null); else if (sheet) setSheet(null); return; }
      if (e.key === 'ArrowDown') return go(1);
      if (e.key === 'ArrowUp') return go(-1);
      if (look && e.key === 'ArrowRight') return go(1);
      if (look && e.key === 'ArrowLeft') return go(-1);
      if (e.key === 'Enter' && !look && cur && !sheet) { setLook(cur.id); return; }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === ' ' && cur && !sheet) { e.preventDefault(); setLook(look ? null : cur.id); }
      else if ((e.key === 'c' || e.key === 'C') && (look || cur)) L.toggle((look ?? cur!.id));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rows, cur, cursor, look, lookIdx, sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = L.filters;
  const dir = L.sort.dir;

  const cell = (id: ColId, m: Material) => {
    const p = propOf(id);
    if (p) {
      const v = m[p.key];
      const w = v !== null && v > 0 && scales[p.key] ? scales[p.key](v) : 0;
      return <td key={id} className={`num ${v === null ? 'missing' : ''}`}><span className="bar" style={{ width: `${w}%` }} /><span className="val">{formatValue(p.key, v, L.units)}</span></td>;
    }
    if (id === 'name') return <td key={id} className="nm"><Hl text={m.name} q={L.query} /></td>;
    if (id === 'category') return <td key={id}><CategoryTag c={m.category} /></td>;
    if (id === 'source') return <td key={id} className="src" title={m.source}><Hl text={m.source || '—'} q={L.query} /></td>;
    return <td key={id} className="mono dt">{formatDay(m.updatedAt)}</td>;
  };

  return (
    <div className="cx cx-c">
      <header className="c-top">
        <img src={logo} alt="Lenovo" /><b>CAE 材料資料庫</b>
        <span className="sp" />
        <button onClick={() => setSheet('map')}>材料地圖</button>
        <button onClick={() => setSheet('etan')}>ETAN 算法</button>
        <div className="popover-anchor"><button onClick={() => L.setColumnsOpen(!L.columnsOpen)} data-col-settings-trigger>欄位設定</button><ColumnsPopover L={L} /></div>
        <button onClick={() => L.setDialog('io')}>匯入 / 匯出</button>
        <button onClick={() => L.setDialog('help')}>使用說明</button>
        <button className="pri" onClick={() => L.setEditing('new')}>＋ 新增材料</button>
      </header>

      <section className="c-find">
        <div className="c-search">
          <span className="ico" aria-hidden="true">⌕</span>
          <input ref={searchRef} autoFocus type="search" value={L.query} onChange={(e) => L.setQuery(e.target.value)} placeholder="搜尋材料名稱、關鍵字或來源..." aria-label="搜尋材料" />
          <kbd>/</kbd>
        </div>
        <div className="c-facets">
          <div className="grp"><span>類別</span>
            {CATEGORIES.map((c) => (
              <button key={c} className={`chip ${f.category === c ? 'on' : ''}`} aria-pressed={f.category === c} onClick={() => L.setFilters({ ...f, category: f.category === c ? 'all' : c })}>
                <CategoryDot c={c} /> {CATEGORY_LABEL[c]} <em>{L.materials.filter((m) => m.category === c).length}</em>
              </button>
            ))}
          </div>
          <div className="grp"><span>來源</span>
            {L.sources.map((s) => (
              <button key={s} className={`chip ${f.source === s ? 'on' : ''}`} aria-pressed={f.source === s} onClick={() => L.setFilters({ ...f, source: f.source === s ? 'all' : s })}>{s} <em>{L.materials.filter((m) => m.source === s).length}</em></button>
            ))}
          </div>
          <div className="grp"><span>更新</span>
            {UPDATED_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
              <button key={o.value} className={`chip ${f.updated === o.value ? 'on' : ''}`} aria-pressed={f.updated === o.value} onClick={() => L.setFilters({ ...f, updated: f.updated === o.value ? 'all' : o.value })}>{o.label}</button>
            ))}
          </div>
          {(f.category !== 'all' || f.source !== 'all' || f.updated !== 'all' || L.query) && (
            <button className="clear" onClick={() => { L.setFilters({ category: 'all', source: 'all', updated: 'all' }); L.setQuery(''); }}>清除全部條件</button>
          )}
        </div>
      </section>

      <div className="c-resbar">
        <span><b>{rows.length}</b> 筆結果 <span className="muted">/ 共 {L.materials.length} 筆</span></span>
        <span className="keys"><kbd>↑</kbd><kbd>↓</kbd> 移動　<kbd>Enter</kbd> / <kbd>Space</kbd> 快速檢視　<kbd>C</kbd> 加入比較</span>
      </div>

      <div className="c-body" ref={bodyRef}>
        <table className="c-table">
          <thead>
            <tr>
              <th className="chk" />
              {L.cols.visible.map((id) => {
                const def = COLUMN_BY_ID[id]; const p = propOf(id); const on = L.sort.key === id;
                return <th key={id} className={def.numeric ? 'num' : ''} onClick={() => L.onSort(id as SortKey)} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>{def.label}{p && <small>{unitFor(p, L.units)}</small>}{on && <i>{dir === 'asc' ? ' ▲' : ' ▼'}</i>}</th>;
              })}
              <th className="act" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.id} data-i={i} className={`${cur?.id === m.id ? 'cur' : ''} ${L.selected.includes(m.id) ? 'sel' : ''}`} onClick={() => { setCursor(i); setLook(m.id); }} onMouseEnter={() => setCursor(i)}>
                <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={L.selected.includes(m.id)} onChange={() => L.toggle(m.id)} aria-label={`加入比較 ${m.name}`} /></td>
                {L.cols.visible.map((id) => cell(id, m))}
                <td className="act" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setLook(m.id)}>檢視</button>
                  <button onClick={() => L.setEditing(m)}>編輯</button>
                  <button className="del" onClick={() => L.setDeleting(m)}>刪除</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={L.cols.visible.length + 2} className="none">沒有符合「{L.query || '目前條件'}」的材料</td></tr>}
          </tbody>
        </table>
      </div>

      {L.selected.length > 0 && (
        <div className="c-dock" role="status">
          <b>已選取 {L.selected.length} 個材料</b>
          <div className="chips">{L.picked.map((m) => <span key={m.id}>{m.name}<button onClick={() => L.toggle(m.id)} aria-label={`移除 ${m.name}`}>×</button></span>)}</div>
          <button className="pri" disabled={L.selected.length < 2} onClick={() => setSheet('compare')}>比較材料</button>
          <button onClick={L.clearSelection}>清除選取</button>
        </div>
      )}

      {lookM && (
        <div className="c-look-bg" onMouseDown={(e) => e.target === e.currentTarget && setLook(null)}>
          <div className="c-look" role="dialog" aria-modal="true" aria-label={`${lookM.name} 快速檢視`}>
            <header>
              <div><h2>{lookM.name}</h2><CategoryTag c={lookM.category} /></div>
              <span className="sp" />
              <span className="muted nav">{lookIdx + 1} / {rows.length}</span>
              <button onClick={() => setLook(rows[Math.max(0, lookIdx - 1)].id)} disabled={lookIdx <= 0} aria-label="上一個">←</button>
              <button onClick={() => setLook(rows[Math.min(rows.length - 1, lookIdx + 1)].id)} disabled={lookIdx >= rows.length - 1} aria-label="下一個">→</button>
              <button onClick={() => setLook(null)} aria-label="關閉">✕</button>
            </header>
            <div className="c-look-body">
              <div><h4>基本性質</h4><PropList m={lookM} units={L.units} props={orderedProps(L)} /><h4>來源與備註</h4><SourceNotes m={lookM} /></div>
              <div><h4>材料曲線</h4><StressStrainCurve m={lookM} /><h4>歷史記錄</h4><HistoryList m={lookM} /></div>
            </div>
            <footer>
              <button onClick={() => L.toggle(lookM.id)}>{L.selected.includes(lookM.id) ? '✓ 已加入比較' : '＋ 加入比較'}<kbd>C</kbd></button>
              <span className="sp" />
              <button className="danger" onClick={() => { L.setDeleting(lookM); }}>刪除</button>
              <button className="pri" onClick={() => L.setEditing(lookM)}>編輯</button>
            </footer>
          </div>
        </div>
      )}

      {sheet && (
        <div className="c-sheet" role="dialog" aria-modal="true">
          <header>
            <h2>{sheet === 'compare' ? '材料比較' : sheet === 'map' ? '材料地圖' : 'ETAN 算法'}</h2>
            {sheet === 'compare' && <span className="muted">已選擇 {L.picked.length} 個材料進行比較，可同時比較更多材料。</span>}
            {sheet === 'map' && <><span>輕量化 vs. 剛性（Lightweight vs. Stiffness, ρ – E）</span><button className="info" onClick={() => L.setDialog('mapInfo')} aria-label="如何閱讀這張圖">ⓘ</button></>}
            <span className="sp" />
            <button onClick={() => setSheet(null)}>返回材料列表 <kbd>Esc</kbd></button>
          </header>
          <div className="c-sheet-body">
            {sheet === 'compare' && (L.picked.length >= 2 ? <CompareMatrix materials={L.picked} units={L.units} bars onOpen={(m) => { setSheet(null); setLook(m.id); }} onRemove={L.toggle} /> : <div className="cx-empty">請在列表勾選至少 2 個材料。</div>)}
            {sheet === 'map' && <div className="c-map"><Scatter materials={L.materials} ringed={new Set(L.selected)} onPick={(m) => { setSheet(null); setLook(m.id); }} /></div>}
            {sheet === 'etan' && <EtanPage materials={L.materials} />}
          </div>
        </div>
      )}

      <LibraryDialogs L={L} />
      <ConceptBadge id="c" />
    </div>
  );
}

const PROPS_FOR_BARS: { key: 'density' | 'youngsModulus' | 'poissonRatio' | 'yieldStress' | 'etan' | 'ultimateStress' | 'elongation'; log: boolean }[] = [
  { key: 'density', log: true },
  { key: 'youngsModulus', log: true },
  { key: 'poissonRatio', log: false },
  { key: 'yieldStress', log: false },
  { key: 'etan', log: false },
  { key: 'ultimateStress', log: false },
  { key: 'elongation', log: false },
];
