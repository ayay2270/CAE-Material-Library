import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Material } from '../../types';
import { CATEGORIES, CATEGORY_LABEL } from '../../types';
import { CATEGORY_COLOR } from '../../components/MaterialMap';

/* ρ–E scatter used by the concepts. Same maths as the production Material Map
   (fixed log–log, missing ρ or E → not plotted); adds highlight / dim / ring hooks for linked views. */

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
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e++)
    for (const k of [1, 2, 5]) {
      const v = k * Math.pow(10, e);
      const l = Math.log10(v);
      if (l >= lo && l <= hi) {
        ticks.push(v);
        if (k !== 1) minor.push(v);
      }
    }
  return { ticks, minor, to: (v) => a + ((Math.log10(v) - lo) / (hi - lo)) * (b - a) };
}
const fmtTick = (v: number, sci: boolean) => (sci ? v.toExponential(0).replace('e-', 'E-').replace('e+', 'E') : v.toLocaleString('en-US'));

interface Pt {
  m: Material;
  cx: number;
  cy: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Label {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  leader?: { x1: number; y1: number; x2: number; y2: number };
}
const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function placeLabels(pts: Pt[], bounds: { l: number; r: number; t: number; b: number }, fs: number) {
  const cw = fs * 0.58;
  const textW = (n: string) => n.length * cw + 4;
  const out = new Map<string, Label>();
  const placed: Box[] = [];
  const dots: Box[] = pts.map((p) => ({ x: p.cx - 7, y: p.cy - 7, w: 14, h: 14 }));
  const inside = (b: Box) => b.x >= bounds.l && b.x + b.w <= bounds.r && b.y >= bounds.t && b.y + b.h <= bounds.b;
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i].cx - pts[j].cx, pts[i].cy - pts[j].cy) < 12) parent[find(j)] = find(i);
  const groups = new Map<number, Pt[]>();
  pts.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
  const clustered = new Set<string>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => a.cy - b.cy || a.m.name.localeCompare(b.m.name));
    const cx = g.reduce((t, p) => t + p.cx, 0) / g.length;
    const cy = g.reduce((t, p) => t + p.cy, 0) / g.length;
    const lineH = fs + 6;
    const span = (sorted.length - 1) * lineH;
    const top = Math.min(Math.max(cy - span / 2, bounds.t + 12), bounds.b - span - 12);
    const preferLeft = cx > (bounds.l + bounds.r) / 2;
    const layout = (left: boolean) =>
      sorted.map((p, k) => {
        const ly = top + k * lineH;
        const lx = left ? cx - 46 : cx + 46;
        const w = textW(p.m.name);
        return { p, ly, lx, box: { x: left ? lx - 4 - w : lx + 4, y: ly - 8, w, h: 16 } as Box };
      });
    const fits = (items: ReturnType<typeof layout>) => items.every((it) => inside(it.box) && !placed.some((q) => hit(it.box, q)));
    let items = layout(preferLeft);
    if (!fits(items)) {
      const alt = layout(!preferLeft);
      if (fits(alt)) items = alt;
    }
    const left = items[0].box.x < cx;
    for (const it of items) {
      placed.push(it.box);
      clustered.add(it.p.m.id);
      out.set(it.p.m.id, { x: left ? it.lx - 4 : it.lx + 4, y: it.ly + 4, anchor: left ? 'end' : 'start', leader: { x1: it.p.cx, y1: it.p.cy, x2: it.lx, y2: it.ly } });
    }
  }
  [...pts]
    .filter((p) => !clustered.has(p.m.id))
    .sort((a, b) => a.cy - b.cy)
    .forEach((p) => {
      const w = textW(p.m.name);
      const h = fs + 2;
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

interface Props {
  materials: Material[];
  /** Ids drawn faded (no label) — used when another view is the focus. */
  dimmed?: Set<string>;
  /** Ids drawn with a ring (e.g. current compare selection). */
  ringed?: Set<string>;
  highlight?: string | null;
  onHover?: (id: string | null) => void;
  onPick?: (m: Material) => void;
  legend?: boolean;
  fontSize?: number;
  zoneText?: boolean;
  pad?: { l: number; r: number; t: number; b: number };
}

export function Scatter({ materials, dimmed, ringed, highlight, onHover, onPick, legend = true, fontSize = 12, zoneText = true, pad }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 700, h: 420 });
  const [hover, setHover] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.max(260, el.clientWidth), h: Math.max(180, el.clientHeight) });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const P = pad ?? { l: 70, r: 20, t: 16, b: 44 };
  const { w, h } = size;
  const plot = useMemo(() => materials.filter((m) => m.density !== null && m.youngsModulus !== null), [materials]);
  const skipped = materials.length - plot.length;
  const geom = useMemo(() => {
    if (!plot.length) return null;
    const d = plot.map((m) => m.density as number);
    const e = plot.map((m) => m.youngsModulus as number);
    const xs = logScale(Math.min(...d), Math.max(...d), P.l, w - P.r);
    const ys = logScale(Math.min(...e), Math.max(...e), h - P.b, P.t);
    const pts: Pt[] = plot.map((m) => ({ m, cx: xs.to(m.density as number), cy: ys.to(m.youngsModulus as number) }));
    return { xs, ys, pts, labels: placeLabels(pts, { l: P.l, r: w - P.r, t: P.t, b: h - P.b }, fontSize) };
  }, [plot, w, h, P.l, P.r, P.t, P.b, fontSize]);
  const activeId = highlight ?? hover;
  const act = geom?.pts.find((p) => p.m.id === activeId) ?? null;
  const used = CATEGORIES.filter((c) => plot.some((m) => m.category === c));

  return (
    <div className="sc-wrap" ref={ref}>
      {geom ? (
        <>
          <svg width={w} height={h} role="group" aria-label="Density 與 Young's Modulus 散佈圖" data-testid="map-svg">
            {zoneText && (
              <>
                <rect x={P.l} y={P.t} width={Math.min(170, (w - P.l - P.r) * 0.3)} height={40} className="sc-zone" />
                <text x={P.l + 8} y={P.t + 16} className="sc-zone-t">輕量 + 高剛性</text>
                <text x={P.l + 8} y={P.t + 31} className="sc-zone-s">左上方區域</text>
              </>
            )}
            {geom.ys.ticks.map((t) => (
              <g key={`y${t}`}>
                <line x1={P.l} x2={w - P.r} y1={geom.ys.to(t)} y2={geom.ys.to(t)} className={`sc-grid ${geom.ys.minor.includes(t) ? 'minor' : ''}`} />
                <text x={P.l - 7} y={geom.ys.to(t) + 4} textAnchor="end" className="sc-tick">{fmtTick(t, false)}</text>
              </g>
            ))}
            {geom.xs.ticks.map((t) => (
              <g key={`x${t}`}>
                <line x1={geom.xs.to(t)} x2={geom.xs.to(t)} y1={P.t} y2={h - P.b} className={`sc-grid ${geom.xs.minor.includes(t) ? 'minor' : ''}`} />
                <text x={geom.xs.to(t)} y={h - P.b + 16} textAnchor="middle" className="sc-tick">{fmtTick(t, true)}</text>
              </g>
            ))}
            <line x1={P.l} x2={w - P.r} y1={h - P.b} y2={h - P.b} className="sc-axis" />
            <line x1={P.l} x2={P.l} y1={P.t} y2={h - P.b} className="sc-axis" />
            <text x={(P.l + w - P.r) / 2} y={h - 8} textAnchor="middle" className="sc-title">Density ρ (t/mm³)　← 較輕</text>
            <text transform={`translate(13 ${(P.t + h - P.b) / 2}) rotate(-90)`} textAnchor="middle" className="sc-title">Young's Modulus E (MPa)　較剛 →</text>
            {act && (
              <g className="sc-cross">
                <line x1={P.l} x2={act.cx} y1={act.cy} y2={act.cy} />
                <line x1={act.cx} x2={act.cx} y1={act.cy} y2={h - P.b} />
              </g>
            )}
            {geom.pts.map(({ m, cx, cy }) => {
              const lab = geom.labels.get(m.id);
              const dim = dimmed?.has(m.id);
              const on = m.id === activeId;
              return (
                <g
                  key={m.id}
                  className={`sc-pt ${on ? 'on' : ''} ${dim ? 'dim' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${m.name}：Density ${m.density}、Young's Modulus ${m.youngsModulus}`}
                  onMouseEnter={() => (setHover(m.id), onHover?.(m.id))}
                  onMouseLeave={() => (setHover(null), onHover?.(null))}
                  onFocus={() => (setHover(m.id), onHover?.(m.id))}
                  onBlur={() => (setHover(null), onHover?.(null))}
                  onClick={() => onPick?.(m)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick?.(m))}
                  data-name={m.name}
                >
                  {lab?.leader && <line x1={lab.leader.x1} y1={lab.leader.y1} x2={lab.leader.x2} y2={lab.leader.y2} className="sc-leader" />}
                  {(on || ringed?.has(m.id)) && <circle cx={cx} cy={cy} r={on ? 11 : 10} className={on ? 'sc-ring' : 'sc-ring sel'} />}
                  <circle cx={cx} cy={cy} r={6} fill={CATEGORY_COLOR[m.category]} className="sc-dot" />
                  {lab && !dim && <text x={lab.x} y={lab.y} textAnchor={lab.anchor} className="sc-label" style={{ fontSize }}>{m.name}</text>}
                </g>
              );
            })}
          </svg>
          {act && (
            <div className="sc-tip" style={{ left: Math.min(act.cx + 14, w - 220), top: Math.min(act.cy + 12, h - 90) }}>
              <b>{act.m.name}</b>
              <span>{CATEGORY_LABEL[act.m.category]}</span>
              <div>Density <i>{act.m.density!.toExponential(2).replace('e-', 'E-')}</i> t/mm³</div>
              <div>Young's Modulus <i>{act.m.youngsModulus!.toLocaleString('en-US')}</i> MPa</div>
            </div>
          )}
          {legend && (
            <ul className="sc-legend">
              {used.map((c) => (
                <li key={c}><i style={{ background: CATEGORY_COLOR[c] }} /> {CATEGORY_LABEL[c]}</li>
              ))}
            </ul>
          )}
          {skipped > 0 && <p className="sc-skip">{skipped} 筆缺少 Density 或 Young's Modulus，未顯示</p>}
        </>
      ) : (
        <div className="cx-empty">沒有可繪製的材料（需同時具備 Density 與 Young's Modulus）。</div>
      )}
    </div>
  );
}
