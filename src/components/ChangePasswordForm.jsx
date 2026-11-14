import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { call } from '../lib/api';
import { Button, Field, Input } from './ui';

export default function ChangePasswordForm({ onDone, submitLabel = 'Simpan Password' }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    try {
      await call('auth:changePassword', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      await onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Password saat ini" required>
        <Input type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
      </Field>
      <Field label="Password baru" hint="Minimal 6 karakter." required>
        <Input type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
      </Field>
      <Field label="Ulangi password baru" required>
        <Input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </Field>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
      <Button type="submit" loading={loading} icon={KeyRound}>
        {submitLabel}
      </Button>
    </form>
  );
}
