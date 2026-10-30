import { useId } from 'react';
import type { Material } from '../types';
import { ORTHOTROPIC_GROUPS, type PropDef } from '../lib/props';
import { formatValue, unitFor, type UnitPrefs } from '../lib/format';
import { materialValue } from '../lib/materialProperties';
import { InfoIcon } from './icons';
import { HyperMeshNu31 } from './HyperMeshNu31';
import type { MaterialPropertyKey } from '../types';

export function OrthotropicInfo() {
  const helpId = useId();
  return <span className="orthotropic-info">
    <button type="button" className="info-btn" aria-label="Material principal directions information" aria-describedby={helpId}><InfoIcon size={14} /></button>
    <span id={helpId} role="tooltip">1 / 2 / 3 = Material principal directions.<br />For PCB / FR4: 1–2 = in-plane directions; 3 = through-thickness direction.<br />G13 / G23 correspond to transverse shear behavior.</span>
  </span>;
}

export function OrthotropicProperties({ material, units }: { material: Material; units: UnitPrefs }) {
  const property = (p: PropDef<MaterialPropertyKey>) => {
    const value = materialValue(material, p.key);
    return <div key={p.key} className={value === null ? 'missing' : ''}>
      <dt>{p.label}</dt>
      <dd>{formatValue(p.key, value, units)}{value !== null && unitFor(p, units) !== '—' && <small>{unitFor(p, units)}</small>}</dd>
    </div>;
  };
  return <div className="orthotropic-detail">
    <h3>Orthotropic Elastic Properties <OrthotropicInfo /></h3>
    <div className="orthotropic-groups">
      {ORTHOTROPIC_GROUPS.map(group => <section className="orthotropic-group" key={group.label} aria-label={group.label}>
        <h4>{group.label}</h4>
        <dl>{group.props.map(property)}</dl>
        {group.label === "Poisson's Ratio" && <HyperMeshNu31 key={material.id} material={material} />}
      </section>)}
    </div>
  </div>;
}
