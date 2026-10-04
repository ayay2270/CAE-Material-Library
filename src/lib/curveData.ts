import type { StressStrainData } from '../types';

export type StrainUnit = 'mm/mm' | '%';
export type StressUnit = 'MPa' | 'GPa';
export const CURVE_DEFINITIONS = {
  unspecified: '未註明',
  engineering: 'Engineering stress / strain',
  true: 'True stress / strain',
};
export const STRAIN_KINDS = {
  total: 'Total strain',
  plastic: 'Plastic strain',
  unspecified: '未註明',
};

/** No sorting, interpolation, smoothing, or engineering/true conversion. */
export function parseCurvePoints(
  text: string,
  strainUnit: StrainUnit,
  stressUnit: StressUnit,
) {
  const points: StressStrainData['points'] = [];
  const errors: string[] = [];
  let strainColumn = 0;
  let stressColumn = 1;
  let firstRow = true;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const separator = line.includes(',')
      ? /,/
      : line.includes(';')
        ? /;/
        : line.includes('\t')
          ? /\t/
          : /\s+/;
    const fields = line
      .trim()
      .split(separator)
      .map((field) => field.trim().replace(/^"(.*)"$/, '$1'));
    if (
      firstRow &&
      fields.some((field) => /strain|stress|應變|應力/i.test(field))
    ) {
      firstRow = false;
      strainColumn = fields.findIndex((field) => /strain|應變/i.test(field));
      stressColumn = fields.findIndex((field) => /stress|應力/i.test(field));
      if (
        fields.length !== 2 ||
        strainColumn < 0 ||
        stressColumn < 0 ||
        strainColumn === stressColumn
      ) {
        errors.push(`第 ${index + 1} 行：表頭必須包含 Strain 和 Stress 兩欄。`);
        return;
      }
      const strainHeader = fields[strainColumn];
      const stressHeader = fields[stressColumn];
      if (strainHeader.includes('%') && strainUnit !== '%')
        errors.push('CSV 表頭的 Strain 單位為 %，請選擇 %。');
      if (/mm\s*\/\s*mm/i.test(strainHeader) && strainUnit !== 'mm/mm')
        errors.push('CSV 表頭的 Strain 單位為 mm/mm，請選擇 mm/mm。');
      if (/GPa/i.test(stressHeader) && stressUnit !== 'GPa')
        errors.push('CSV 表頭的 Stress 單位為 GPa，請選擇 GPa。');
      if (/MPa/i.test(stressHeader) && stressUnit !== 'MPa')
        errors.push('CSV 表頭的 Stress 單位為 MPa，請選擇 MPa。');
      return;
    }
    firstRow = false;
    if (
      fields.length !== 2 ||
      fields.some(
        (field) => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(field),
      )
    ) {
      errors.push(`第 ${index + 1} 行：需有兩個有效數值（Strain, Stress）。`);
      return;
    }
    const strain =
      Number(fields[strainColumn]) / (strainUnit === '%' ? 100 : 1);
    const stress =
      Number(fields[stressColumn]) * (stressUnit === 'GPa' ? 1000 : 1);
    if (!Number.isFinite(strain) || !Number.isFinite(stress))
      errors.push(`第 ${index + 1} 行：數值超出可儲存範圍。`);
    else points.push({ strain, stress });
  });
  if (points.length < 2) errors.push('至少需要 2 個資料點。');
  // Reject the entire input on errors; never silently discard malformed rows.
  return { points, errors };
}

export function isStressStrainData(value: unknown): value is StressStrainData {
  if (!value || typeof value !== 'object') return false;
  const data = value as StressStrainData;
  return (
    ['engineering', 'true', 'unspecified'].includes(data.definition) &&
    ['total', 'plastic', 'unspecified'].includes(data.strainKind) &&
    typeof data.source === 'string' &&
    typeof data.notes === 'string' &&
    Array.isArray(data.points) &&
    data.points.length >= 2 &&
    data.points.every(
      (point) =>
        point &&
        typeof point.strain === 'number' &&
        Number.isFinite(point.strain) &&
        typeof point.stress === 'number' &&
        Number.isFinite(point.stress),
    )
  );
}

export function curveToCsv(data: StressStrainData): string {
  return (
    '\uFEFFStrain (mm/mm),Stress (MPa)\r\n' +
    data.points.map((point) => `${point.strain},${point.stress}`).join('\r\n') +
    '\r\n'
  );
}

export function downloadCurve(data: StressStrainData, name: string) {
  const url = URL.createObjectURL(
    new Blob([curveToCsv(data)], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[<>:"/\\|?*]/g, '_')}-stress-strain.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
