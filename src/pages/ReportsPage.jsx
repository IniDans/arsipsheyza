import { useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Printer, Play, FileBarChart } from 'lucide-react';
import { call } from '../lib/api';
import { formatDate, formatDateTime, formatNumber, todayIso } from '../lib/format';
import { Button, EmptyState, Field, Input, PageHeader, Select, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';

const TYPES = [
  { id: 'all', label: 'Seluruh arsip' },
  { id: 'category', label: 'Per kategori' },
  { id: 'subcategory', label: 'Per subkategori' },
  { id: 'period', label: 'Per periode' },
  { id: 'year', label: 'Per tahun' },
];

export default function ReportsPage() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);
  const now = new Date();
  const [params, setParams] = useState({
    type: 'all',
    category_id: '',
    subcategory_id: '',
    date_from: `${now.getFullYear()}-01-01`,
    date_to: todayIso(),
    year: String(now.getFullYear()),
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    Promise.all([call('categories:list'), call('archives:filterOptions')])
      .then(([c, o]) => {
        setCategories(c);
        setYears(o.years);
      })
      .catch(toast.error);
  }, [toast]);

  const subs = useMemo(
    () => categories.find((c) => String(c.id) === String(params.category_id))?.subcategories || [],
    [categories, params.category_id]
  );

  const set = (k) => (e) => {
    const v = e.target.value;
    setParams((p) => ({ ...p, [k]: v, ...(k === 'category_id' ? { subcategory_id: '' } : {}) }));
    setReport(null);
  };

  const payload = () => {
    const p = { type: params.type };
    if (params.type === 'category') p.category_id = params.category_id;
    if (params.type === 'subcategory') p.subcategory_id = params.subcategory_id;
    if (params.type === 'period') Object.assign(p, { date_from: params.date_from, date_to: params.date_to });
    if (params.type === 'year') p.year = params.year;
    return p;
  };

  const preview = async () => {
    setLoading(true);
    try {
      setReport(await call('reports:query', payload()));
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };

  const action = async (channel, key) => {
    setBusy(key);
    try {
      const res = await call(channel, payload());
      if (res && !res.canceled && res.location) toast.success(`Laporan disimpan: ${res.location}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  const disabled = !!busy || !report || report.rows.length === 0;

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Susun laporan arsip, lalu ekspor ke PDF atau Excel, atau cetak langsung."
        actions={
          <>
            <Button variant="secondary" icon={Printer} loading={busy === 'print'} disabled={disabled} onClick={() => action('reports:print', 'print')}>
              Cetak
            </Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'xlsx'} disabled={disabled} onClick={() => action('reports:exportXlsx', 'xlsx')}>
              Ekspor Excel
            </Button>
            <Button icon={FileDown} loading={busy === 'pdf'} disabled={disabled} onClick={() => action('reports:exportPdf', 'pdf')}>
              Ekspor PDF
            </Button>
          </>
        }
      />

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Jenis laporan" className="w-56">
            <Select value={params.type} onChange={set('type')}>
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          {(params.type === 'category' || params.type === 'subcategory') && (
            <Field label="Kategori" className="w-72">
              <Select value={params.category_id} onChange={set('category_id')}>
                <option value="">Pilih kategori…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}. {c.category_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {params.type === 'subcategory' && (
            <Field label="Subkategori" className="w-64">
              <Select value={params.subcategory_id} onChange={set('subcategory_id')} disabled={!params.category_id}>
                <option value="">Pilih subkategori…</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subcategory_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {params.type === 'period' && (
            <>
              <Field label="Dari tanggal" className="w-44">
                <Input type="date" value={params.date_from} onChange={set('date_from')} />
              </Field>
              <Field label="Sampai tanggal" className="w-44">
                <Input type="date" value={params.date_to} onChange={set('date_to')} />
              </Field>
            </>
          )}
          {params.type === 'year' && (
            <Field label="Tahun dokumen" className="w-40">
              <Input
                type="number"
                min="1900"
                max="2200"
                list="report-years"
                value={params.year}
                onChange={set('year')}
              />
              <datalist id="report-years">
                {years.map((y) => (
                  <option key={y} value={y} />
                ))}
              </datalist>
            </Field>
          )}
          <Button variant="soft" icon={Play} onClick={preview} loading={loading}>
            Tampilkan
          </Button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : !report ? (
          <EmptyState
            icon={FileBarChart}
            title="Pratinjau laporan"
            description="Pilih jenis laporan lalu klik Tampilkan untuk melihat isinya sebelum diekspor atau dicetak."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{report.title}</h2>
                <p className="text-sm text-slate-500">{report.subtitle}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div className="text-sm font-medium text-slate-800">{formatNumber(report.rows.length)} arsip</div>
                Disusun {formatDateTime(report.generatedAt)}
              </div>
            </div>
            {report.rows.length === 0 ? (
              <EmptyState title="Tidak ada data" description="Tidak ada arsip yang sesuai dengan kriteria laporan ini." />
            ) : (
              <>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="table-base">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="w-12">No</th>
                        <th>Nomor Arsip</th>
                        <th>Tgl. Input</th>
                        <th>Kategori / Subkategori</th>
                        <th>Jenis</th>
                        <th>Nomor Dokumen</th>
                        <th>Nama Dokumen</th>
                        <th>Tahun</th>
                        <th>Kode Simpan</th>
                        <th className="text-right">File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={r.id}>
                          <td className="text-slate-500 tabular-nums">{i + 1}</td>
                          <td className="whitespace-nowrap tabular-nums">{r.archive_number}</td>
                          <td className="whitespace-nowrap">{formatDate(r.input_date, true)}</td>
                          <td className="text-xs">
                            <div className="text-slate-700">
                              {r.category_code}. {r.category_name.replace(/^Standar /, '')}
                            </div>
                            <div className="text-slate-500">{r.subcategory_name || '-'}</div>
                          </td>
                          <td>{r.document_type}</td>
                          <td>{r.document_number || '-'}</td>
                          <td className="min-w-56 font-medium text-slate-800">{r.document_name}</td>
                          <td className="tabular-nums">{r.document_year || '-'}</td>
                          <td>{r.storage_code || '-'}</td>
                          <td className="text-right tabular-nums">{r.file_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.summary.length > 1 && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Rekapitulasi per kategori</h3>
                    <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                      {report.summary.map((s) => (
                        <div key={s.category} className="flex justify-between border-b border-dashed border-slate-100 py-1">
                          <span className="text-slate-600">{s.category}</span>
                          <span className="font-medium text-slate-800 tabular-nums">{formatNumber(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
