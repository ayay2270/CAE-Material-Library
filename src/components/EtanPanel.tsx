import type { Material } from '../types';
import { solverPlasticityParameters } from '../lib/solverPlasticity';
import { formatValue } from '../lib/format';
import { AutoCalculationDetails } from './EtanCalculationDetails';
import './EtanPanel.css';

// Inputs of the existing bilinear H calculation (src/lib/etan.ts).
const H_INPUTS = [
  ['youngsModulus', "Young's Modulus"],
  ['yieldStress', 'Yield Stress'],
  ['ultimateStress', 'Ultimate Stress'],
  ['elongation', 'Elongation'],
] as const;

// Equivalent fields, in solver units (MPa, t/mm³) regardless of display preferences.
const MAPPING = [
  { optistruct: 'E', lsdyna: 'E', key: 'youngsModulus', unit: 'MPa' },
  { optistruct: 'NU', lsdyna: 'PR', key: 'poissonRatio', unit: '' },
  { optistruct: 'RHO', lsdyna: 'RO', key: 'density', unit: 't/mm³' },
  { optistruct: 'LIMIT1', lsdyna: 'SIGY', key: 'yieldStress', unit: 'MPa' },
] as const;

/** Why H could not be calculated: missing inputs first, otherwise the failed consistency check. */
function hardeningIssue(material: Material): string {
  const missing = H_INPUTS.filter(([key]) => material[key] == null).map(([, label]) => label);
  if (missing.length) return `Missing: ${missing.join(', ')}`;
  if (material.ultimateStress! < material.yieldStress!) return 'Invalid: Ultimate Stress is below Yield Stress';
  return 'Invalid: inputs must be positive, with Elongation beyond the yield strain';
}

function Result({ solver, card, symbol, description, value, issue, testId }: {
  solver: string; card: string; symbol: string; description: string; value: number | null; issue: { text: string; warn: boolean } | null; testId: string;
}) {
  return (
    <section className="solver-bridge-result" aria-label={`${solver} ${card.replace(/[*+ ]+/g, ' ').trim()} result`}>
      <h4>{solver} <span>{card}</span></h4>
      <b className="solver-bridge-symbol">{symbol}<span>{description}</span></b>
      <strong className={`solver-bridge-value${value == null ? ' unavailable' : ''}`} data-testid={testId}>
        {value == null ? 'Not available' : <>{value.toFixed(2)}<small> MPa</small></>}
      </strong>
      {value != null && <span className="solver-bridge-status">Calculated</span>}
      {issue && <span className={`solver-bridge-issue${issue.warn ? ' warn' : ''}`}>{issue.warn && <span aria-hidden="true">⚠ </span>}{issue.text}</span>}
    </section>
  );
}

export function EtanPanel({ material }: { material: Material }) {
  // H is always calculated from the material properties; the legacy stored `etan` field is not used here.
  const parameters = solverPlasticityParameters(material);
  const { hardeningSlopeH, tangentModulusEtan } = parameters;
  const hIssue = hardeningSlopeH == null ? hardeningIssue(material) : null;
  const etanIssue = tangentModulusEtan != null ? null : hardeningSlopeH == null ? 'Requires H' : "Requires a valid Young's Modulus";

  return (
    <section className="solver-bridge" aria-label="Solver Plasticity">
      <header className="solver-bridge-title">
        <h3>Solver Plasticity</h3>
        <span>Calculated from material properties</span>
      </header>
      <div className="solver-bridge-card">
        <div className="solver-bridge-hero" role="status" aria-live="polite" aria-atomic="true">
          <Result solver="OptiStruct" card="MAT1 + MATS1" symbol="H" description="Work hardening slope" value={hardeningSlopeH}
            issue={hIssue ? { text: hIssue, warn: true } : null} testId="hardening-h-result" />
          <Result solver="LS-DYNA" card="*MAT_003" symbol="ETAN" description="Tangent modulus" value={tangentModulusEtan}
            issue={etanIssue ? { text: etanIssue, warn: false } : null} testId="tangent-etan-result" />
        </div>
        <p className={`solver-bridge-formula${tangentModulusEtan == null ? ' unavailable' : ''}`}>ETAN = E × H / (E + H)</p>
        <table className="solver-bridge-map" aria-label="Equivalent OptiStruct and LS-DYNA parameters">
          <colgroup><col className="kw" /><col /><col className="unit" /><col className="gap" /><col className="kw" /><col /><col className="unit" /></colgroup>
          <thead><tr><th>OptiStruct</th><th>Value</th><th>Unit</th><td /><th>LS-DYNA</th><th>Value</th><th>Unit</th></tr></thead>
          <tbody>
            {MAPPING.map(({ optistruct, lsdyna, key, unit }) => {
              const value = material[key];
              const text = formatValue(key, value);
              const shownUnit = value == null ? '' : unit;
              return (
                <tr key={key} className={value == null ? 'missing' : ''}>
                  <th scope="row">{optistruct}</th><td className="value">{text}</td><td className="unit">{shownUnit}</td>
                  <td aria-hidden="true" />
                  <th scope="row">{lsdyna}</th><td className="value" data-testid={`mat003-${lsdyna.toLowerCase()}`}>{text}</td><td className="unit">{shownUnit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AutoCalculationDetails inputs={material} parameters={parameters} hIssue={hIssue} />
    </section>
  );
}
