import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Category, Material } from '../types';
import { CATEGORIES } from '../types';
import { ArrowLeftIcon, InfoIcon, ResetIcon } from './icons';

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

function niceStep(range: number, target: number) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * mag;
}

function linearScale(max: number, a: number, b: number): Scale & { hi: number } {
  const step = niceStep(max, 7);
  const hi = Math.ceil((max * 1.04) / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= hi + step / 1e6; v += step) ticks.push(Number(v.toPrecision(10)));
  return { hi, ticks, minor: [], to: (v) => a + (v / hi) * (b - a) };
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
  if (sci) return v === 0 ? '0' : v.toExponential(0).replace('e-', 'E-').replace('e+', 'E');
  return v.toLocaleString('en-US');
}

interface Pt {
  m: Material;
  cx: number;
  cy: number;
}

/** Greedy label placement: try right, left, above, below; keep the first spot that doesn't collide. */
function placeLabels(pts: Pt[], bounds: { l: number; r: number; t: number; b: number }) {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const dots = pts.map((p) => ({ x: p.cx - 7, y: p.cy - 7, w: 14, h: 14 }));
  const hit = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const out = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' }>();
  [...pts]
    .sort((a, b) => a.cy - b.cy)
    .forEach((p) => {
      const w = p.m.name.length * 6.6 + 4;
      const h = 14;
      const cands = [
        { x: p.cx + 10, y: p.cy - h / 2, anchor: 'start' as const, bx: p.cx + 10 },
        { x: p.cx - 10, y: p.cy - h / 2, anchor: 'end' as const, bx: p.cx - 10 - w },
        { x: p.cx, y: p.cy - 10 - h, anchor: 'middle' as const, bx: p.cx - w / 2 },
        { x: p.cx, y: p.cy + 10, anchor: 'middle' as const, bx: p.cx - w / 2 },
      ];
      const pick =
        cands.find((c) => {
          const box = { x: c.bx, y: c.y, w, h };
          return (
            box.x >= bounds.l && box.x + w <= bounds.r && box.y >= bounds.t && box.y + h <= bounds.b &&
            !placed.some((q) => hit(box, q)) &&
            !dots.some((d) => hit(box, d))
          );
        }) ?? cands[0];
      placed.push({ x: pick.bx, y: pick.y, w, h });
      out.set(p.m.id, { x: pick.x, y: pick.y + h - 3, anchor: pick.anchor });
    });
  return out;
}

