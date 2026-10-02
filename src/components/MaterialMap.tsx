import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Category, Material } from '../types';
import { CATEGORIES, CATEGORY_LABEL } from '../types';
import { ArrowLeftIcon, InfoIcon } from './icons';

export const CATEGORY_COLOR: Record<Category, string> = {
  Metal: '#2563eb',
  Plastic: '#d97706',
  Composite: '#7c3aed',
  Elastomer: '#0d9488',
  Others: '#64748b',
};

interface Props {
  materials: Material[];
  onBack: () => void;
  onInfo: () => void;
  onOpen: (m: Material) => void;
}

interface Scale {
  to: (v: number) => number;
  ticks: number[];
  minor: number[];
}

function logScale(min: number, max: number, a: number, b: number): Scale {
  const lo = Math.log10(min) - 0.2;
  const hi = Math.log10(max) + 0.2;
  const ticks: number[] = [];
  const minor: number[] = [];
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
    for (const k of [1, 2, 5]) {
      const v = k * Math.pow(10, e);
      const l = Math.log10(v);
      if (l >= lo && l <= hi) {
        ticks.push(v);
        if (k !== 1) minor.push(v);
      }
    }
  }
  return { ticks, minor, to: (v) => a + ((Math.log10(v) - lo) / (hi - lo)) * (b - a) };
}

function fmtTick(v: number, sci: boolean) {
  if (sci) return v.toExponential(0).replace('e-', 'E-').replace('e+', 'E');
  return v.toLocaleString('en-US');
}

interface Pt {
  m: Material;
  cx: number;
  cy: number;
}

interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  /** Leader line from the dot to the label (used when points overlap). */
  leader?: { x1: number; y1: number; x2: number; y2: number };
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const textW = (name: string) => name.length * 6.8 + 4;
const CLUSTER_PX = 18;

/**
 * Label placement.
 * 1. Points closer than CLUSTER_PX (e.g. SGCC / SUS304 0H / SUS304 1/2H, or identical ZAMAK3 / ZAMAK5) are
 *    labelled in a stacked column beside the cluster with thin leader lines, so every name stays readable.
 * 2. Remaining points use greedy placement (right, left, above, below) that avoids dots and other labels.
 */
function placeLabels(pts: Pt[], bounds: { l: number; r: number; t: number; b: number }) {
  const out = new Map<string, Label>();
  const placed: Box[] = [];
  const dots: Box[] = pts.map((p) => ({ x: p.cx - 7, y: p.cy - 7, w: 14, h: 14 }));
  const inside = (b: Box) => b.x >= bounds.l && b.x + b.w <= bounds.r && b.y >= bounds.t && b.y + b.h <= bounds.b;

  // --- clusters (union-find on pixel distance) ---
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      if (Math.hypot(pts[i].cx - pts[j].cx, pts[i].cy - pts[j].cy) < CLUSTER_PX) parent[find(j)] = find(i);
  const groups = new Map<number, Pt[]>();
  pts.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));

  const clustered = new Set<string>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => a.cy - b.cy || a.m.name.localeCompare(b.m.name));
    const cx = g.reduce((t, p) => t + p.cx, 0) / g.length;
    const cy = g.reduce((t, p) => t + p.cy, 0) / g.length;
    const lineH = 18;
    const span = (sorted.length - 1) * lineH;
    const top = Math.min(Math.max(cy - span / 2, bounds.t + 12), bounds.b - span - 12);
    const preferLeft = cx > (bounds.l + bounds.r) / 2;

    const layout = (left: boolean) =>
      sorted.map((p, k) => {
        const ly = top + k * lineH;
        const lx = left ? cx - 46 : cx + 46;
        const w = textW(p.m.name);
        const box: Box = { x: left ? lx - 4 - w : lx + 4, y: ly - 8, w, h: 16 };
        return { p, ly, lx, box };
      });
    const fits = (items: ReturnType<typeof layout>) =>
      items.every((it) => inside(it.box) && !dots.some((d, di) => pts[di].cx !== it.p.cx && hit(it.box, d)) && !placed.some((q) => hit(it.box, q)));

    let items = layout(preferLeft);
    if (!fits(items)) {
      const alt = layout(!preferLeft);
      if (fits(alt)) items = alt;
    }
    const left = items[0].box.x < cx;
    for (const it of items) {
      placed.push(it.box);
      clustered.add(it.p.m.id);
      out.set(it.p.m.id, {
        x: left ? it.lx - 4 : it.lx + 4,
        y: it.ly + 4,
        anchor: left ? 'end' : 'start',
        leader: { x1: it.p.cx, y1: it.p.cy, x2: it.lx, y2: it.ly },
      });
    }
  }

  // --- single points ---
  [...pts]
    .filter((p) => !clustered.has(p.m.id))
    .sort((a, b) => a.cy - b.cy)
    .forEach((p) => {
      const w = textW(p.m.name);
      const h = 14;
      const cands = [
        { x: p.cx + 10, y: p.cy - h / 2, anchor: 'start' as const, bx: p.cx + 10 },
        { x: p.cx - 10, y: p.cy - h / 2, anchor: 'end' as const, bx: p.cx - 10 - w },
        { x: p.cx, y: p.cy - 10 - h, anchor: 'middle' as const, bx: p.cx - w / 2 },
        { x: p.cx, y: p.cy + 10, anchor: 'middle' as const, bx: p.cx - w / 2 },
      ];
      const pick =
        cands.find((c) => {
          const box: Box = { x: c.bx, y: c.y, w, h };
          return inside(box) && !placed.some((q) => hit(box, q)) && !dots.some((d) => hit(box, d));
        }) ?? cands[0];
      placed.push({ x: pick.bx, y: pick.y, w, h });
      out.set(p.m.id, { x: pick.x, y: pick.y + h - 3, anchor: pick.anchor });
    });
  return out;
}

