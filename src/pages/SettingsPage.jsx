import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  HardDrive,
  DatabaseBackup,
  UserCog,
  History,
  Info,
  FolderOpen,
  FolderInput,
  Save,
  Archive,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { call } from '../lib/api';
import { formatBytes, formatDateTime, formatNumber, ROLE_LABEL } from '../lib/format';
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Pagination, Spinner, Textarea, cx } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ChangePasswordForm from '../components/ChangePasswordForm';
import { LogoMark } from '../components/Logo';

const TABS = [
  { id: 'perusahaan', label: 'Informasi Perusahaan', icon: Building2, admin: true },
  { id: 'penyimpanan', label: 'Lokasi Penyimpanan', icon: HardDrive, admin: true },
  { id: 'backup', label: 'Backup & Restore', icon: DatabaseBackup },
  { id: 'akun', label: 'Akun Saya', icon: UserCog },
  { id: 'log', label: 'Log Aktivitas', icon: History, admin: true },
  { id: 'tentang', label: 'Tentang Aplikasi', icon: Info },
];

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const tabs = TABS.filter((t) => !t.admin || isAdmin);
  const [tab, setTab] = useState(tabs[0].id);
  const [data, setData] = useState(null);

  const load = useCallback(() => call('settings:get').then(setData).catch(toast.error), [toast]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Pengaturan" description="Konfigurasi perusahaan, penyimpanan, backup, dan akun Anda." />
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav className="card h-fit p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                tab === t.id ? 'bg-sky-50 font-medium text-navy-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {!data ? (
            <Spinner />
          ) : (
            <>
              {tab === 'perusahaan' && <CompanyTab data={data} onSaved={load} />}
              {tab === 'penyimpanan' && <StorageTab data={data} onChanged={load} />}
              {tab === 'backup' && <BackupTab data={data} />}
              {tab === 'akun' && <AccountTab />}
              {tab === 'log' && <LogTab />}
              {tab === 'tentang' && <AboutTab data={data} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, description, children, footer }) {
  return (
    <section className="card mb-6">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-6 py-3">{footer}</div>}
    </section>
  );
}

// ---------- Informasi perusahaan ----------
const COMPANY_FIELDS = [
  ['app_name', 'Nama aplikasi', 60],
  ['company_name', 'Nama perusahaan', 150],
  ['company_reg_number', 'NIB / NPWP', 50],
  ['company_phone', 'Telepon', 30],
  ['company_email', 'Email perusahaan', 100],
  ['leader_name', 'Nama pimpinan', 100],
  ['leader_title', 'Jabatan pimpinan', 60, 'Ditampilkan di atas tanda tangan laporan, mis. Direktur Utama'],
];

