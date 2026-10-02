import { PROP_COUNT } from '../lib/props';

export function CompletenessBar({ filled }: { filled: number }) {
  const full = filled === PROP_COUNT;
  return (
    <span
      className={`completeness ${full ? 'full' : 'partial'}`}
      title={`${filled} of ${PROP_COUNT} properties filled`}
      role="img"
      aria-label={`${filled} of ${PROP_COUNT} properties filled`}
    >
      <span className="segs" aria-hidden="true">
        {Array.from({ length: PROP_COUNT }, (_, i) => (
          <i key={i} className={i < filled ? 'on' : ''} />
        ))}
      </span>
      <span className="num">
        {filled}/{PROP_COUNT}
      </span>
    </span>
  );
}
