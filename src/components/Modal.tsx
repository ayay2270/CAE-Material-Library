import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { CloseIcon } from './icons';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** 'drawer' slides in from the right instead of centring. */
  variant?: 'modal' | 'drawer';
  labelledBy?: string;
  /** Block overlay, Escape, and the header close control while a write is in flight. */
  dismissDisabled?: boolean;
}

export function Modal({ title, onClose, children, footer, width = 520, variant = 'modal', dismissDisabled = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissDisabled);
  closeRef.current = onClose;
  dismissRef.current = dismissDisabled;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dismissRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className={`overlay ${variant}`} onMouseDown={(e) => !dismissDisabled && e.target === e.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={{ width }}
        tabIndex={-1}
        ref={ref}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" disabled={dismissDisabled}>
            <CloseIcon size={14} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
