import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../gallery.css';

interface Concept {
  id: string;
  name: string;
  tag: string;
  philosophy: string;
  flow: string[];
  best: string;
  traits: string[];
}

const CONCEPTS: Concept[] = [
  {
    id: 'a',
    name: 'Ledger',
    tag: '試算表優先 · 底部檢視面板',
    philosophy: '把材料庫當成工程師最熟悉的試算表：最高資訊密度、24px 列高、凍結窗格、零裝飾。詳細資料不離開表格，貼在底部可拖曳調高的檢視面板。',
    flow: ['在 fx 查詢列搜尋／篩選', '單擊列 → 底部面板同時看性質、曲線、來源', '雙擊列直接編輯', '勾選列 → 材料比較（轉置表格）'],
    best: '每天大量核對、維護、清理數據的材料管理者；要在一個畫面看最多列的資料審查。',
    traits: ['凍結 Material Name 與 Actions', '底部狀態列：筆數／選取／單位', '三欄式檢視面板：性質｜曲線｜來源與歷史'],
  },
  {
    id: 'b',
    name: 'Explorer',
    tag: '資料庫總管 · 主從式 (master-detail)',
    philosophy: '像資料庫總管／檔案總管：左側樹狀篩選一眼看到結構與數量，中間緊湊清單，右側「常駐」完整屬性表。不彈窗、不換頁、不失去脈絡。',
    flow: ['點左側 類別／來源／更新時間 縮小範圍', '↑↓ 瀏覽清單，右側即時顯示該材料全部資料', '勾選加入「比較托盤」', '托盤內按「比較材料」'],
    best: '逐一查證單一材料的來源與數值；想知道「庫裡有什麼」；需要一直看完整資料的 CAE 前處理工程師。',
    traits: ['Facet 樹狀篩選含數量', '右側屬性表依「欄位設定」排序', 'Solver 材料卡槽位（概念示意）'],
  },
  {
    id: 'c',
    name: 'Quick-Find',
    tag: '搜尋優先 · 全鍵盤 · Quick Look',
    philosophy: '知道要找什麼時最快：大搜尋框、關鍵字高亮、facet chips；數值欄內嵌長條（Density、Young’s Modulus 用對數刻度）讓你掃一眼就知道量級。詳細資料以 Quick Look 預覽。',
    flow: ['/ 聚焦搜尋', '↑↓ 選列、Space／Enter 快速檢視、←→ 切換結果', 'C 加入比較', '底部比較列 → 全螢幕比較'],
    best: '建模途中「現在就要某材料的 E、ρ、ν」的快速查詢；偏好鍵盤的重度使用者。',
    traits: ['Quick Look 預覽（Space）', '數值長條＋關鍵字高亮', '比較／地圖以全螢幕頁籤開啟，主畫面保持乾淨'],
  },
  {
    id: 'd',
    name: 'Workbench',
    tag: '比較中心 · 暗色主題 · 地圖連動',
    philosophy: '材料選型本質是「比較」而非「瀏覽」：中央永遠是比較矩陣（數值長條＋最大／最小標示），左側是候選池，右側 ρ–E 地圖與矩陣雙向連動。暗色主題適合長時間盯數字。',
    flow: ['左側搜尋、勾選候選材料', '中央矩陣即時並排（數量不限）', '在地圖點選增減候選、懸停雙向高亮', '點材料名稱開啟詳細抽屜'],
    best: '新專案材料選型、設計審查、需要把 3–10 種候選並排說服團隊的場合。',
    traits: ['矩陣列順序跟隨「欄位設定」', '地圖淡化未選材料、虛線環標示已選', '預設放入 4 個示範候選（僅執行期，不儲存）'],
  },
  {
    id: 'e',
    name: 'Atlas',
    tag: '地圖優先 · 上下分割 · 雙向連動',
    philosophy: '先看「分佈」再看「數值」：類別卡片就是篩選器，上半部 ρ–E 地圖、下半部表格，兩者雙向連動；分割線可拖曳、右側檢視面板可收合。',
    flow: ['點類別卡片篩選', '在地圖找「左上角」（輕且剛）的候選', '點點 → 表格自動定位並於右側檢視', '勾選後切到「材料比較」，地圖以虛線環標示'],
    best: '輕量化設計探索與初篩；一眼看出資料庫涵蓋範圍與材料分佈。',
    traits: ['KPI 類別卡片＝篩選器', '地圖與表格懸停連動', '可拖曳分割線、可收合檢視面板'],
  },
];

