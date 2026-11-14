import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { Spinner } from './components/ui';
import Layout from './components/Layout';
import ForcePasswordChange from './components/ForcePasswordChange';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ArchivesPage from './pages/ArchivesPage';
import ArchiveFormPage from './pages/ArchiveFormPage';
import ArchiveDetailPage from './pages/ArchiveDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

function Shell() {
  const { user, ready, isAdmin } = useAuth();
  if (!ready) return <Spinner className="h-full" label="Menyiapkan ARSIPKU…" />;
  if (!user) return <LoginPage />;
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="arsip" element={<ArchivesPage />} />
          <Route path="arsip/baru" element={<ArchiveFormPage />} />
          <Route path="arsip/:id" element={<ArchiveDetailPage />} />
          <Route path="arsip/:id/edit" element={<ArchiveFormPage />} />
          <Route path="kategori" element={<CategoriesPage />} />
          <Route path="laporan" element={<ReportsPage />} />
          <Route path="pengguna" element={isAdmin ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="pengaturan" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {user.must_change_password && <ForcePasswordChange />}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