export function MaterialMap({ materials, onBack, onInfo, onOpen }: Props) {
  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 560 });
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(480, el.clientWidth), h: Math.max(380, el.clientHeight) }));
    ro.observe(el);
    setSize({ w: Math.max(480, el.clientWidth), h: Math.max(380, el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  // Only materials with BOTH ρ and E can be plotted; missing values are never treated as zero.
  const plottable = useMemo(() => materials.filter((m) => m.density !== null && m.youngsModulus !== null), [materials]);
  const skipped = materials.filter((m) => m.density === null || m.youngsModulus === null);

  const { w, h } = size;
  const pad = { l: 78, r: 28, t: 24, b: 58 };

  const geom = useMemo(() => {
    if (plottable.length === 0) return null;
    const dens = plottable.map((m) => m.density as number);
    const mods = plottable.map((m) => m.youngsModulus as number);
    const xs = logX
      ? logScale(Math.min(...dens), Math.max(...dens), pad.l, w - pad.r)
      : linearScale(Math.max(...dens), pad.l, w - pad.r);
    const ys = logY
      ? logScale(Math.min(...mods), Math.max(...mods), h - pad.b, pad.t)
      : linearScale(Math.max(...mods), h - pad.b, pad.t);
    const pts: Pt[] = plottable.map((m) => ({ m, cx: xs.to(m.density as number), cy: ys.to(m.youngsModulus as number) }));
    const labels = placeLabels(pts, { l: pad.l, r: w - pad.r, t: pad.t, b: h - pad.b });
    return { xs, ys, pts, labels };
  }, [plottable, logX, logY, w, h]);

  const activeId = hoverId ?? pinnedId;
  const active = plottable.find((m) => m.id === activeId) ?? null;
  const activePt = geom?.pts.find((p) => p.m.id === activeId) ?? null;

  useEffect(() => {
    if (pinnedId && !plottable.some((m) => m.id === pinnedId)) setPinnedId(null);
  }, [plottable, pinnedId]);

  const reset = () => {
    setLogX(false);
    setLogY(true);
    setShowLabels(true);
    setHoverId(null);
    setPinnedId(null);
  };

  const used = CATEGORIES.filter((c) => plottable.some((m) => m.category === c));

  return (
    <main className="page map-page">
      <div className="page-head">
        <button className="back-link" onClick={onBack}>
          <ArrowLeftIcon /> Back to materials
        </button>
        <h1>Material Map</h1>
        <span className="map-subtitle">
          Lightweight vs. Stiffness (ρ–E)
          <button className="info-btn" onClick={onInfo} aria-label="How to read this chart" title="How to read this chart">
            <InfoIcon size={15} />
          </button>
        </span>
      </div>

      <div className="map-layout">
        <div className="map-chart" ref={wrapRef}>
          {geom ? (
            <svg width={w} height={h} role="img" aria-label="Scatter plot of Density versus Young's Modulus" data-testid="map-svg">
              {/* "light + stiff" corner hint */}
              <rect x={pad.l} y={pad.t} width={Math.min(190, (w - pad.l - pad.r) * 0.3)} height={46} className="ideal-zone" />
              <text x={pad.l + 10} y={pad.t + 19} className="ideal-text">Lighter + stiffer</text>
              <text x={pad.l + 10} y={pad.t + 35} className="ideal-sub">upper-left region</text>

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
                ρ Density (t/mm³)  ←  lighter
              </text>
              <text transform={`translate(18 ${(pad.t + h - pad.b) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
                E Young's Modulus (MPa)  →  stiffer
              </text>

              {activePt && (
                <g className="crosshair">
                  <line x1={pad.l} x2={activePt.cx} y1={activePt.cy} y2={activePt.cy} />
                  <line x1={activePt.cx} x2={activePt.cx} y1={activePt.cy} y2={h - pad.b} />
                </g>
              )}

              {geom.pts.map(({ m, cx, cy }) => {
                const lab = geom.labels.get(m.id);
                const isActive = m.id === activeId;
                return (
                  <g
                    key={m.id}
                    className={`map-pt ${isActive ? 'active' : ''}`}
                    onMouseEnter={() => setHoverId(m.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => setPinnedId(pinnedId === m.id ? null : m.id)}
                    data-name={m.name}
                  >
                    {isActive && <circle cx={cx} cy={cy} r={11} className="pt-ring" />}
                    <circle cx={cx} cy={cy} r={6.5} fill={CATEGORY_COLOR[m.category]} className="pt-dot" />
                    {(showLabels || isActive) && lab && (
                      <text x={lab.x} y={lab.y} textAnchor={lab.anchor} className="pt-text">{m.name}</text>
                    )}
                  </g>
                );
              })}

              {active && activePt && (
                <foreignObject
                  x={Math.min(activePt.cx + 16, w - 200)}
                  y={Math.max(pad.t, Math.min(activePt.cy + 14, h - pad.b - 92))}
                  width="184"
                  height="86"
                  pointerEvents="none"
                >
                  <div className="map-tip">
                    <b>{active.name}</b>
                    <span>{active.category}</span>
                    <div>ρ <i>{active.density!.toExponential(2).replace('e-', 'E-')}</i> t/mm³</div>
                    <div>E <i>{active.youngsModulus!.toLocaleString('en-US')}</i> MPa</div>
                  </div>
                </foreignObject>
              )}
            </svg>
          ) : (
            <div className="empty-state">No material has both Density and Young's Modulus recorded, so nothing can be plotted.</div>
          )}
        </div>

        <aside className="map-panel">
          <h3>Axes</h3>
          <dl className="axes">
            <dt>X axis</dt>
            <dd>
              <span>Density ρ (t/mm³)</span>
              <button className={`toggle ${logX ? 'on' : ''}`} aria-pressed={logX} onClick={() => setLogX(!logX)}>LOG</button>
            </dd>
            <dt>Y axis</dt>
            <dd>
              <span>Young's Modulus E (MPa)</span>
              <button className={`toggle ${logY ? 'on' : ''}`} aria-pressed={logY} onClick={() => setLogY(!logY)}>LOG</button>
            </dd>
          </dl>
          <label className="check">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Show labels
          </label>
          <button className="btn full" onClick={reset}>
            <ResetIcon /> Reset View
          </button>

          <h3>Category</h3>
          <ul className="legend">
            {used.map((c) => (
              <li key={c}>
                <i style={{ background: CATEGORY_COLOR[c] }} /> {c}
              </li>
            ))}
          </ul>

          <h3>Selected</h3>
          {active ? (
            <div className="sel-card">
              <b>{active.name}</b>
              <div>ρ = {active.density!.toExponential(2).replace('e-', 'E-')} t/mm³</div>
              <div>E = {active.youngsModulus!.toLocaleString('en-US')} MPa</div>
              <button className="link-btn" onClick={() => onOpen(active)}>Open details →</button>
            </div>
          ) : (
            <p className="muted small">Hover or click a point to see its values.</p>
          )}

          {skipped.length > 0 && (
            <p className="skipped" data-testid="map-skipped">
              Not plotted (ρ or E missing): {skipped.map((m) => m.name).join(', ')}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
