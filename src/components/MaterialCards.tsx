import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Material,
  type Category,
} from '../types';
import { formatDay, formatValue, unitFor, type UnitPrefs } from '../lib/format';
import { PROPS } from '../lib/props';

const english: Record<Category, string> = {
  Metal: 'Metal',
  Plastic: 'Plastic',
  Composite: 'Composite',
  Elastomer: 'Elastomer',
  Others: 'Other',
};
interface Props {
  rows: Material[];
  total: number;
  selected: string[];
  onToggle: (id: string) => void;
  onOpen: (material: Material) => void;
  units: UnitPrefs;
  activeId: string | null;
}
export function MaterialCards({
  rows,
  total,
  selected,
  onToggle,
  onOpen,
  units,
  activeId,
}: Props) {
  const fields = [
    'density',
    'yieldStress',
    'youngsModulus',
    'etan',
    'poissonRatio',
    'ultimateStress',
  ] as const;
  if (!rows.length)
    return (
      <div className="cards-empty">
        {total
          ? '沒有符合目前搜尋 / 篩選條件的材料。'
          : '尚無材料，請按「新增材料」建立第一筆資料。'}
      </div>
    );
  return (
    <div className="material-cards-scroll">
      <div className="material-card-groups">
        {CATEGORIES.map((category) => {
          const group = rows.filter(
            (material) => material.category === category,
          );
          return (
            group.length > 0 && (
              <section
                key={category}
                className={`material-card-group group-${category}`}
              >
                <h2>
                  <b>{CATEGORY_LABEL[category]}</b>
                  <span>{english[category]}</span>
                  <i>{group.length}</i>
                </h2>
                <div className="material-card-grid">
                  {group.map((material) => (
                    <article
                      className={`material-card ${selected.includes(material.id) ? 'selected' : ''} ${activeId === material.id ? 'active' : ''}`}
                      key={material.id}
                      tabIndex={0}
                      aria-label={`${material.name} 材料卡片`}
                      onClick={() => onOpen(material)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          event.target === event.currentTarget
                        )
                          onOpen(material);
                      }}
                    >
                      <header>
                        <button
                          className="material-card-title"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpen(material);
                          }}
                        >
                          {material.name}
                        </button>
                        <input
                          type="checkbox"
                          aria-label={`選取 ${material.name}`}
                          checked={selected.includes(material.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onToggle(material.id)}
                        />
                      </header>
                      <dl>
                        {fields.map((key) => {
                          const prop = PROPS.find((p) => p.key === key)!;
                          return (
                            <div
                              key={key}
                              title={`${prop.label} (${unitFor(prop, units)})`}
                            >
                              <dt>{prop.symbol}</dt>
                              <dd
                                className={
                                  material[key] === null ? 'missing' : ''
                                }
                              >
                                {formatValue(key, material[key], units)}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      <footer>
                        <span title={material.source}>
                          {material.source || '—'}
                        </span>
                        <time dateTime={material.updatedAt}>
                          {formatDay(material.updatedAt)}
                        </time>
                      </footer>
                    </article>
                  ))}
                </div>
              </section>
            )
          );
        })}
      </div>
      <div className="cards-foot">
        顯示 {rows.length} 筆，共 {total} 筆材料 · 點選卡片查看詳細資料
      </div>
    </div>
  );
}
