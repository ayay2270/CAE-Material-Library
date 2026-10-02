import type { Material } from '../types';

/**
 * Idealised bilinear curve derived from the stored properties:
 * linear elastic (slope E) up to σy, then slope ETAN up to σu (or to ε if σu is missing).
 * It is a visual aid only, not measured test data.
 */
export function curvePoints(m: Material): { e: number; s: number }[] | null {
  const { youngsModulus: E, yieldStress: sy, etan, ultimateStress: su, elongation } = m;
  if (E === null || sy === null || etan === null || E <= 0 || etan <= 0) return null;
  const ey = sy / E;
  let eEnd: number;
  let sEnd: number;
  if (su !== null && su > sy) {
    eEnd = ey + (su - sy) / etan;
    sEnd = su;
  } else if (elongation !== null && elongation / 100 > ey) {
    eEnd = elongation / 100;
    sEnd = sy + etan * (eEnd - ey);
  } else return null;
  return [
    { e: 0, s: 0 },
    { e: ey, s: sy },
    { e: eEnd, s: sEnd },
  ];
}

export function StressStrainCurve({ m }: { m: Material }) {
  const pts = curvePoints(m);
  if (!pts) {
    return (
      <div className="curve-empty">
        Curve not available — needs E, σy, ETAN and either σu or elongation.
      </div>
    );
  }
  const W = 440;
  const H = 190;
  const pad = { l: 46, r: 14, t: 12, b: 32 };
  const eMax = pts[2].e * 1.05;
  const sMax = pts[2].s * 1.12;
  const x = (e: number) => pad.l + (e / eMax) * (W - pad.l - pad.r);
  const y = (s: number) => H - pad.b - (s / sMax) * (H - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.e).toFixed(1)},${y(p.s).toFixed(1)}`).join(' ');
  const yTicks = niceTicks(sMax, 4);
  const xTicks = niceTicks(eMax, 4);

  return (
    <figure className="curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Idealised stress–strain curve for ${m.name}`}>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="tick">
              {t.toLocaleString('en-US')}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - pad.b + 14} textAnchor="middle" className="tick">
            {t}
          </text>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="axis" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} className="axis" />
        <path d={path} className="curve-line" />
        <circle cx={x(pts[1].e)} cy={y(pts[1].s)} r="3.5" className="pt-y" />
        <circle cx={x(pts[2].e)} cy={y(pts[2].s)} r="3.5" className="pt-u" />
        <text x={x(pts[1].e) + 7} y={y(pts[1].s) + 12} className="pt-label">σy {pts[1].s}</text>
        <text x={x(pts[2].e) - 6} y={y(pts[2].s) - 7} textAnchor="end" className="pt-label">
          {m.ultimateStress !== null ? `σu ${pts[2].s}` : `σ ${Math.round(pts[2].s)}`}
        </text>
        <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="axis-title">Strain (mm/mm)</text>
        <text transform={`translate(11 ${(pad.t + H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">Stress (MPa)</text>
      </svg>
      <figcaption>Idealised bilinear curve built from E, σy, ETAN and σu — a visual aid, not measured test data.</figcaption>
    </figure>
  );
}

function niceTicks(max: number, count: number): number[] {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = step; v <= max + 1e-12; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}
