import { useEffect, useId, useRef, useState } from 'react';
import type { Material } from '../types';
import { calculatedNu31, formatNu31 } from '../lib/orthotropicNu31';
import { InfoIcon } from './icons';

/** Derived solver input, separate from the original nine engineering constants. */
export function HyperMeshNu31({ material }: { material: Material }) {
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const value = calculatedNu31(material);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => { pinned.current = false; setOpen(false); };
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) dismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return <div className="nu31-property" ref={wrapper}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => {
      if (!pinned.current && !wrapper.current?.contains(document.activeElement)) setOpen(false);
    }}
    onFocusCapture={() => setOpen(true)}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        pinned.current = false;
        setOpen(false);
      }
    }}>
    <button type="button" className="nu31-trigger" aria-expanded={open} aria-controls={panelId}
      onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current); }}>
      <span className="nu31-label">NU31（HyperMesh）</span>
      <strong>{value === null ? '—' : formatNu31(value)}</strong>
      <span className="nu31-hint">計算公式 <InfoIcon size={14} /></span>
    </button>
    <div id={panelId} className="nu31-formula" hidden={!open} role="region" aria-label="NU31 換算公式">
      <p>互易關係：ν13 / E1 = ν31 / E3</p>
      <p className="nu31-equation"><span>ν31=ν13×E3/E1</span>{value !== null && <><wbr /><span>={material.orthotropic!.nu13}</span><span>×{material.orthotropic!.e3}</span><span>/{material.orthotropic!.e1}</span><span>={formatNu31(value)}</span></>}</p>
      {value === null && <p>需要有效的 E1、E3（大於 0，使用相同單位）及 ν13，才能換算。</p>}
      <p>由原始 ν13 換算，無因次。E1、E3 使用相同單位；切換 MPa / GPa 不影響結果。</p>
      <p>適用 OptiStruct MAT9OR 預設的 NU31 解讀（3 方向單軸載入）。若設定 SYSSETTING(MAT9ORT=NU13)，該欄改用原始 ν13。</p>
      <p>「Default = NU23」指該欄留白時沿用 NU23，不會自動由 ν13 換算；此材料應明確填入 NU31。G31 = G13，剪切模數不需做此換算。</p>
      <p><a href="https://help.altair.com/hwsolvers/os/topics/solvers/os/mat9ort_bulk_r.htm" target="_blank" rel="noreferrer">Altair MAT9OR</a> · <a href="https://help.altair.com/hwsolvers/os/topics/solvers/os/syssetting_io_r.htm" target="_blank" rel="noreferrer">SYSSETTING / MAT9ORT</a></p>
    </div>
  </div>;
}
