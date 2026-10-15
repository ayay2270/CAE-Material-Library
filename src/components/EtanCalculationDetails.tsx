import type { ReactNode } from 'react';
import type { HardeningInputs } from '../lib/etan';
import type { solverPlasticityParameters } from '../lib/solverPlasticity';
import './EtanPanel.css';

function Variable({ symbol, point, kind }: { symbol: string; point?: string; kind?: string }) {
  return <span className="etan-variable"><i>{symbol}</i>{point && <sub><i>{point}</i>{kind && <><span>, </span><span>{kind}</span></>}</sub>}</span>;
}

function Fraction({ numerator, denominator }: { numerator: ReactNode; denominator: ReactNode }) {
  return <span className="etan-fraction"><span>{numerator}</span><span>{denominator}</span></span>;
}

function Strain({ point, kind }: { point: string; kind: string }) {
  return <Variable symbol="ε" point={point} kind={kind} />;
}
function Stress({ point, kind }: { point: string; kind?: string }) {
  return <Variable symbol="σ" point={point} kind={kind} />;
}

function TrueStress({ point }: { point: string }) {
  return <><Stress point={point} kind="true" /> = <Stress point={point} /> (1 + <Strain point={point} kind="eng" />)</>;
}
function TrueStrain({ point }: { point: string }) {
  return <><Strain point={point} kind="true" /> = <span className="etan-math-function">ln</span>(1 + <Strain point={point} kind="eng" />)</>;
}
function HardeningEstimateFormula() {
  return <>H = <Fraction numerator={<><Stress point="u" kind="true" /> − <Stress point="y" kind="true" /></>} denominator={<><Strain point="u" kind="true" /> − <Strain point="y" kind="true" /></>} /></>;
}

type HardeningDetails = NonNullable<ReturnType<typeof solverPlasticityParameters>['calculatedHDetails']>;

/** Substituted bilinear H steps (engineering → true stress/strain → slope). */
function HardeningSteps({ inputs, result, title }: { inputs: HardeningInputs; result: HardeningDetails; title: string }) {
  return (
    <ol className="etan-auto-steps">
      <li>
        <h5>Engineering strains</h5>
        <div className="etan-equation"><Strain point="y" kind="eng" /> = <Fraction numerator={<Stress point="y" />} denominator={<Variable symbol="E" />} /> = <Fraction numerator={inputs.yieldStress} denominator={inputs.youngsModulus} /></div>
        <p className="etan-step-value">= {result.eyEng.toFixed(6)}</p>
        <div className="etan-equation"><Strain point="u" kind="eng" /> = <Fraction numerator="Elongation" denominator="100" /> = <Fraction numerator={inputs.elongation} denominator="100" /></div>
        <p className="etan-step-value">= {result.euEng.toFixed(6)}</p>
      </li>
      <li>
        <h5>True stresses</h5>
        <div className="etan-equation"><TrueStress point="y" /></div>
        <p className="etan-step-value">= {inputs.yieldStress} × (1 + {result.eyEng})</p>
        <p className="etan-step-value">= {result.syTrue.toFixed(3)} MPa</p>
        <div className="etan-equation"><TrueStress point="u" /></div>
        <p className="etan-step-value">= {inputs.ultimateStress} × (1 + {result.euEng})</p>
        <p className="etan-step-value">= {result.suTrue.toFixed(3)} MPa</p>
      </li>
      <li>
        <h5>True strains</h5>
        <div className="etan-equation"><TrueStrain point="y" /></div>
        <p className="etan-step-value">= ln(1 + {result.eyEng})</p>
        <p className="etan-step-value">≈ {result.eyTrue.toFixed(6)}</p>
        <div className="etan-equation"><TrueStrain point="u" /></div>
        <p className="etan-step-value">= ln(1 + {result.euEng})</p>
        <p className="etan-step-value">≈ {result.euTrue.toFixed(6)}</p>
      </li>
      <li>
        <h5>{title}</h5>
        <div className="etan-equation"><HardeningEstimateFormula /></div>
        <div className="etan-equation">H = <Fraction numerator={`${result.suTrue} − ${result.syTrue}`} denominator={`${result.euTrue} − ${result.eyTrue}`} /></div>
        <p className="etan-step-value">Calculated H = {result.hardeningSlopeH.toFixed(2)} MPa</p>
      </li>
    </ol>
  );
}

