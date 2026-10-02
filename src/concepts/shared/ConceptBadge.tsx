const CONCEPTS = [
  { id: 'a', name: 'A · Ledger' },
  { id: 'b', name: 'B · Explorer' },
  { id: 'c', name: 'C · Quick-Find' },
  { id: 'd', name: 'D · Workbench' },
  { id: 'e', name: 'E · Atlas' },
];

import { useState } from 'react';

/** Review-only switcher (not part of the product UI). Lets you hop between concepts and back to the gallery. */
export function ConceptBadge({ id }: { id: string }) {
  const [open, setOpen] = useState(true);
  if (!open)
    return (
      <button className="concept-badge mini" onClick={() => setOpen(true)} title="展開概念切換列">
        概念 ▴
      </button>
    );
  return (
    <nav className="concept-badge" aria-label="概念切換（僅供評審）">
      <a href="./index.html" title="回到概念圖庫">⌂ 圖庫</a>
      {CONCEPTS.map((c) => (
        <a key={c.id} href={`./concept-${c.id}.html`} className={c.id === id ? 'on' : ''}>
          {c.name}
        </a>
      ))}
      <button onClick={() => setOpen(false)} aria-label="收合" title="收合">▾</button>
    </nav>
  );
}
