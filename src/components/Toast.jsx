import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, cls: 'text-emerald-600' },
  error: { icon: XCircle, cls: 'text-red-600' },
  info: { icon: Info, cls: 'text-navy-600' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (type, message, title) => {
      idRef.current += 1;
      const id = idRef.current;
      setItems((list) => [...list.slice(-3), { id, type, message, title }]);
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m, t) => push('success', m, t),
      error: (m, t) => push('error', m instanceof Error ? m.message : m, t),
      info: (m, t) => push('info', m, t),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-96 flex-col gap-2" aria-live="polite">
        {items.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${cls}`} />
              <div className="min-w-0 flex-1 text-sm">
                {t.title && <p className="font-medium text-slate-900">{t.title}</p>}
                <p className="break-words text-slate-600">{t.message}</p>
              </div>
              <button
                type="button"
                className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                onClick={() => dismiss(t.id)}
                aria-label="Tutup notifikasi"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
