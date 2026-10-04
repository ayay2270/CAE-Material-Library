import { useState } from 'react';
import type { StressStrainData } from '../types';
import type { StressUnit, StrainUnit } from '../lib/curveData';

export function FullStressStrainPlot({
  data,
  name,
  stressUnit,
  strainUnit,
}: {
  data: StressStrainData;
  name: string;
  stressUnit: StressUnit;
  strainUnit: StrainUnit;
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 480,
    H = 270;
  const pad = { l: 67, r: 18, t: 18, b: 46 };
  let eMin = 0,
    eMax = 0,
    sMin = 0,
    sMax = 0;
  for (const p of data.points) {
    eMin = Math.min(eMin, p.strain);
    eMax = Math.max(eMax, p.strain);
    sMin = Math.min(sMin, p.stress);
    sMax = Math.max(sMax, p.stress);
  }
  const eSpan = eMax - eMin || 1,
    sSpan = sMax - sMin || 1;
  eMax += eSpan * 0.04;
  if (eMin < 0) eMin -= eSpan * 0.04;
  sMax += sSpan * 0.07;
  if (sMin < 0) sMin -= sSpan * 0.07;
  const x = (e: number) =>
    pad.l + ((e - eMin) / (eMax - eMin)) * (W - pad.l - pad.r);
  const y = (s: number) =>
    H - pad.b - ((s - sMin) / (sMax - sMin)) * (H - pad.t - pad.b);
  const eDisplay = (e: number) => e * (strainUnit === '%' ? 100 : 1);
  const sDisplay = (s: number) => s / (stressUnit === 'GPa' ? 1000 : 1);
  const label = (n: number) =>
    Number(n.toPrecision(4)).toLocaleString('en-US', {
      maximumSignificantDigits: 4,
    });
  const path = data.points
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${x(p.strain).toFixed(3)},${y(p.stress).toFixed(3)}`,
    )
    .join(' ');
  const point = active === null ? null : data.points[active];
  return (
    <figure className="curve full-curve">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${name} 的完整應力–應變曲線，${data.points.length} 個資料點`}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * W;
          const py = ((event.clientY - rect.top) / rect.height) * H;
          let nearest = 0,
            distance = Infinity;
          data.points.forEach((p, i) => {
            const d = (x(p.strain) - px) ** 2 + (y(p.stress) - py) ** 2;
            if (d < distance) {
              distance = d;
              nearest = i;
            }
          });
          setActive(nearest);
        }}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const e = eMin + ((eMax - eMin) * i) / 4,
            s = sMin + ((sMax - sMin) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y(s)}
                y2={y(s)}
                className="grid"
              />
              <text
                x={pad.l - 8}
                y={y(s) + 3}
                textAnchor="end"
                className="tick"
              >
                {label(sDisplay(s))}
              </text>
              <text
                x={x(e)}
                y={H - pad.b + 18}
                textAnchor="middle"
                className="tick"
              >
                {label(eDisplay(e))}
              </text>
            </g>
          );
        })}
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={H - pad.b}
          y2={H - pad.b}
          className="axis"
        />
        <line
          x1={pad.l}
          x2={pad.l}
          y1={pad.t}
          y2={H - pad.b}
          className="axis"
        />
        <path
          d={path}
          className="curve-line"
          data-point-count={data.points.length}
        />
        {point && (
          <circle
            cx={x(point.strain)}
            cy={y(point.stress)}
            r="4"
            className="pt-y"
          />
        )}
        <text
          x={(pad.l + W - pad.r) / 2}
          y={H - 7}
          textAnchor="middle"
          className="axis-title"
        >
          Strain ({strainUnit})
        </text>
        <text
          transform={`translate(15 ${(pad.t + H - pad.b) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-title"
        >
          Stress ({stressUnit})
        </text>
      </svg>
      <figcaption>
        {data.points.length.toLocaleString()} 個完整資料點 ·
        依原始順序連線，未平滑或抽樣。
        <br />
        {point
          ? `Point ${active! + 1}: Strain ${eDisplay(point.strain)} ${strainUnit} · Stress ${sDisplay(point.stress)} ${stressUnit}`
          : '移動游標查看資料點；完整數值可由 CSV 匯出。'}
      </figcaption>
    </figure>
  );
}
