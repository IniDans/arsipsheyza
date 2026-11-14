import { useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck, WifiOff, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input } from '../components/ui';
import { Logo } from '../components/Logo';

export default function LoginPage() {
  const { login, info } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-navy-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-40 -bottom-40 size-[520px] rounded-full bg-sky-400/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-sky-400/5"
          aria-hidden="true"
        />
        <Logo name={info.app_name} />
        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold">
            Satu aplikasi untuk seluruh arsip perusahaan yang tertata.
          </h1>
          <p className="mt-4 text-navy-200">
            Simpan, klasifikasikan, cari, dan laporkan dokumen keuangan, perusahaan, dan karyawan langsung dari komputer ini.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-navy-100">
            <li className="flex items-center gap-3">
              <WifiOff className="size-4 text-sky-300" /> Berjalan sepenuhnya tanpa internet
            </li>
            <li className="flex items-center gap-3">
              <Layers className="size-4 text-sky-300" /> Terstruktur: Keuangan, Data Perusahaan, Data Karyawan
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-sky-300" /> Data tersimpan lokal dengan backup & restore
            </li>
          </ul>
        </div>
        <div className="relative text-xs text-navy-300">
          {info.company_name} {info.version && `· Versi ${info.version}`}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo name={info.app_name} dark />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Masuk</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh administrator perusahaan.</p>

          <div className="mt-8 space-y-4">
            <Field label="Username">
              <Input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Masukkan username"
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          </div>

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

          <Button type="submit" className="mt-6 w-full justify-center" loading={loading} icon={LogIn}>
            Masuk
          </Button>
        </form>
      </div>
    </div>
  );
}