function EtanConversion({ youngsModulus, hardeningSlopeH, tangentModulusEtan }: { youngsModulus: number | null; hardeningSlopeH: number | null; tangentModulusEtan: number | null }) {
  return <>
    <div className="etan-equation">ETAN = <Fraction numerator="E × H" denominator="E + H" /></div>
    {tangentModulusEtan != null && hardeningSlopeH != null && youngsModulus != null ? <>
      <p className="etan-step-value">E = {youngsModulus} MPa; H = {Number(hardeningSlopeH.toFixed(6))} MPa</p>
      <div className="etan-equation">ETAN = <Fraction numerator={`${youngsModulus} × ${Number(hardeningSlopeH.toFixed(6))}`} denominator={`${youngsModulus} + ${Number(hardeningSlopeH.toFixed(6))}`} /></div>
      <p className="etan-step-value">ETAN = {tangentModulusEtan.toFixed(2)} MPa</p>
    </> : <p>ETAN unavailable. Conversion requires finite E &gt; 0 and H ≥ 0.</p>}
  </>;
}

function FormulaReference() {
  return (
    <div className="etan-auto-reference">
      <b>Formula Reference</b>
      <div className="etan-formula-list">
        <div><h5>OptiStruct → LS-DYNA</h5><div className="etan-equation">ETAN = <Fraction numerator="E × H" denominator="E + H" /></div></div>
        <div><h5>LS-DYNA → OptiStruct</h5><div className="etan-equation">H = <Fraction numerator="ETAN" denominator="1 − ETAN / E" /></div></div>
      </div>
      <dl className="solver-definitions"><dt>E</dt><dd>Young&apos;s Modulus</dd><dt>H</dt><dd>OptiStruct MATS1 Work Hardening Slope</dd><dt>ETAN</dt><dd>LS-DYNA MAT_003 Tangent Modulus</dd></dl>
      <p className="etan-formula-note">E, H and ETAN use MPa. Reverse conversion requires 0 ≤ ETAN &lt; E. Calculations use full precision; displayed results are rounded.</p>
    </div>
  );
}

function DetailsDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="etan-auto-details">
      <summary><span className="etan-show-details">Show calculation details</span><span className="etan-hide-details">Hide calculation details</span></summary>
      <div className="etan-auto-details-body">{children}</div>
    </details>
  );
}

/** H and ETAN are both calculated automatically from the material properties (drawer and ETAN page). */
export function AutoCalculationDetails({ inputs, parameters, hIssue }: { inputs: HardeningInputs; parameters: ReturnType<typeof solverPlasticityParameters>; hIssue: string | null }) {
  const { hardeningSlopeH, tangentModulusEtan } = parameters;
  const result = parameters.calculatedHDetails;
  return (
    <DetailsDisclosure>
      <p className="etan-formula-note">H is calculated from Young&apos;s Modulus, Yield Stress, Ultimate Stress and Elongation. ETAN is then calculated from E and H.</p>
      <h4>A. H · OptiStruct MATS1 work hardening slope</h4>
      {result ? <HardeningSteps inputs={inputs} result={result} title="Work hardening slope (yield → ultimate, true stress–strain)" />
        : <p>H cannot be calculated. {hIssue}</p>}
      <h4>B. ETAN · LS-DYNA MAT_003 tangent modulus</h4>
      <EtanConversion youngsModulus={inputs.youngsModulus} hardeningSlopeH={hardeningSlopeH} tangentModulusEtan={tangentModulusEtan} />
      <FormulaReference />
    </DetailsDisclosure>
  );
}
