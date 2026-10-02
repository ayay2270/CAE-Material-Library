import { useRef, useState } from 'react';
import type { Material, MaterialInput } from '../types';
import { csvToMaterials, downloadCsv } from '../lib/csv';
import { DEFAULT_UNITS } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import { Modal } from './Modal';
import { DownloadIcon, UploadIcon } from './icons';

export function ConfirmDelete({ material, onConfirm, onClose }: { material: Material; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title="Delete material?"
      width={440}
      onClose={onClose}
      footer={
        <>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>Delete</button>
        </>
      }
    >
      <p>
        <b>{material.name}</b> and its history will be permanently removed from this browser's library. Export a CSV first if you may need it again.
      </p>
    </Modal>
  );
}

export function UnitsDialog({ units, onChange, onClose }: { units: UnitPrefs; onChange: (u: UnitPrefs) => void; onClose: () => void }) {
  return (
    <Modal title="Units" width={460} onClose={onClose}>
      <p className="muted">
        Records are stored in the <b>mm–t–N–s</b> system (density t/mm³, stress MPa), the usual CAE solver convention. These switches change the
        <i> display</i> only; CSV export and the Material Map always use the stored units.
      </p>
      <div className="unit-row">
        <span>Density</span>
        <div className="seg">
          {(['t/mm³', 'kg/m³'] as const).map((d) => (
            <button key={d} className={units.density === d ? 'on' : ''} onClick={() => onChange({ ...units, density: d })}>{d}</button>
          ))}
        </div>
      </div>
      <div className="unit-row">
        <span>Stress / modulus</span>
        <div className="seg">
          {(['MPa', 'GPa'] as const).map((d) => (
            <button key={d} className={units.stress === d ? 'on' : ''} onClick={() => onChange({ ...units, stress: d })}>{d}</button>
          ))}
        </div>
      </div>
      <button className="btn" onClick={() => onChange(DEFAULT_UNITS)}>Reset to t/mm³ · MPa</button>
    </Modal>
  );
}

export function ImportExportDialog({
  materials,
  onImport,
  onReset,
  onClose,
}: {
  materials: Material[];
  onImport: (rows: MaterialInput[]) => { added: number; updated: number; unchanged: number };
  onReset: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string; details?: string[] } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { rows, errors } = csvToMaterials(text);
    if (rows.length === 0) {
      setMessage({ kind: 'err', text: 'Nothing imported.', details: errors });
      return;
    }
    const r = onImport(rows);
    setMessage({
      kind: 'ok',
      text: `Imported ${rows.length} row(s): ${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged (matched by name).`,
      details: errors,
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Modal title="Import / Export" width={520} onClose={onClose}>
      <section className="io-block">
        <h3>Export</h3>
        <p className="muted">Downloads all {materials.length} materials as CSV (stored units: t/mm³, MPa, %).</p>
        <button className="btn" onClick={() => downloadCsv(materials)}>
          <DownloadIcon /> Export all as CSV
        </button>
      </section>
      <section className="io-block">
        <h3>Import</h3>
        <p className="muted">
          Use a file exported from this tool (columns: Name, Category, property columns, Source, Notes). Rows whose name already exists
          update that material; others are added. Blank cells stay “—”.
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-input" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> Choose CSV file…
        </button>
        {message && (
          <div className={`notice ${message.kind}`} role="status">
            {message.text}
            {message.details && message.details.length > 0 && (
              <ul>
                {message.details.slice(0, 6).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {message.details.length > 6 && <li>…and {message.details.length - 6} more</li>}
              </ul>
            )}
          </div>
        )}
      </section>
      <section className="io-block">
        <h3>Sample data</h3>
        <p className="muted">Restore the 11 sample materials. This replaces everything currently stored in this browser.</p>
        {confirmReset ? (
          <span className="inline-confirm">
            Replace all data?{' '}
            <button className="btn danger" onClick={() => { onReset(); setConfirmReset(false); setMessage({ kind: 'ok', text: 'Sample data restored.' }); }}>Yes, replace</button>{' '}
            <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
          </span>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>Restore sample data…</button>
        )}
      </section>
    </Modal>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Help" width={500} onClose={onClose}>
      <ul className="help-list">
        <li><b>Find</b> — search by name, source or notes; filter with the category chips; click a column header to sort.</li>
        <li><b>Inspect</b> — click a row for properties, curve, source, notes and history. Use the pencil / bin icons for Edit / Delete.</li>
        <li><b>Check data quality</b> — the completeness bar counts how many of the 7 properties are filled. “—” means not recorded (never zero).</li>
        <li><b>Compare</b> — tick 2–3 rows, then “Compare Selected”.</li>
        <li><b>Material Map</b> — one auxiliary view of Density vs. Young's Modulus. Click ⓘ there for how to read it.</li>
        <li><b>Storage</b> — data lives in this browser's localStorage. Export CSV regularly; clearing site data removes it.</li>
        <li><b>Shortcut</b> — press <kbd>/</kbd> to jump to search.</li>
      </ul>
    </Modal>
  );
}

export function MapInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to read this chart" width={520} onClose={onClose}>
      <p>
        <b>X axis — Density ρ:</b> further left means lower material density / lighter material.
      </p>
      <p>
        <b>Y axis — Young's Modulus E:</b> higher means higher material elastic stiffness.
      </p>
      <p>
        Therefore, materials closer to the <b>upper-left</b> region provide a combination of relatively low density and high material stiffness.
      </p>
      <svg viewBox="0 0 300 150" className="info-diagram" role="img" aria-label="Upper-left is light and stiff">
        <rect x="60" y="12" width="90" height="56" className="ideal-zone" />
        <text x="105" y="36" textAnchor="middle" className="ideal-text">Lighter</text>
        <text x="105" y="52" textAnchor="middle" className="ideal-text">+ stiffer</text>
        <line x1="150" y1="8" x2="150" y2="142" className="axis" />
        <line x1="20" y1="75" x2="288" y2="75" className="axis" />
        <text x="152" y="12" className="tick">E high</text>
        <text x="152" y="140" className="tick">E low</text>
        <text x="22" y="90" className="tick">ρ low</text>
        <text x="258" y="90" textAnchor="end" className="tick">ρ high</text>
      </svg>
      <div className="note">
        <InfoGlyph />
        <div>
          <b>Engineering note</b>
          <p>
            Young's Modulus describes material elastic stiffness. It does not directly represent the stiffness of the final component or
            structure. Actual structural stiffness also depends on geometry, thickness, section properties, boundary conditions and loading.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function InfoGlyph() {
  return <span className="note-glyph" aria-hidden="true">i</span>;
}
