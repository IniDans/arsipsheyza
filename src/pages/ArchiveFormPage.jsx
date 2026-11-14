import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, FileText, X, Save, AlertCircle, Undo2 } from 'lucide-react';
import { call } from '../lib/api';
import { formatBytes, todayIso } from '../lib/format';
import { Button, Field, Input, PageHeader, Select, Spinner, Textarea, cx } from '../components/ui';
import { useToast } from '../components/Toast';

const BLANK = {
  input_date: todayIso(),
  category_id: '',
  subcategory_id: '',
  document_type: '',
  document_number: '',
  document_name: '',
  description: '',
  attachment_description: '',
  storage_code: '',
  document_year: String(new Date().getFullYear()),
};

export default function ArchiveFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [archive, setArchive] = useState(null);
  const [previewNumber, setPreviewNumber] = useState('');
  const [newFiles, setNewFiles] = useState([]);
  const [removeIds, setRemoveIds] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const autoCode = useRef('');

  useEffect(() => {
    (async () => {
      try {
        const [cats, opts] = await Promise.all([call('categories:list'), call('archives:filterOptions')]);
        setCategories(cats);
        setDocTypes(opts.documentTypes);
        if (isEdit) {
          const a = await call('archives:get', id);
          setArchive(a);
          setForm({
            input_date: a.input_date,
            category_id: String(a.category_id),
            subcategory_id: a.subcategory_id ? String(a.subcategory_id) : '',
            document_type: a.document_type,
            document_number: a.document_number,
            document_name: a.document_name,
            description: a.description,
            attachment_description: a.attachment_description,
            storage_code: a.storage_code,
            document_year: a.document_year ? String(a.document_year) : '',
          });
        }
      } catch (err) {
        toast.error(err);
        navigate('/arsip');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, navigate, toast]);

  useEffect(() => {
    if (isEdit) return;
    call('archives:previewNumber', form.input_date).then(setPreviewNumber).catch(() => {});
  }, [form.input_date, isEdit]);

  const category = categories.find((c) => String(c.id) === form.category_id);
  const subs = category?.subcategories || [];

  const set = (k) => (e) => {
    const v = e.target.value;
    setErrors((er) => ({ ...er, [k]: undefined }));
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'category_id') next.subcategory_id = '';
      // Usulan kode simpan otomatis: <kode kategori>.<urutan subkategori>
      if (k === 'category_id' || k === 'subcategory_id') {
        const cat = categories.find((c) => String(c.id) === next.category_id);
        const idx = cat?.subcategories.findIndex((s) => String(s.id) === next.subcategory_id) ?? -1;
        const suggestion = cat ? (idx >= 0 ? `${cat.code}.${idx + 1}` : cat.code) : '';
        if (!f.storage_code || f.storage_code === autoCode.current) {
          next.storage_code = suggestion;
          autoCode.current = suggestion;
        }
      }
      return next;
    });
  };

  const existingFiles = (archive?.files || []).filter((f) => !removeIds.includes(f.id));
  const removedFiles = (archive?.files || []).filter((f) => removeIds.includes(f.id));
  const totalFiles = existingFiles.length + newFiles.length;

  const pickFiles = async () => {
    try {
      const picked = await call('files:pick');
      const bad = picked.filter((p) => p.error);
      bad.forEach((b) => toast.error(b.error));
      setNewFiles((list) => {
        const known = new Set(list.map((f) => f.path.toLowerCase()));
        return [...list, ...picked.filter((p) => !p.error && !known.has(p.path.toLowerCase()))];
      });
      setErrors((er) => ({ ...er, files: undefined }));
    } catch (err) {
      toast.error(err);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.category_id) e.category_id = 'Pilih kategori.';
    if (subs.length && !form.subcategory_id) e.subcategory_id = 'Pilih subkategori.';
    if (!form.document_type.trim()) e.document_type = 'Jenis dokumen wajib diisi.';
    if (!form.document_name.trim()) e.document_name = 'Nama dokumen wajib diisi.';
    if (!form.input_date) e.input_date = 'Tanggal input wajib diisi.';
    if (form.document_year && !/^\d{4}$/.test(form.document_year)) e.document_year = 'Tahun harus 4 digit.';
    if (totalFiles === 0) e.files = 'Unggah minimal satu file PDF.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const paths = newFiles.map((f) => f.path);
      if (isEdit) {
        await call('archives:update', id, form, { addFiles: paths, removeFileIds: removeIds });
        toast.success('Perubahan arsip berhasil disimpan.');
        navigate(`/arsip/${id}`);
      } else {
        const res = await call('archives:create', form, paths);
        toast.success(`Arsip ${res.archive_number} berhasil disimpan.`);
        navigate(`/arsip/${res.id}`);
      }
    } catch (err) {
      toast.error(err, 'Arsip belum tersimpan');
      setSaving(false);
    }
  };

  const typeOptions = useMemo(
    () => [...new Set([...docTypes, 'Surat Keputusan', 'Surat Masuk', 'Surat Keluar', 'Laporan', 'Notulen', 'Sertifikat', 'Daftar Hadir', 'Program Kerja'])],
    [docTypes]
  );

  if (loading) return <Spinner />;

  return (
    <form onSubmit={submit}>
      <PageHeader
        title={isEdit ? 'Edit Arsip' : 'Tambah Arsip'}
        description={isEdit ? `${archive.archive_number} — ${archive.document_name}` : 'Lengkapi informasi dokumen lalu unggah file PDF.'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" icon={Save} loading={saving}>
              {isEdit ? 'Simpan Perubahan' : 'Simpan Arsip'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Identitas Arsip</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="ID Arsip" hint="Dibuat otomatis">
                <Input value={isEdit ? `#${archive.id}` : 'Otomatis'} disabled />
              </Field>
              <Field label="Nomor Arsip" hint="Nomor urut otomatis">
                <Input value={isEdit ? archive.archive_number : previewNumber} disabled />
              </Field>
              <Field label="Tanggal Input" required error={errors.input_date} hint="Terisi otomatis, dapat disesuaikan">
                <Input type="date" value={form.input_date} onChange={set('input_date')} />
              </Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Klasifikasi</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kategori (Standar)" required error={errors.category_id}>
                <Select value={form.category_id} onChange={set('category_id')}>
                  <option value="">Pilih kategori…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}. {c.category_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subkategori" required={subs.length > 0} error={errors.subcategory_id}>
                <Select value={form.subcategory_id} onChange={set('subcategory_id')} disabled={!category}>
                  <option value="">{category ? 'Pilih subkategori…' : 'Pilih kategori terlebih dahulu'}</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subcategory_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kode Simpan" hint="Kode klasifikasi / lokasi arsip fisik">
                <Input value={form.storage_code} onChange={set('storage_code')} placeholder="mis. A.1 / Lemari 2" maxLength={50} />
              </Field>
              <Field label="Tahun Dokumen" error={errors.document_year}>
                <Input
                  value={form.document_year}
                  onChange={set('document_year')}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="mis. 2026"
                />
              </Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Informasi Dokumen</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nama Dokumen" required error={errors.document_name} className="col-span-2">
                <Input value={form.document_name} onChange={set('document_name')} placeholder="Judul dokumen" maxLength={255} />
              </Field>
              <Field label="Jenis Dokumen" required error={errors.document_type}>
                <Input
                  value={form.document_type}
                  onChange={set('document_type')}
                  list="doc-types"
                  placeholder="mis. Surat Keputusan"
                  maxLength={100}
                />
                <datalist id="doc-types">
                  {typeOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <Field label="Nomor Dokumen">
                <Input value={form.document_number} onChange={set('document_number')} placeholder="Nomor surat / dokumen" maxLength={100} />
              </Field>
              <Field label="Deskripsi" className="col-span-2">
                <Textarea value={form.description} onChange={set('description')} placeholder="Keterangan singkat isi dokumen" maxLength={2000} />
              </Field>
              <Field label="Lampiran" hint="Jenis dan jumlah lampiran, mis. 2 lembar daftar hadir" className="col-span-2">
                <Input value={form.attachment_description} onChange={set('attachment_description')} maxLength={500} />
              </Field>
            </div>
          </section>
        </div>

        <section className="card h-fit p-6 xl:sticky xl:top-0">
          <h2 className="font-semibold text-slate-900">File Dokumen</h2>
          <p className="mt-1 text-xs text-slate-500">Format PDF, maksimal 100 MB per file. Dapat lebih dari satu file.</p>

          <button
            type="button"
            onClick={pickFiles}
            className={cx(
              'mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
              errors.files ? 'border-red-300 bg-red-50/50' : 'border-slate-300 hover:border-navy-400 hover:bg-sky-50/50'
            )}
          >
            <Upload className="size-6 text-navy-600" />
            <span className="mt-2 text-sm font-medium text-slate-800">Pilih file PDF</span>
            <span className="text-xs text-slate-500">Klik untuk membuka penjelajah file</span>
          </button>
          {errors.files && <p className="mt-2 text-xs text-red-600">{errors.files}</p>}

          {totalFiles > 0 && (
            <ul className="mt-4 space-y-2">
              {existingFiles.map((f) => (
                <FileItem
                  key={`e${f.id}`}
                  name={f.original_filename}
                  size={f.file_size}
                  note={f.missing ? 'File tidak ditemukan di penyimpanan' : 'Tersimpan'}
                  warn={f.missing}
                  onRemove={() => setRemoveIds((ids) => [...ids, f.id])}
                />
              ))}
              {newFiles.map((f) => (
                <FileItem
                  key={f.path}
                  name={f.name}
                  size={f.size}
                  note="Baru"
                  isNew
                  onRemove={() => setNewFiles((list) => list.filter((x) => x.path !== f.path))}
                />
              ))}
            </ul>
          )}

          {removedFiles.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <AlertCircle className="size-3.5" /> Akan dihapus saat disimpan:
              </div>
              {removedFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.original_filename}</span>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium hover:underline"
                    onClick={() => setRemoveIds((ids) => ids.filter((x) => x !== f.id))}
                  >
                    <Undo2 className="size-3" /> Batal
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </form>
  );
}

function FileItem({ name, size, note, isNew, warn, onRemove }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800" title={name}>
          {name}
        </div>
        <div className="text-xs text-slate-500">
          {formatBytes(size)} ·{' '}
          <span className={warn ? 'text-amber-700' : isNew ? 'text-sky-700' : ''}>{note}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label={`Hapus ${name}`}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