export function MaterialMap({ materials, onBack, onInfo, onOpen }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.max(520, el.clientWidth), h: Math.max(380, el.clientHeight) });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Only materials with BOTH ρ and E can be plotted; missing values are never treated as zero.
  const plottable = useMemo(() => materials.filter((m) => m.density !== null && m.youngsModulus !== null), [materials]);
  const skipped = materials.filter((m) => m.density === null || m.youngsModulus === null);

  const { w, h } = size;
  const pad = { l: 80, r: 28, t: 24, b: 60 };

  const geom = useMemo(() => {
    if (plottable.length === 0) return null;
    const dens = plottable.map((m) => m.density as number);
    const mods = plottable.map((m) => m.youngsModulus as number);
    // Fixed log–log axes keep light/soft and heavy/stiff materials readable on one chart.
    const xs = logScale(Math.min(...dens), Math.max(...dens), pad.l, w - pad.r);
    const ys = logScale(Math.min(...mods), Math.max(...mods), h - pad.b, pad.t);
    const pts: Pt[] = plottable.map((m) => ({ m, cx: xs.to(m.density as number), cy: ys.to(m.youngsModulus as number) }));
    const labels = placeLabels(pts, { l: pad.l, r: w - pad.r, t: pad.t, b: h - pad.b });
    return { xs, ys, pts, labels };
  }, [plottable, w, h]);

  const active = plottable.find((m) => m.id === hoverId) ?? null;
  const activePt = geom?.pts.find((p) => p.m.id === hoverId) ?? null;
  const used = CATEGORIES.filter((c) => plottable.some((m) => m.category === c));

  return (
    <main className="page map-page">
      <div className="page-head">
        <button className="back-link" onClick={onBack}>
          <ArrowLeftIcon /> 返回材料列表
        </button>
        <h1>材料地圖</h1>
        <span className="map-subtitle">
          輕量化 vs. 剛性（Lightweight vs. Stiffness, ρ – E）
          <button className="info-btn" onClick={onInfo} aria-label="如何閱讀這張圖" title="如何閱讀這張圖">
            <InfoIcon size={15} />
          </button>
        </span>
        <span className="page-sub">輔助工具：以 ρ–E 圖快速瀏覽材料的輕量化與剛性分佈。</span>
      </div>

      <div className="map-chart" ref={wrapRef}>
        {geom ? (
          <>
            <svg width={w} height={h} role="group" aria-label="Density 與 Young's Modulus 散佈圖" data-testid="map-svg">
              <rect x={pad.l} y={pad.t} width={Math.min(200, (w - pad.l - pad.r) * 0.3)} height={46} className="ideal-zone" />
              <text x={pad.l + 10} y={pad.t + 19} className="ideal-text">輕量 + 高剛性</text>
              <text x={pad.l + 10} y={pad.t + 35} className="ideal-sub">左上方區域</text>

              {geom.ys.ticks.map((t) => (
                <g key={`yt${t}`}>
                  <line x1={pad.l} x2={w - pad.r} y1={geom.ys.to(t)} y2={geom.ys.to(t)} className={`grid ${geom.ys.minor.includes(t) ? 'minor' : ''}`} />
                  <text x={pad.l - 8} y={geom.ys.to(t) + 4} textAnchor="end" className="tick">{fmtTick(t, false)}</text>
                </g>
              ))}
              {geom.xs.ticks.map((t) => (
                <g key={`xt${t}`}>
                  <line x1={geom.xs.to(t)} x2={geom.xs.to(t)} y1={pad.t} y2={h - pad.b} className={`grid ${geom.xs.minor.includes(t) ? 'minor' : ''}`} />
                  <text x={geom.xs.to(t)} y={h - pad.b + 18} textAnchor="middle" className="tick">{fmtTick(t, true)}</text>
                </g>
              ))}
              <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} className="axis" />
              <line x1={pad.l} x2={pad.l} y1={pad.t} y2={h - pad.b} className="axis" />

              <text x={(pad.l + w - pad.r) / 2} y={h - 14} textAnchor="middle" className="axis-title">
                Density ρ (t/mm³)　← 較輕
              </text>
              <text transform={`translate(18 ${(pad.t + h - pad.b) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
                Young's Modulus E (MPa)　較剛 →
              </text>

              {activePt && (
                <g className="crosshair">
                  <line x1={pad.l} x2={activePt.cx} y1={activePt.cy} y2={activePt.cy} />
                  <line x1={activePt.cx} x2={activePt.cx} y1={activePt.cy} y2={h - pad.b} />
                </g>
              )}

              {geom.pts.map(({ m, cx, cy }) => {
                const lab = geom.labels.get(m.id);
                const isActive = m.id === hoverId;
                return (
                  <g
                    key={m.id}
                    className={`map-pt ${isActive ? 'active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${m.name}：Density ${m.density}、Young's Modulus ${m.youngsModulus}，按 Enter 查看詳細資料`}
                    onMouseEnter={() => setHoverId(m.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onFocus={() => setHoverId(m.id)}
                    onBlur={() => setHoverId(null)}
                    onClick={() => onOpen(m)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(m))}
                    data-name={m.name}
                  >
                    {lab?.leader && <line x1={lab.leader.x1} y1={lab.leader.y1} x2={lab.leader.x2} y2={lab.leader.y2} className="leader" />}
                    <circle cx={cx} cy={cy} r={6} fill={CATEGORY_COLOR[m.category]} className="pt-dot" />
                    {lab && (
                      <text x={lab.x} y={lab.y} textAnchor={lab.anchor} className="pt-text">{m.name}</text>
                    )}
                  </g>
                );
              })}

              {activePt && active && (
                <g pointerEvents="none">
                  <circle cx={activePt.cx} cy={activePt.cy} r={11} className="pt-ring" />
                  <circle cx={activePt.cx} cy={activePt.cy} r={6} fill={CATEGORY_COLOR[active.category]} className="pt-dot" />
                </g>
              )}

              {active && activePt && (
                <foreignObject
                  x={Math.min(activePt.cx + 16, w - 250)}
                  y={Math.max(pad.t, Math.min(activePt.cy + 14, h - pad.b - 106))}
                  width="232"
                  height="100"
                  pointerEvents="none"
                >
                  <div className="map-tip">
                    <b>{active.name}</b>
                    <span>{CATEGORY_LABEL[active.category]} · 點擊查看詳細資料</span>
                    <div>Density <i>{active.density!.toExponential(2).replace('e-', 'E-')}</i> t/mm³</div>
                    <div>Young's Modulus <i>{active.youngsModulus!.toLocaleString('en-US')}</i> MPa</div>
                  </div>
                </foreignObject>
              )}
            </svg>

            <ul className="map-legend" aria-label="材料類別圖例">
              {used.map((c) => (
                <li key={c}>
                  <i style={{ background: CATEGORY_COLOR[c] }} /> {CATEGORY_LABEL[c]}
                </li>
              ))}
            </ul>
            {skipped.length > 0 && (
              <p className="skipped" data-testid="map-skipped">
                未顯示（缺少 Density 或 Young's Modulus）：{skipped.map((m) => m.name).join('、')}
              </p>
            )}
          </>
        ) : (
          <div className="empty-state">目前沒有同時具備 Density 與 Young's Modulus 的材料，無法繪製地圖。</div>
        )}
      </div>
    </main>
  );
}