function CompanyTab({ data, onSaved }) {
  const { refreshInfo } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState(() => ({ ...data.values }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries([...COMPANY_FIELDS.map(([k]) => k), 'company_address'].map((k) => [k, values[k] ?? '']));
      await call('settings:update', payload);
      await Promise.all([refreshInfo(), onSaved()]);
      toast.success('Informasi perusahaan disimpan.');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Section
        title="Informasi Perusahaan"
        description="Digunakan pada kop laporan, halaman login, dan tanda tangan laporan."
        footer={
          <Button type="submit" icon={Save} loading={saving}>
            Simpan Perubahan
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {COMPANY_FIELDS.map(([k, label, max, hint]) => (
            <Field key={k} label={label} hint={hint} required={k === 'app_name'} className={k === 'company_name' ? 'md:col-span-2' : ''}>
              <Input value={values[k] || ''} onChange={set(k)} maxLength={max} type={k === 'company_email' ? 'email' : 'text'} />
            </Field>
          ))}
          <Field label="Alamat perusahaan" className="md:col-span-2">
            <Textarea value={values.company_address || ''} onChange={set('company_address')} maxLength={300} />
          </Field>
        </div>
      </Section>
    </form>
  );
}

// ---------- Lokasi penyimpanan ----------
function PathRow({ label, value, hint, onOpen, onChange, changing }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="mt-1 truncate rounded-md bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600" title={value}>
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" icon={FolderOpen} onClick={onOpen}>
          Buka
        </Button>
        {onChange && (
          <Button size="sm" variant="secondary" icon={FolderInput} onClick={onChange} loading={changing}>
            Ubah
          </Button>
        )}
      </div>
    </div>
  );
}

function StorageTab({ data, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [confirmDocs, setConfirmDocs] = useState(false);

  const open = (which) => call('settings:openFolder', which).catch(toast.error);
  const change = async (channel, key) => {
    setConfirmDocs(false);
    setBusy(key);
    try {
      const res = await call(channel);
      if (!res.canceled) {
        toast.success(
          key === 'docs' ? `Folder dokumen dipindahkan (${formatNumber(res.moved || 0)} file disalin).` : 'Folder backup diperbarui.'
        );
        await onChanged();
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Section title="Lokasi Penyimpanan" description="Data ARSIPKU disimpan di luar folder instalasi sehingga aman saat aplikasi diperbarui atau diinstal ulang.">
        <PathRow
          label="Folder dokumen PDF"
          value={data.documentsDir}
          hint="Saat diubah, seluruh dokumen disalin ke folder baru dan diverifikasi sebelum folder lama dihapus."
          onOpen={() => open('documents')}
          onChange={() => setConfirmDocs(true)}
          changing={busy === 'docs'}
        />
        <PathRow
          label="Folder backup"
          value={data.backupDir}
          hint="Lokasi default paket backup. Disarankan berada di drive berbeda atau media eksternal."
          onOpen={() => open('backup')}
          onChange={() => change('settings:changeBackupDir', 'backup')}
          changing={busy === 'backup'}
        />
        <PathRow label="Folder data aplikasi" value={data.dataRoot} hint="Berisi database, log, dan konfigurasi." onOpen={() => open('data')} />
        <PathRow label="File database" value={data.databaseFile} onOpen={() => open('data')} />
      </Section>
      <ConfirmDialog
        open={confirmDocs}
        tone="warning"
        title="Pindahkan folder dokumen?"
        message="Seluruh file PDF akan disalin ke folder baru yang Anda pilih. Proses ini dapat memakan waktu bila jumlah dokumen banyak. Jangan menutup aplikasi selama proses berlangsung."
        confirmLabel="Pilih Folder"
        onClose={() => setConfirmDocs(false)}
        onConfirm={() => change('settings:changeDocumentsDir', 'docs')}
      />
    </>
  );
}

// ---------- Backup & restore ----------
const BACKUP_TYPES = [
  { id: 'full', label: 'Lengkap', desc: 'Database dan seluruh dokumen PDF' },
  { id: 'database', label: 'Database', desc: 'Data arsip, pengguna, dan pengaturan' },
  { id: 'documents', label: 'Dokumen', desc: 'File PDF saja' },
];
const MODE_LABEL = { full: 'Lengkap (database + dokumen)', database: 'Database saja', documents: 'Dokumen saja' };

function BackupTab({ data }) {
  const { isAdmin, setUser } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('full');
  const [busy, setBusy] = useState('');
  const [list, setList] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [mode, setMode] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState(null);

  const loadList = useCallback(() => call('backup:list').then(setList).catch(toast.error), [toast]);
  useEffect(() => {
    loadList();
  }, [loadList]);

  const create = async (chooseLocation) => {
    setBusy(chooseLocation ? 'create-other' : 'create');
    try {
      const res = await call('backup:create', { type, chooseLocation });
      if (!res.canceled) {
        toast.success(`Backup dibuat: ${res.name} (${formatBytes(res.size)})`);
        loadList();
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  const choose = async (file) => {
    setBusy('inspect');
    try {
      const info = file ? await call('backup:inspect', file) : await call('backup:pickFile');
      if (info) {
        setPkg(info);
        setMode(info.modes[0]);
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const res = await call('backup:restore', { file: pkg.file, mode });
      setConfirm(false);
      setPkg(null);
      setResult(res);
    } catch (err) {
      setConfirm(false);
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Section title="Buat Backup" description={`Paket backup (.zip) disimpan ke ${data.backupDir}`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {BACKUP_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cx(
                'rounded-lg border p-3 text-left transition-colors',
                type === t.id ? 'border-navy-600 bg-sky-50 ring-1 ring-navy-600' : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="text-sm font-medium text-slate-900">{t.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={Archive} onClick={() => create(false)} loading={busy === 'create'} disabled={!!busy}>
            Buat Backup Sekarang
          </Button>
          <Button variant="secondary" icon={FolderInput} onClick={() => create(true)} loading={busy === 'create-other'} disabled={!!busy}>
            Simpan ke Lokasi Lain…
          </Button>
        </div>
      </Section>

      {isAdmin && (
        <Section
          title="Pulihkan Data (Restore)"
          description="Paket backup divalidasi terlebih dahulu. Data saat ini otomatis dibackup sebelum diganti dan tidak dihapus bila pemulihan gagal."
        >
          <Button variant="secondary" icon={Upload} onClick={() => choose()} loading={busy === 'inspect'} disabled={!!busy}>
            Pilih File Backup…
          </Button>
        </Section>
      )}

      <Section title="Riwayat Backup" description="Paket backup yang ada di folder backup.">
        {!list ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState icon={DatabaseBackup} title="Belum ada backup" description="Buat backup secara berkala untuk mencegah kehilangan data." />
        ) : (
          <div className="-mx-6 -my-5 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nama file</th>
                  <th>Jenis</th>
                  <th>Ukuran</th>
                  <th>Dibuat</th>
                  {isAdmin && <th className="text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.path}>
                    <td className="max-w-xs truncate font-mono text-xs text-slate-700" title={b.name}>
                      {b.name}
                    </td>
                    <td>
                      {b.type ? <Badge color={b.type === 'full' ? 'navy' : 'sky'}>{BACKUP_TYPES.find((t) => t.id === b.type)?.label}</Badge> : '-'}
                      {b.name.includes('sebelum-restore') && <Badge className="ml-1">Pengaman</Badge>}
                    </td>
                    <td className="whitespace-nowrap text-slate-600 tabular-nums">{formatBytes(b.size)}</td>
                    <td className="whitespace-nowrap text-slate-600">{formatDateTime(b.modified)}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => choose(b.path)} disabled={!!busy}>
                          Pulihkan
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal
        open={!!pkg}
        onClose={() => setPkg(null)}
        title="Pulihkan dari Backup"
        description="Paket backup valid. Periksa isinya sebelum melanjutkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPkg(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Pulihkan
            </Button>
          </>
        }
      >
        {pkg && (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-emerald-800">
              <ShieldCheck className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-medium" title={pkg.file}>
                  {pkg.file.split(/[\\/]/).pop()}
                </div>
                <div className="text-xs">
                  Dibuat {formatDateTime(pkg.manifest.created_at)}
                  {pkg.manifest.created_by && ` oleh ${pkg.manifest.created_by}`} · ARSIPKU v{pkg.manifest.app_version}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-slate-500">Jenis paket</dt>
              <dd className="text-slate-800">{MODE_LABEL[pkg.manifest.type]}</dd>
              {pkg.hasDatabase && (
                <>
                  <dt className="text-slate-500">Jumlah arsip</dt>
                  <dd className="text-slate-800">{formatNumber(pkg.manifest.archives ?? 0)}</dd>
                </>
              )}
              {pkg.hasDocuments && (
                <>
                  <dt className="text-slate-500">File dokumen</dt>
                  <dd className="text-slate-800">
                    {formatNumber(pkg.documentCount)} file ({formatBytes(pkg.documentSize)})
                  </dd>
                </>
              )}
            </dl>
            <div>
              <div className="mb-2 font-medium text-slate-700">Yang dipulihkan</div>
              <div className="space-y-2">
                {pkg.modes.map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <input type="radio" name="restore-mode" checked={mode === m} onChange={() => setMode(m)} className="accent-navy-800" />
                    {MODE_LABEL[m]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm}
        title="Ganti data saat ini?"
        confirmLabel="Ya, Pulihkan"
        loading={busy === 'restore'}
        message={
          <>
            Data <b>{MODE_LABEL[mode]?.toLowerCase()}</b> saat ini akan diganti dengan isi paket backup. Backup pengaman otomatis dibuat terlebih dahulu.
            {mode !== 'documents' && ' Setelah selesai, Anda harus login ulang.'}
          </>
        }
        onClose={() => setConfirm(false)}
        onConfirm={restore}
      />

      <Modal
        open={!!result}
        dismissable={false}
        title="Pemulihan berhasil"
        size="sm"
        footer={
          <Button
            onClick={() => {
              const needLogin = result.requireLogin;
              setResult(null);
              if (needLogin) setUser(null);
              else loadList();
            }}
          >
            {result?.requireLogin ? 'Login Ulang' : 'Selesai'}
          </Button>
        }
      >
        {result && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Data berhasil dipulihkan{result.archives != null && ` (${formatNumber(result.archives)} arsip)`}.</p>
            <p className="text-xs">
              Backup pengaman data sebelumnya: <span className="font-mono break-all">{result.safetyBackup}</span>
            </p>
            {result.missingFiles > 0 && (
              <p className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-amber-800">
                <AlertTriangle className="size-4 shrink-0" />
                {formatNumber(result.missingFiles)} file PDF yang tercatat di database tidak ada di paket backup.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

// ---------- Akun ----------
function AccountTab() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  return (
    <>
      <Section title="Profil">
        <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Nama</dt>
          <dd className="text-slate-800">{user.full_name}</dd>
          <dt className="text-slate-500">Username</dt>
          <dd className="text-slate-800">{user.username}</dd>
          <dt className="text-slate-500">Role</dt>
          <dd>
            <Badge color={user.role === 'admin' ? 'navy' : 'sky'}>{ROLE_LABEL[user.role]}</Badge>
          </dd>
        </dl>
      </Section>
      <Section title="Ganti Password">
        <div className="max-w-md">
          <ChangePasswordForm
            onDone={async () => {
              await refreshUser();
              toast.success('Password berhasil diganti.');
            }}
          />
        </div>
      </Section>
    </>
  );
}

// ---------- Log aktivitas ----------
function LogTab() {
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword), 250);
    return () => clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    call('logs:list', { keyword: debounced, page, pageSize }).then(setResult).catch(toast.error);
  }, [debounced, page, pageSize, toast]);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Log Aktivitas</h2>
          <p className="text-sm text-slate-500">Catatan seluruh aktivitas pengguna di aplikasi.</p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="Cari aktivitas atau pengguna…"
            className="pl-9"
          />
        </div>
      </div>
      {!result ? (
        <Spinner />
      ) : result.rows.length === 0 ? (
        <EmptyState icon={History} title="Tidak ada log" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-44">Waktu</th>
                  <th className="w-40">Pengguna</th>
                  <th className="w-44">Aktivitas</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-slate-600">{formatDateTime(l.created_at)}</td>
                    <td className="text-slate-700">{l.user_name || <span className="text-slate-400">Sistem</span>}</td>
                    <td className="font-medium text-slate-800">{l.activity}</td>
                    <td className="text-slate-600">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </>
      )}
    </section>
  );
}

// ---------- Tentang ----------
function AboutTab({ data }) {
  const { info } = useAuth();
  return (
    <Section title="Tentang Aplikasi">
      <div className="flex items-center gap-4">
        <LogoMark className="size-14" />
        <div>
          <div className="text-xl font-semibold text-slate-900">{info.app_name || 'ARSIPKU'}</div>
          <div className="text-sm text-slate-500">Sistem Arsip Digital Perusahaan · Versi {data.version}</div>
        </div>
      </div>
      <p className="mt-5 max-w-2xl text-sm text-slate-600">
        Aplikasi desktop offline untuk mengelola arsip dokumen perusahaan: keuangan, data perusahaan, dan data karyawan. Seluruh data tersimpan di komputer
        ini, tanpa koneksi internet.
      </p>
      <dl className="mt-5 grid max-w-md grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
        <dt className="text-slate-500">Versi aplikasi</dt>
        <dd className="text-slate-800">{data.version}</dd>
        <dt className="text-slate-500">Electron</dt>
        <dd className="text-slate-800">{data.electron}</dd>
        <dt className="text-slate-500">Node.js</dt>
        <dd className="text-slate-800">{data.node}</dd>
        <dt className="text-slate-500">Folder data</dt>
        <dd className="truncate font-mono text-xs leading-5 text-slate-700" title={data.dataRoot}>
          {data.dataRoot}
        </dd>
      </dl>
    </Section>
  );
}
