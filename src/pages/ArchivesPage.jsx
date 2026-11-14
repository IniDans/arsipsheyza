import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, SlidersHorizontal, X, FileText, FolderSearch } from 'lucide-react';
import { call } from '../lib/api';
import { formatDate } from '../lib/format';
import { Button, CategoryCode, ConfirmDialog, EmptyState, Input, PageHeader, Pagination, Select, Spinner, cx } from '../components/ui';
import { useToast } from '../components/Toast';

const EMPTY = { category_id: '', subcategory_id: '', year: '', document_type: '', date_from: '', date_to: '' };

export default function ArchivesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [options, setOptions] = useState({ documentTypes: [], years: [] });
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({
    ...EMPTY,
    category_id: params.get('kategori') || '',
    subcategory_id: params.get('kategori') ? params.get('subkategori') || '' : '',
  });
  const [showFilters, setShowFilters] = useState(!!params.get('kategori'));
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([call('categories:list'), call('archives:filterOptions')])
      .then(([c, o]) => {
        setCategories(c);
        setOptions(o);
      })
      .catch(toast.error);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword), 250);
    return () => clearTimeout(t);
  }, [keyword]);

  const load = useCallback(async () => {
    try {
      setResult(await call('archives:list', { ...filters, keyword: debounced, sort, page, pageSize }));
    } catch (err) {
      toast.error(err);
    }
  }, [filters, debounced, sort, page, pageSize, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (k) => (e) => {
    const v = e.target.value;
    setFilters((f) => ({ ...f, [k]: v, ...(k === 'category_id' ? { subcategory_id: '' } : {}) }));
    setPage(1);
  };

  const subs = useMemo(
    () => categories.find((c) => String(c.id) === String(filters.category_id))?.subcategories || [],
    [categories, filters.category_id]
  );
  const activeCount = Object.values(filters).filter(Boolean).length;

  const doDelete = async () => {
    setDeleting(true);
    try {
      await call('archives:delete', toDelete.id);
      toast.success(`Arsip ${toDelete.archive_number} telah dihapus.`);
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Data Arsip"
        description="Kelola seluruh dokumen arsip perusahaan."
        actions={
          <Button icon={Plus} onClick={() => navigate('/arsip/baru')}>
            Tambah Arsip
          </Button>
        }
      />

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-72 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, nomor dokumen, nomor arsip, jenis, kode simpan…"
              className="pl-9"
            />
          </div>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-48" aria-label="Urutkan">
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="name">Nama dokumen (A–Z)</option>
            <option value="number">Nomor arsip</option>
          </Select>
          <Button variant={showFilters || activeCount ? 'soft' : 'secondary'} icon={SlidersHorizontal} onClick={() => setShowFilters((s) => !s)}>
            Filter{activeCount ? ` (${activeCount})` : ''}
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-3 xl:grid-cols-6">
            <Select value={filters.category_id} onChange={setFilter('category_id')} aria-label="Kategori">
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}. {c.category_name}
                </option>
              ))}
            </Select>
            <Select value={filters.subcategory_id} onChange={setFilter('subcategory_id')} disabled={!filters.category_id} aria-label="Subkategori">
              <option value="">Semua subkategori</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subcategory_name}
                </option>
              ))}
            </Select>
            <Select value={filters.document_type} onChange={setFilter('document_type')} aria-label="Jenis dokumen">
              <option value="">Semua jenis dokumen</option>
              {options.documentTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select value={filters.year} onChange={setFilter('year')} aria-label="Tahun dokumen">
              <option value="">Semua tahun</option>
              {options.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Dari
              <Input type="date" value={filters.date_from} onChange={setFilter('date_from')} />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              s.d.
              <Input type="date" value={filters.date_to} onChange={setFilter('date_to')} />
            </label>
            {activeCount > 0 && (
              <div className="col-span-full">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={X}
                  onClick={() => {
                    setFilters(EMPTY);
                    setPage(1);
                  }}
                >
                  Hapus semua filter
                </Button>
              </div>
            )}
          </div>
        )}

        {!result ? (
          <Spinner />
        ) : result.rows.length === 0 ? (
          debounced || activeCount ? (
            <EmptyState icon={FolderSearch} title="Arsip tidak ditemukan" description="Coba kata kunci lain atau ubah filter pencarian." />
          ) : (
            <EmptyState
              title="Belum ada arsip"
              description="Tambahkan dokumen PDF pertama untuk mulai mengarsipkan."
              action={
                <Button size="sm" icon={Plus} onClick={() => navigate('/arsip/baru')}>
                  Tambah Arsip
                </Button>
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nomor Arsip</th>
                    <th>Dokumen</th>
                    <th>Kategori</th>
                    <th>Tgl. Input</th>
                    <th>Tahun</th>
                    <th>Kode Simpan</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="font-medium whitespace-nowrap text-slate-700 tabular-nums">{a.archive_number}</td>
                      <td className="max-w-md">
                        <Link to={`/arsip/${a.id}`} className="font-medium text-slate-900 hover:text-navy-700">
                          {a.document_name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          <span>{a.document_type}</span>
                          {a.document_number && <span>· No. {a.document_number}</span>}
                          <span className="inline-flex items-center gap-1">
                            · <FileText className="size-3" /> {a.file_count} file
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-start gap-2">
                          <CategoryCode code={a.category_code} className="size-6 text-[11px]" />
                          <div className="text-xs">
                            <div className="text-slate-700">{a.category_name}</div>
                            <div className="text-slate-500">{a.subcategory_name || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-slate-600">{formatDate(a.input_date, true)}</td>
                      <td className="text-slate-600 tabular-nums">{a.document_year || '-'}</td>
                      <td className="text-slate-600">{a.storage_code || '-'}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <ActionIcon title="Lihat" icon={Eye} onClick={() => navigate(`/arsip/${a.id}`)} />
                          <ActionIcon title="Edit" icon={Pencil} onClick={() => navigate(`/arsip/${a.id}/edit`)} />
                          <ActionIcon title="Hapus" icon={Trash2} danger onClick={() => setToDelete(a)} />
                        </div>
                      </td>
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
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Hapus arsip?"
        message={
          <>
            Arsip <b className="text-slate-800">{toDelete?.archive_number}</b> — {toDelete?.document_name} beserta{' '}
            {toDelete?.file_count} file PDF-nya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </>
        }
        loading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
      />
    </>
  );
}

function ActionIcon({ icon: Icon, title, onClick, danger }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cx(
        'rounded-md p-1.5 text-slate-500 transition-colors',
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-navy-700'
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
