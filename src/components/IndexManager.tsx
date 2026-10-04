import { useState } from 'react';
import type { Material } from '../types';
import { useIndexes, type IndexKind } from '../lib/indexes';
import { Modal } from './Modal';
import { EditIcon, PlusIcon } from './icons';

export function IndexManager({
  kind,
  materials,
  onSave,
  onClose,
}: {
  kind: IndexKind;
  materials: Material[];
  onSave: (id: string | null, name: string) => string | null;
  onClose: () => void;
}) {
  const indexes = useIndexes();
  const [editing, setEditing] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = kind === 'category' ? '管理材料分類' : '管理 SOURCE';
  const entries =
    kind === 'category'
      ? indexes.categories.map((c) => ({
          id: c.id,
          name: c.label,
          color: c.color,
        }))
      : indexes.sources.map((s) => ({ id: s, name: s, color: null }));
  return (
    <Modal title={title} width={510} onClose={onClose}>
      <p className="form-hint">
        新增項目可立即用於材料表單，尚未使用時顯示 0 筆。
        {kind === 'category'
          ? '編輯分類名稱會同步更新各頁顯示，材料的分類識別值不變。'
          : '來源重新命名會同步更新引用它的材料，並加入歷史記錄。'}
      </p>
      <div className="index-manager-list">
        {entries.map((entry) => (
          <div className="index-manager-row" key={entry.id}>
            {entry.color && (
              <i
                className="category-dot"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
            )}
            <span>{entry.name}</span>
            <b>
              {
                materials.filter(
                  (m) =>
                    (kind === 'category' ? m.category : m.source) === entry.id,
                ).length
              }{' '}
              筆
            </b>
            <button
              className="btn small-btn"
              aria-label={`編輯${kind === 'category' ? '分類' : '來源'} ${entry.name}`}
              disabled={editing !== null}
              onClick={() => {
                setEditing({ id: entry.id, name: entry.name });
                setError(null);
              }}
            >
              <EditIcon size={13} /> 編輯
            </button>
          </div>
        ))}
      </div>
      {editing ? (
        <form
          className="form index-manager-form"
          onSubmit={(event) => {
            event.preventDefault();
            const message = onSave(editing.id, editing.name);
            if (message) setError(message);
            else {
              setEditing(null);
              setError(null);
            }
          }}
        >
          <label>
            {kind === 'category' ? '分類名稱' : 'Source 名稱'}
            <input
              autoFocus
              maxLength={120}
              value={editing.name}
              onChange={(event) => {
                setEditing({ ...editing, name: event.target.value });
                setError(null);
              }}
            />
          </label>
          {error && (
            <div className="notice err" role="alert">
              {error}
            </div>
          )}
          <div className="index-manager-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null);
                setError(null);
              }}
            >
              取消
            </button>
            <button type="submit" className="btn primary">
              {editing.id === null ? '新增' : '儲存名稱'}
            </button>
          </div>
        </form>
      ) : (
        <div className="index-manager-actions">
          <button
            className="btn primary"
            onClick={() => setEditing({ id: null, name: '' })}
          >
            <PlusIcon />
            {kind === 'category' ? '新增分類' : '新增來源'}
          </button>
          <button className="btn" onClick={onClose}>
            關閉
          </button>
        </div>
      )}
    </Modal>
  );
}
