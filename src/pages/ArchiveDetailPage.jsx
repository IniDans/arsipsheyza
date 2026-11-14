import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2, Download, ExternalLink, FileText, AlertTriangle } from 'lucide-react';
import { call } from '../lib/api';
import { formatBytes, formatDate, formatDateTime } from '../lib/format';
import { Button, CategoryCode, ConfirmDialog, EmptyState, Spinner, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import PdfViewer from '../components/PdfViewer';

export default function ArchiveDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [a, setA] = useState(null);
  const [active, setActive] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    call('archives:get', id)
      .then((data) => {
        setA(data);
        setActive(data.files.find((f) => !f.missing)?.id ?? data.files[0]?.id ?? null);
      })
      .catch((err) => {
        toast.error(err);
        navigate('/arsip');
      });
  }, [id, navigate, toast]);

  const exportFiles = async (payload) => {
    try {
      const res = await call('files:export', payload);
      if (!res.canceled) toast.success(`${res.count} file disalin ke ${res.location}`);
    } catch (err) {
      toast.error(err);
    }
  };

  const openExternal = async (fileId) => {
    try {
      await call('files:openExternal', fileId);
    } catch (err) {
      toast.error(err);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await call('archives:delete', a.id);
      toast.success(`Arsip ${a.archive_number} telah dihapus.`);
      navigate('/arsip');
    } catch (err) {
      toast.error(err);
      setDeleting(false);
    }
  };

  if (!a) return <Spinner />;
  const activeFile = a.files.find((f) => f.id === active);

  const meta = [
    ['ID Arsip', `#${a.id}`],
    ['Nomor Arsip', a.archive_number],
    ['Tanggal Input', formatDate(a.input_date)],
    ['Jenis Dokumen', a.document_type],
    ['Nomor Dokumen', a.document_number],
    ['Tahun', a.document_year],
    ['Kode Simpan', a.storage_code],
    ['Lampiran', a.attachment_description],
    ['Dibuat oleh', a.created_by_name],
    ['Dibuat', formatDateTime(a.created_at)],
    ['Diperbarui', formatDateTime(a.updated_at)],
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <CategoryCode code={a.category_code} className="mt-1 size-9 text-sm" />
          <div className="min-w-0">
            <div className="text-sm text-slate-500">
              {a.category_name} · {a.subcategory_name || '-'}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{a.document_name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Download} onClick={() => exportFiles({ archiveId: a.id })}>
            Ekspor Semua File
          </Button>
          <Button variant="secondary" icon={Pencil} onClick={() => navigate(`/arsip/${a.id}/edit`)}>
            Edit
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirm(true)}>
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Informasi Arsip</h2>
            <dl className="space-y-2.5 text-sm">
              {meta.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="break-words text-slate-800">{v || '-'}</dd>
                </div>
              ))}
            </dl>
            {a.description && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-1 text-sm text-slate-500">Deskripsi</div>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{a.description}</p>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">File ({a.files.length})</h2>
            <ul className="space-y-2">
              {a.files.map((f) => (
                <li
                  key={f.id}
                  className={cx(
                    'rounded-lg border p-2.5 transition-colors',
                    f.id === active ? 'border-navy-300 bg-sky-50/60' : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setActive(f.id)}>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600">
                      {f.missing ? <AlertTriangle className="size-4 text-amber-600" /> : <FileText className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800" title={f.original_filename}>
                        {f.original_filename}
                      </div>
                      <div className="text-xs text-slate-500">
                        {f.missing ? <span className="text-amber-700">File hilang dari penyimpanan</span> : formatBytes(f.file_size)}
                      </div>
                    </div>
                  </button>
                  {!f.missing && (
                    <div className="mt-2 flex gap-1 pl-11">
                      <Button size="sm" variant="ghost" icon={ExternalLink} onClick={() => openExternal(f.id)}>
                        Buka di aplikasi lain
                      </Button>
                      <Button size="sm" variant="ghost" icon={Download} onClick={() => exportFiles({ fileIds: [f.id] })}>
                        Simpan
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="h-[calc(100vh-11rem)] min-h-[520px]">
          {activeFile && !activeFile.missing ? (
            <PdfViewer fileId={activeFile.id} />
          ) : (
            <div className="card flex h-full items-center justify-center">
              <EmptyState
                icon={AlertTriangle}
                title="Pratinjau tidak tersedia"
                description="File PDF tidak ditemukan di folder penyimpanan. Pulihkan dari backup atau unggah ulang melalui menu Edit."
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Hapus arsip?"
        message={`Arsip ${a.archive_number} beserta ${a.files.length} file PDF-nya akan dihapus permanen.`}
        loading={deleting}
        onClose={() => setConfirm(false)}
        onConfirm={doDelete}
      />
    </>
  );
}