const GLANCE: [string, string[]][] = [
  ['版面骨架', ['全寬表格＋底部面板', '三欄：樹｜清單｜詳細', '置中搜尋＋結果表', '三欄：候選｜矩陣｜地圖', '地圖／表格上下分割＋右面板']],
  ['材料詳細', ['底部可調高度檢視面板', '右側常駐屬性表', 'Quick Look 彈窗（Space）', '右側抽屜（點材料名稱）', '右側可收合檢視面板']],
  ['搜尋與篩選', ['fx 查詢列＋下拉', '左側 facet 樹', '大搜尋框＋chips', '左側候選池＋類別 chips', '頂部搜尋＋類別卡片']],
  ['材料比較', ['專屬頁籤，轉置表格', '比較托盤 → 全區矩陣', '底部比較列 → 全螢幕', '永遠在中央（主角）', '下方分頁，地圖同步標示']],
  ['材料地圖', ['專屬頁籤', '專屬頁面', '全螢幕頁籤', '右側固定連動面板', '主角：佔上半部']],
  ['色調', ['淺灰＋試算表綠', '深藍側欄＋淺色內容', '白底＋藍色強調', '暗色（slate）', '淺色＋青綠強調']],
];

function Gallery() {
  return (
    <div className="g">
      <header className="g-head">
        <h1>CAE 材料資料庫 · UI/UX 概念圖庫</h1>
        <p>
          五個彼此明顯不同的介面方向，皆使用<b>同一套資料與邏輯</b>（localStorage、單位、排序／篩選、欄位設定、材料地圖、比較、CSV 匯入匯出完全沿用），只有介面不同。
          可在每個概念內實際操作：新增／編輯／刪除、欄位設定、比較、材料地圖、ⓘ 說明。
        </p>
        <p className="note">
          僅供評審：概念版使用獨立網址與獨立的瀏覽器儲存空間（localStorage），<b>不會影響正式版與其資料</b>；左下角浮動列可在概念間切換。
        </p>
      </header>

      <section className="g-grid">
        {CONCEPTS.map((c) => (
          <article key={c.id} className="g-card">
            <a className="g-thumb" href={`./concept-${c.id}.html`} aria-label={`開啟 Concept ${c.id.toUpperCase()}`}>
              <iframe src={`./concept-${c.id}.html`} title={`Concept ${c.id.toUpperCase()} 預覽`} loading="lazy" tabIndex={-1} />
            </a>
            <div className="g-body">
              <div className="g-title"><span className="g-letter">{c.id.toUpperCase()}</span><div><h2>{c.name}</h2><span>{c.tag}</span></div></div>
              <p>{c.philosophy}</p>
              <h3>主要流程</h3>
              <ol>{c.flow.map((f) => <li key={f}>{f}</li>)}</ol>
              <h3>最適合的 CAE 使用情境</h3>
              <p className="best">{c.best}</p>
              <ul className="traits">{c.traits.map((t) => <li key={t}>{t}</li>)}</ul>
              <a className="g-open" href={`./concept-${c.id}.html`}>開啟 Concept {c.id.toUpperCase()} →</a>
            </div>
          </article>
        ))}
      </section>

      <section className="g-glance">
        <h2>一覽比較</h2>
        <table>
          <thead><tr><th /><th>A · Ledger</th><th>B · Explorer</th><th>C · Quick-Find</th><th>D · Workbench</th><th>E · Atlas</th></tr></thead>
          <tbody>{GLANCE.map(([k, v]) => <tr key={k}><th>{k}</th>{v.map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody>
        </table>
        <p className="note">所有概念共用：欄位設定（拖曳／▲▼ 排序、顯示隱藏、單位顯示）、新增／編輯表單、刪除確認、匯入／匯出、使用說明、地圖 ⓘ 說明、ETAN 算法（公式待補）。屬性名稱維持英文，介面維持繁體中文。</p>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Gallery /></StrictMode>);
