import { useRef, useState } from 'react';
import type { Material } from '../types';
import { useIndexes, type IndexKind } from '../lib/indexes';
import { Modal } from './Modal';
import { EditIcon, PlusIcon } from './icons';

export function IndexManager({
  kind,
  materials,
  onSave,
  onClose,
  pending = false,
  direct = false,
  directHint,
  onRemoteCommitted,
}: {
  kind: IndexKind;
  materials: Material[];
  onSave: (id: string | null, name: string) => string | null | Promise<string | null>;
  onClose: () => void;
  /** Another shared Supabase write is already in flight. */
  pending?: boolean;
  /** Supabase writes are committed immediately. */
  direct?: boolean;
  /** Shown instead of the local-draft hint. Supabase builds pass this; legacy builds omit it. */
  directHint?: string;
  onRemoteCommitted?: (message: string) => void;
}) {
  const indexes = useIndexes();
  const [editing, setEditing] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [remoteLocked, setRemoteLocked] = useState(false);
  const saveLock = useRef(false);
  const remoteLockRef = useRef(false);
  const reportedRemote = useRef(false);
  const busy = saving || pending;
  const title = kind === 'category' ? '管理材料分類' : '管理 SOURCE';
  const entries =
    kind === 'category'
      ? indexes.categories.map((c) => ({
          id: c.id,
          name: c.label,
          color: c.color,
        }))
      : indexes.sources.map((s) => ({ id: s, name: s, color: null }));
  const submit = async () => {
    if (!editing || saveLock.current || busy || remoteLocked || remoteLockRef.current) return;
    const current = editing;
    saveLock.current = true;
    setSaving(true);
    try {
      const message = await Promise.resolve(onSave(current.id, current.name));
      if (message) setError(message);
      else {
        setEditing(null);
        setError(null);
      }
    } catch (caught) {
      const remote = typeof caught === 'object' && caught !== null && (caught as { remoteCommitted?: boolean }).remoteCommitted === true;
      const text = caught instanceof Error && caught.message ? caught.message : '索引儲存失敗。';
      setError(text);
      if (remote) {
        remoteLockRef.current = true;
        setRemoteLocked(true);
        if (!reportedRemote.current) {
          reportedRemote.current = true;
          onRemoteCommitted?.(text);
        }
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal title={title} width={510} onClose={onClose} dismissDisabled={busy}>
      <p className="form-hint">
        {direct && directHint
          ? directHint
          : '新增項目可立即用於材料表單，尚未使用時顯示 0 筆。'}
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
              disabled={editing !== null || busy || remoteLocked}
              onClick={() => {
                if (busy || remoteLocked) return;
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
            void submit();
          }}
        >
          <label>
            {kind === 'category' ? '分類名稱' : 'Source 名稱'}
            <input
              autoFocus
              maxLength={120}
              value={editing.name}
              disabled={busy || remoteLocked}
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
              disabled={busy || remoteLocked}
              onClick={() => {
                if (busy || remoteLocked || remoteLockRef.current) return;
                setEditing(null);
                setError(null);
              }}
            >
              取消
            </button>
            <button type="submit" className="btn primary" disabled={busy || remoteLocked}>
              {busy ? (editing.id === null ? '新增中…' : '儲存中…') : editing.id === null ? '新增' : '儲存名稱'}
            </button>
          </div>
        </form>
      ) : (
        <div className="index-manager-actions">
          <button
            className="btn primary"
            disabled={busy || remoteLocked}
            onClick={() => {
              if (busy || remoteLocked) return;
              setEditing({ id: null, name: '' });
            }}
          >
            <PlusIcon />
            {kind === 'category' ? '新增分類' : '新增來源'}
          </button>
          <button className="btn" disabled={busy} onClick={onClose}>
            關閉
          </button>
        </div>
      )}
    </Modal>
  );
}
