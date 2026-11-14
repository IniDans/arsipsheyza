import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, CalendarPlus, ChevronRight, FileText, Layers, Plus, Activity, ArrowRight } from 'lucide-react';
import { call } from '../lib/api';
import { formatBytes, formatDate, formatDateTime, formatMonth, formatNumber } from '../lib/format';
import { Button, CategoryCode, EmptyState, PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-navy-700">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// Distribusi arsip per sistem: batang horizontal per kategori, dapat dibuka
// untuk melihat rincian per subkategori (skala sama dengan batang kategori).
function SystemBars({ data, onSelectCategory, onSelectSub }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const total = data.reduce((s, d) => s + d.total, 0);
  const [open, setOpen] = useState(() => {
    const top = [...data].sort((x, y) => y.total - x.total)[0];
    return new Set(top && top.total > 0 ? [top.id] : []);
  });
  const toggle = (id) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const bar = (value, cls) => (
    <span className="relative h-3.5 rounded bg-slate-100">
      <span
        className={`absolute inset-y-0 left-0 rounded-r transition-all ${cls}`}
        style={{ width: value ? `max(${(value / max) * 100}%, 4px)` : 0 }}
      />
    </span>
  );
  const row = 'grid w-full grid-cols-[minmax(0,15rem)_1fr_4.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50';

  return (
    <div className="space-y-1">
      {data.map((d) => {
        const pct = total ? Math.round((d.total / total) * 100) : 0;
        const isOpen = open.has(d.id);
        const subs = d.subcategories || [];
        return (
          <div key={d.id}>
            <button
              type="button"
              onClick={() => (subs.length ? toggle(d.id) : onSelectCategory(d))}
              aria-expanded={subs.length ? isOpen : undefined}
              title={`${d.category_name}: ${formatNumber(d.total)} arsip (${pct}%)`}
              className={`group ${row}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChevronRight
                  className={`size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''} ${subs.length ? '' : 'invisible'}`}
                />
                <CategoryCode code={d.code} className="size-6 text-[11px]" />
                <span className="truncate text-sm font-medium text-slate-800">{d.category_name}</span>
              </span>
              {bar(d.total, 'bg-navy-700 group-hover:bg-navy-900')}
              <span className="text-right text-sm text-slate-700 tabular-nums">
                {formatNumber(d.total)}
                <span className="ml-1 text-xs text-slate-400">{pct}%</span>
              </span>
            </button>
            {isOpen && (
              <div className="mb-2 ml-4 border-l border-slate-200 pl-2">
                {subs.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectSub(d, s)}
                    title={`${s.subcategory_name}: ${formatNumber(s.total)} arsip`}
                    className={`group ${row} py-1`}
                  >
                    <span className="truncate pl-6 text-[13px] text-slate-600">{s.subcategory_name}</span>
                    {bar(s.total, 'bg-sky-400 group-hover:bg-sky-500')}
                    <span className="text-right text-[13px] text-slate-600 tabular-nums">{formatNumber(s.total)}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onSelectCategory(d)}
                  className="mt-0.5 ml-8 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-navy-700 hover:text-navy-900"
                >
                  Lihat semua arsip {d.category_name} <ArrowRight className="size-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Tren arsip 12 bulan: satu seri, batang vertikal dengan tooltip saat hover.
function MonthlyBars({ data }) {
  const [hover, setHover] = useState(null);
  const peak = Math.max(1, ...data.map((d) => d.total));
  const max = peak <= 1 ? 2 : Math.ceil(peak / 2) * 2; // genap agar garis tengah bernilai bulat
  const ticks = [max, max / 2, 0];
  return (
    <div className="flex h-56 gap-3">
      <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-slate-400 tabular-nums">
        {ticks.map((t, i) => (
          <span key={i}>{formatNumber(t)}</span>
        ))}
      </div>
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden="true">
          {ticks.map((_, i) => (
            <div key={i} className="border-t border-dashed border-slate-200" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-stretch gap-1">
          {data.map((d, i) => (
            <div
              key={d.month}
              className="relative flex flex-1 flex-col"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="relative flex flex-1 items-end justify-center">
                {hover === i && <div className="absolute inset-0 rounded bg-slate-100/70" />}
                <div
                  className="relative w-3/5 max-w-6 rounded-t bg-navy-700"
                  style={{ height: d.total ? `max(${(d.total / max) * 100}%, 3px)` : 0 }}
                />
                {hover === i && (
                  <div className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg bg-navy-950 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg">
                    <div className="text-navy-200">{formatMonth(d.month)}</div>
                    <div className="font-semibold tabular-nums">{formatNumber(d.total)} arsip</div>
                  </div>
                )}
              </div>
              <div className="h-6 pt-1.5 text-center text-[11px] text-slate-400">{formatMonth(d.month).split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    call('dashboard:get').then(setData).catch(toast.error);
  }, [toast]);

  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';

  return (
    <>
      <PageHeader
        title={`${greet}, ${user.full_name.split(' ')[0]}`}
        description="Ringkasan arsip perusahaan yang tersimpan di komputer ini."
        actions={
          <Button icon={Plus} onClick={() => navigate('/arsip/baru')}>
            Tambah Arsip
          </Button>
        }
      />
      {!data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={Archive} label="Total Arsip" value={formatNumber(data.totalArchives)} sub="Seluruh dokumen tercatat" />
            <StatCard
              icon={CalendarPlus}
              label="Arsip Bulan Ini"
              value={formatNumber(data.thisMonth)}
              sub="Berdasarkan tanggal input"
            />
            <StatCard
              icon={Layers}
              label="Kategori Terisi"
              value={`${data.categoriesUsed} / ${data.byCategory.length}`}
              sub="Kategori yang memiliki arsip"
            />
            <StatCard
              icon={FileText}
              label="File PDF Tersimpan"
              value={formatNumber(data.totalFiles)}
              sub={`Total ukuran ${formatBytes(data.totalFileSize)}`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <section className="card p-5 xl:col-span-3">
              <div className="mb-4 flex items-baseline justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">Distribusi Arsip per Sistem</h2>
                  <p className="text-xs text-slate-500">Jumlah arsip per kategori. Buka kategori untuk melihat rincian subkategori.</p>
                </div>
              </div>
              <SystemBars
                data={data.byCategory}
                onSelectCategory={(d) => navigate(`/arsip?kategori=${d.id}`)}
                onSelectSub={(d, sub) => navigate(`/arsip?kategori=${d.id}&subkategori=${sub.id}`)}
              />
            </section>

            <section className="card p-5 xl:col-span-2">
              <h2 className="font-semibold text-slate-900">Tren Pengarsipan</h2>
              <p className="mb-4 text-xs text-slate-500">Jumlah arsip per bulan, 12 bulan terakhir.</p>
              <MonthlyBars data={data.monthly} />
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="card">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Arsip Terbaru</h2>
                <Link to="/arsip" className="flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-navy-900">
                  Lihat semua <ArrowRight className="size-3.5" />
                </Link>
              </div>
              {data.recentArchives.length === 0 ? (
                <EmptyState
                  title="Belum ada arsip"
                  description="Mulai dengan menambahkan dokumen pertama perusahaan Anda."
                  action={
                    <Button size="sm" icon={Plus} onClick={() => navigate('/arsip/baru')}>
                      Tambah Arsip
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentArchives.map((a) => (
                    <li key={a.id}>
                      <Link to={`/arsip/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <CategoryCode code={a.category_code} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-800">{a.document_name}</div>
                          <div className="text-xs text-slate-500">
                            {a.archive_number} · {formatDate(a.input_date, true)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Aktivitas Terbaru</h2>
              </div>
              {data.recentActivity.length === 0 ? (
                <EmptyState icon={Activity} title="Belum ada aktivitas" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentActivity.map((l) => (
                    <li key={l.id} className="flex gap-3 px-5 py-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-700">
                          <span className="font-medium text-slate-900">{l.activity}</span>
                          <span className="text-slate-400"> · {l.user_name || 'Sistem'}</span>
                        </div>
                        <div className="truncate text-xs text-slate-500" title={l.description}>
                          {l.description}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateTime(l.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
