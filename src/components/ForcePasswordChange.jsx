import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Modal } from './ui';
import ChangePasswordForm from './ChangePasswordForm';

// Ditampilkan saat akun masih memakai password awal (dibuat oleh admin / default).
export default function ForcePasswordChange() {
  const { refreshUser, logout } = useAuth();
  const toast = useToast();
  return (
    <Modal
      open
      dismissable={false}
      title="Ganti password terlebih dahulu"
      description="Akun Anda masih menggunakan password awal. Demi keamanan arsip, buat password baru."
      size="sm"
    >
      <ChangePasswordForm
        submitLabel="Simpan & Lanjutkan"
        onDone={async () => {
          toast.success('Password berhasil diperbarui.');
          await refreshUser();
        }}
      />
      <button type="button" onClick={logout} className="mt-4 text-sm text-slate-500 hover:text-slate-700">
        Keluar
      </button>
    </Modal>
  );
}
