import type { HardeningInputs } from '../lib/etan';
import { solverPlasticityParameters } from '../lib/solverPlasticity';
import { formatValue } from '../lib/format';
import { AutoCalculationDetails } from './EtanCalculationDetails';
import './EtanPanel.css';

interface Props {
  inputs: HardeningInputs;
  density?: number | null;
  poissonRatio?: number | null;
}

const finite = (number: number | null | undefined) => number != null && Number.isFinite(number);
const MISSING_INPUTS = "Enter valid material values: Young's Modulus, Yield Stress, Ultimate Stress and Elongation.";

/** ETAN calculation page: H is always calculated from the inputs, ETAN from E and H. */
export function SolverPlasticityResults({ inputs, density, poissonRatio }: Props) {
  const parameters = solverPlasticityParameters(inputs);
  const { hardeningSlopeH, tangentModulusEtan } = parameters;
  const summary = [
    { symbol: 'RO', label: 'Density', value: finite(density) ? formatValue('density', density!) : '—', unit: 't/mm³' },
    { symbol: 'E', label: "Young's Modulus", value: finite(inputs.youngsModulus) ? String(inputs.youngsModulus) : '—', unit: 'MPa' },
    { symbol: 'PR', label: "Poisson's Ratio", value: finite(poissonRatio) ? String(poissonRatio) : '—', unit: '—' },
    { symbol: 'SIGY', label: 'Yield Stress', value: finite(inputs.yieldStress) ? String(inputs.yieldStress) : '—', unit: 'MPa' },
    { symbol: 'ETAN', label: 'Tangent Modulus', value: tangentModulusEtan?.toFixed(2) ?? '—', unit: 'MPa' },
  ];

  return (
    <section className="etan-auto solver-plasticity" aria-label="Solver Plasticity Parameters">
      <h3>Solver Plasticity Parameters</h3>
      <div className="solver-results" role="status" aria-live="polite" aria-atomic="true">
        <section className="solver-result" aria-label="OptiStruct MATS1 result">
          <h4>OptiStruct · MATS1</h4>
          <div className="solver-parameter"><b>H</b><span>Work Hardening Slope</span></div>
          <strong className="solver-result-value" data-testid="hardening-h-result">{hardeningSlopeH == null ? 'H unavailable' : `${hardeningSlopeH.toFixed(2)} MPa`}</strong>
          <p>Plasticity modulus / work hardening slope used by OptiStruct MATS1.</p>
          <span className="solver-source">Calculated from Young&apos;s Modulus, Yield Stress, Ultimate Stress and Elongation.</span>
        </section>
        <div className="solver-conversion">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v12M3.5 9.5 8 14l4.5-4.5" /></svg>
          <span>H → ETAN conversion</span>
          <span className="solver-conversion-formula">ETAN = E × H / (E + H)</span>
        </div>
        <section className="solver-result solver-result-lsdyna" aria-label="LS-DYNA MAT_003 result">
          <h4>LS-DYNA · MAT_003</h4>
          <div className="solver-parameter"><b>ETAN</b><span>Tangent Modulus</span></div>
          <strong className="solver-result-value" data-testid="tangent-etan-result">{tangentModulusEtan == null ? 'ETAN unavailable' : `${tangentModulusEtan.toFixed(2)} MPa`}</strong>
          <p>Tangent modulus used by LS-DYNA *MAT_003.</p>
        </section>
      </div>
      {hardeningSlopeH == null && <p className="etan-auto-note">{MISSING_INPUTS}</p>}
      {hardeningSlopeH != null && tangentModulusEtan == null && <p className="etan-auto-note">ETAN unavailable. Conversion requires finite E &gt; 0 and H ≥ 0, in MPa.</p>}
      <h4 className="solver-summary-title">LS-DYNA MAT_003 summary</h4>
      <table className="etan-auto-inputs solver-summary" aria-label="LS-DYNA MAT_003 parameters">
        <tbody>{summary.map(({ symbol, label, value, unit }) => (
          <tr key={symbol}><th scope="row"><b>{symbol}</b><span>{label}</span></th><td data-testid={`mat003-${symbol.toLowerCase()}`}>{value}</td><td>{unit}</td></tr>
        ))}</tbody>
      </table>
      <AutoCalculationDetails inputs={inputs} parameters={parameters} hIssue={hardeningSlopeH == null ? MISSING_INPUTS : null} />
    </section>
  );
}
