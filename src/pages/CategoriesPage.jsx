import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowRight, Check, X } from 'lucide-react';
import { call } from '../lib/api';
import { formatNumber } from '../lib/format';
import { Button, CategoryCode, ConfirmDialog, Field, Input, Modal, PageHeader, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function CategoriesPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [cats, setCats] = useState(null);
  const [adding, setAdding] = useState(null); // category id
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // {id, name}
  const [toDelete, setToDelete] = useState(null);
  const [descEdit, setDescEdit] = useState(null); // {id, name, description}
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => call('categories:list').then(setCats).catch(toast.error), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      if (msg) toast.success(msg);
      await load();
      return true;
    } catch (err) {
      toast.error(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addSub = async (catId) => {
    const ok = await run(() => call('subcategories:create', { category_id: catId, subcategory_name: newName }), 'Subkategori ditambahkan.');
    if (ok) {
      setNewName('');
      setAdding(null);
    }
  };
  const saveSub = async () => {
    const ok = await run(() => call('subcategories:update', editing.id, { subcategory_name: editing.name }), 'Subkategori diperbarui.');
    if (ok) setEditing(null);
  };
  const deleteSub = async () => {
    const ok = await run(() => call('subcategories:delete', toDelete.id), 'Subkategori dihapus.');
    if (ok) setToDelete(null);
  };
  const saveDesc = async () => {
    const ok = await run(() => call('categories:update', descEdit.id, { description: descEdit.description }), 'Deskripsi kategori diperbarui.');
    if (ok) setDescEdit(null);
  };

  return (
    <>
      <PageHeader
        title="Kategori Arsip"
        description={
          isAdmin
            ? 'Delapan standar pendidikan beserta subkategorinya. Anda dapat menambah, mengubah, atau menghapus subkategori.'
            : 'Delapan standar pendidikan beserta subkategorinya.'
        }
      />
      {!cats ? (
        <Spinner />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cats.map((c) => (
            <section key={c.id} className="card flex flex-col">
              <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
                <CategoryCode code={c.code} className="size-9 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{c.category_name}</h2>
                    {isAdmin && (
                      <button
                        type="button"
                        title="Ubah deskripsi"
                        onClick={() => setDescEdit({ id: c.id, name: c.category_name, description: c.description || '' })}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-700"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{c.description || 'Belum ada deskripsi.'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/arsip?kategori=${c.id}`)}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-navy-700 hover:bg-sky-50"
                >
                  {formatNumber(c.archive_count)} arsip <ArrowRight className="size-3.5" />
                </button>
              </header>

              <ul className="flex-1 divide-y divide-slate-100">
                {c.subcategories.length === 0 && <li className="px-5 py-3 text-sm text-slate-400">Belum ada subkategori.</li>}
                {c.subcategories.map((s) => (
                  <li key={s.id} className="group flex items-center gap-2 px-5 py-2">
                    {editing?.id === s.id ? (
                      <form
                        className="flex flex-1 items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveSub();
                        }}
                      >
                        <Input
                          autoFocus
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          className="h-8 text-sm"
                          maxLength={80}
                        />
                        <Button type="submit" size="icon" variant="soft" loading={busy} aria-label="Simpan">
                          {!busy && <Check className="size-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Batal">
                          <X className="size-4" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{s.subcategory_name}</span>
                        <span className="text-xs text-slate-400 tabular-nums">{formatNumber(s.archive_count)} arsip</span>
                        {isAdmin && (
                          <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              type="button"
                              title="Ubah nama"
                              onClick={() => setEditing({ id: s.id, name: s.subcategory_name })}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-700"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title={s.archive_count ? 'Masih digunakan oleh arsip' : 'Hapus'}
                              disabled={s.archive_count > 0}
                              onClick={() => setToDelete(s)}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              {isAdmin && (
                <footer className="border-t border-slate-200 px-5 py-3">
                  {adding === c.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addSub(c.id);
                      }}
                    >
                      <Input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nama subkategori baru"
                        className="h-8 text-sm"
                        maxLength={80}
                      />
                      <Button type="submit" size="sm" loading={busy}>
                        Tambah
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                        Batal
                      </Button>
                    </form>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Plus}
                      onClick={() => {
                        setAdding(c.id);
                        setNewName('');
                      }}
                    >
                      Tambah subkategori
                    </Button>
                  )}
                </footer>
              )}
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Hapus subkategori?"
        message={`Subkategori "${toDelete?.subcategory_name}" akan dihapus.`}
        loading={busy}
        onClose={() => setToDelete(null)}
        onConfirm={deleteSub}
      />

      <Modal
        open={!!descEdit}
        onClose={() => setDescEdit(null)}
        title="Deskripsi Kategori"
        description={descEdit?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDescEdit(null)}>
              Batal
            </Button>
            <Button onClick={saveDesc} loading={busy}>
              Simpan
            </Button>
          </>
        }
      >
        <Field label="Deskripsi" hint="Maksimal 300 karakter.">
          <Textarea
            value={descEdit?.description || ''}
            maxLength={300}
            onChange={(e) => setDescEdit({ ...descEdit, description: e.target.value })}
          />
        </Field>
      </Modal>
    </>
  );
}
