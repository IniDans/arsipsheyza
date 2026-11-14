import { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import {
  LayoutDashboard,
  FolderArchive,
  Layers,
  FileBarChart,
  Users,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { ConfirmDialog, cx } from './ui';
import { ROLE_LABEL } from '../lib/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/arsip', label: 'Data Arsip', icon: FolderArchive },
  { to: '/kategori', label: 'Kategori Arsip', icon: Layers },
  { to: '/laporan', label: 'Laporan', icon: FileBarChart },
  { to: '/pengguna', label: 'Manajemen Pengguna', icon: Users, admin: true },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
];

const CRUMBS = [
  [/^\/arsip\/baru$/, [['Data Arsip', '/arsip'], ['Tambah Arsip']]],
  [/^\/arsip\/\d+\/edit$/, [['Data Arsip', '/arsip'], ['Detail Arsip', (p) => p.replace(/\/edit$/, '')], ['Edit Arsip']]],
  [/^\/arsip\/\d+$/, [['Data Arsip', '/arsip'], ['Detail Arsip']]],
  [/^\/arsip$/, [['Data Arsip']]],
  [/^\/kategori$/, [['Kategori Arsip']]],
  [/^\/laporan$/, [['Laporan']]],
  [/^\/pengguna$/, [['Manajemen Pengguna']]],
  [/^\/pengaturan$/, [['Pengaturan']]],
  [/^\/$/, [['Dashboard']]],
];

function Breadcrumb() {
  const { pathname } = useLocation();
  const match = CRUMBS.find(([re]) => re.test(pathname));
  const items = match ? match[1] : [];
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
      <Link to="/" className="hover:text-navy-700">
        Beranda
      </Link>
      {items.map(([label, to], i) => {
        const href = typeof to === 'function' ? to(pathname) : to;
        const last = i === items.length - 1;
        return (
          <span key={label} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-slate-400" />
            {href && !last ? (
              <Link to={href} className="hover:text-navy-700">
                {label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-slate-800' : ''}>{label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const { user, info, logout, isAdmin } = useAuth();
  const [confirmOut, setConfirmOut] = useState(false);
  const location = useLocation();
  const initials = (user?.full_name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col bg-navy-950 text-navy-100">
        <div className="px-5 pt-6 pb-5">
          <Logo name={info.app_name} />
        </div>
        {info.school_name && (
          <div className="mx-4 mb-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-navy-200">
            <div className="text-[10px] tracking-wider text-navy-300 uppercase">Sekolah</div>
            <div className="truncate font-medium text-white" title={info.school_name}>
              {info.school_name}
            </div>
          </div>
        )}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.filter((n) => !n.admin || isAdmin).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-sky-400/15 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cx('size-[18px]', isActive ? 'text-sky-300' : 'text-navy-300')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 px-2 py-1.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-sky-400 text-sm font-semibold text-navy-950">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user?.full_name}</div>
              <div className="text-xs text-navy-300">{ROLE_LABEL[user?.role]}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-200 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-[18px] text-navy-300" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-8">
          <Breadcrumb />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-8 py-7">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmOut}
        title="Keluar dari aplikasi?"
        message="Anda perlu login kembali untuk mengakses data arsip."
        confirmLabel="Logout"
        tone="warning"
        onClose={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          logout();
        }}
      />
    </div>
  );
}
