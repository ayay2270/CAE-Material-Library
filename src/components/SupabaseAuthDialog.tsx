import { useState } from 'react';
import { Modal } from './Modal';

export function SupabaseAuthDialog({
  onClose,
  onSignIn,
}: {
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onSignIn(email.trim(), password);
    setPassword('');
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    onClose();
  };

  return (
    <Modal
      title="Admin 登入"
      width={420}
      onClose={onClose}
      footer={
        <>
          <span className="toolbar-spacer" />
          <button className="btn" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="btn primary" type="submit" form="material-admin-login" disabled={submitting}>
            {submitting ? '登入中…' : '登入'}
          </button>
        </>
      }
    >
      <form
        id="material-admin-login"
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="form-hint">登入只確認 Admin 身分，此步驟仍不可編輯材料。</p>
        <label>
          電子郵件
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            disabled={submitting}
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            disabled={submitting}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
