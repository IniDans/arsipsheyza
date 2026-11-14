import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Pencil, KeyRound, Trash2, Users } from 'lucide-react';
import { call } from '../lib/api';
import { formatDateTime, formatNumber, ROLE_LABEL } from '../lib/format';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, cx } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const BLANK = { username: '', full_name: '', role: 'operator', is_active: true, password: '', confirm: '' };

export default function UsersPage() {
  const { user: me, refreshUser } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState(null); // {mode:'create'|'edit', id, ...fields}
  const [reset, setReset] = useState(null); // {user, password, confirm}
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => call('users:list').then(setUsers).catch(toast.error), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setError('');
    setForm({ mode: 'create', ...BLANK });
  };
  const openEdit = (u) => {
    setError('');
    setForm({ mode: 'edit', id: u.id, username: u.username, full_name: u.full_name, role: u.role, is_active: !!u.is_active });
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (form.mode === 'create' && form.password !== form.confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setBusy(true);
    try {
      const data = { username: form.username, full_name: form.full_name, role: form.role, is_active: form.is_active };
      if (form.mode === 'create') {
        await call('users:create', { ...data, password: form.password });
        toast.success(`Pengguna ${form.username} ditambahkan. Ia wajib mengganti password saat login pertama.`);
      } else {
        await call('users:update', form.id, data);
        toast.success('Data pengguna diperbarui.');
        if (form.id === me.id) await refreshUser();
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setError('');
    if (reset.password !== reset.confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setBusy(true);
    try {
      await call('users:resetPassword', reset.user.id, reset.password);
      toast.success(`Password ${reset.user.username} telah diatur ulang.`);
      setReset(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await call('users:delete', toDelete.id);
      toast.success(`Pengguna ${toDelete.username} dihapus.`);
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Manajemen Pengguna"
        description="Operator dapat mengelola arsip; hanya administrator yang dapat mengelola pengguna dan pengaturan perusahaan."
        actions={
          <Button icon={UserPlus} onClick={openCreate}>
            Tambah Pengguna
          </Button>
        }
      />

      <div className="card">
        {!users ? (
          <Spinner />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="Belum ada pengguna" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Login Terakhir</th>
                  <th className="text-right">Arsip Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-navy-800">
                          {u.full_name
                            .split(' ')
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()}
                        </span>
                        <div>
                          <div className="font-medium text-slate-900">
                            {u.full_name}
                            {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(Anda)</span>}
                          </div>
                          {u.must_change_password ? <div className="text-xs text-amber-700">Wajib ganti password</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-600">{u.username}</td>
                    <td>
                      <Badge color={u.role === 'admin' ? 'navy' : 'sky'}>{ROLE_LABEL[u.role]}</Badge>
                    </td>
                    <td>{u.is_active ? <Badge color="green">Aktif</Badge> : <Badge color="slate">Nonaktif</Badge>}</td>
                    <td className="whitespace-nowrap text-slate-600">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Belum pernah'}</td>
                    <td className="text-right text-slate-600 tabular-nums">{formatNumber(u.archive_count)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <IconBtn title="Edit" icon={Pencil} onClick={() => openEdit(u)} />
                        <IconBtn
                          title="Atur ulang password"
                          icon={KeyRound}
                          onClick={() => {
                            setError('');
                            setReset({ user: u, password: '', confirm: '' });
                          }}
                        />
                        <IconBtn title="Hapus" icon={Trash2} danger disabled={u.id === me.id} onClick={() => setToDelete(u)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button type="submit" form="user-form" loading={busy}>
              Simpan
            </Button>
          </>
        }
      >
        {form && (
          <form id="user-form" onSubmit={save} className="space-y-4">
            <Field label="Nama lengkap" required>
              <Input value={form.full_name} onChange={set('full_name')} maxLength={100} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Username" required hint="Huruf, angka, titik, _ atau -">
                <Input value={form.username} onChange={set('username')} maxLength={32} autoComplete="off" />
              </Field>
              <Field label="Role" required>
                <Select value={form.role} onChange={set('role')} disabled={form.id === me.id}>
                  <option value="operator">Operator</option>
                  <option value="admin">Administrator</option>
                </Select>
              </Field>
            </div>
            {form.mode === 'create' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password awal" required hint="Minimal 6 karakter">
                  <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
                </Field>
                <Field label="Ulangi password" required>
                  <Input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                </Field>
              </div>
            )}
            <label className={cx('flex items-center gap-2 text-sm text-slate-700', form.id === me.id && 'opacity-50')}>
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 accent-navy-800"
                checked={form.is_active}
                onChange={set('is_active')}
                disabled={form.id === me.id}
              />
              Akun aktif (dapat login)
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </form>
        )}
      </Modal>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title="Atur Ulang Password"
        description={reset ? `${reset.user.full_name} (${reset.user.username})` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReset(null)}>
              Batal
            </Button>
            <Button type="submit" form="reset-form" loading={busy}>
              Simpan Password
            </Button>
          </>
        }
      >
        {reset && (
          <form id="reset-form" onSubmit={doReset} className="space-y-4">
            <Field label="Password baru" hint="Minimal 6 karakter. Pengguna wajib menggantinya saat login berikutnya.">
              <Input
                type="password"
                autoFocus
                value={reset.password}
                onChange={(e) => setReset({ ...reset, password: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Ulangi password baru">
              <Input
                type="password"
                value={reset.confirm}
                onChange={(e) => setReset({ ...reset, confirm: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Hapus pengguna?"
        message={`Akun "${toDelete?.username}" akan dihapus. Arsip yang pernah dibuat pengguna ini tetap tersimpan.`}
        loading={busy}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
      />
    </>
  );
}

function IconBtn({ icon: Icon, title, danger, ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cx(
        'rounded-md p-1.5 text-slate-500 transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-navy-700'
      )}
      {...props}
    >
      <Icon className="size-4" />
    </button>
  );
}
