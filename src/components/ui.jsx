import { forwardRef, useEffect } from 'react';
import { LoaderCircle, X, AlertTriangle, Inbox } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 shadow-xs',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-xs',
  soft: 'bg-sky-50 text-navy-800 hover:bg-sky-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};
const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('input', className)} {...props} />;
});

export function Select({ className, children, ...props }) {
  return (
    <select className={cx('input pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx('input', className)} rows={3} {...props} />;
}

export function Badge({ color = 'slate', children, className }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    navy: 'bg-navy-100 text-navy-800',
    sky: 'bg-sky-100 text-sky-800',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', colors[color], className)}>
      {children}
    </span>
  );
}

export function CategoryCode({ code, className }) {
  return (
    <span
      className={cx(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-navy-900 text-xs font-semibold text-white',
        className
      )}
    >
      {code}
    </span>
  );
}

export function Spinner({ label = 'Memuat…', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-2 py-12 text-sm text-slate-500', className)}>
      <LoaderCircle className="size-5 animate-spin text-navy-600" />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-sky-50 text-navy-600">
        <Icon className="size-6" />
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissable = true }) {
  useEffect(() => {
    if (!open || !dismissable) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[1px]" onClick={dismissable ? onClose : undefined} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx('relative flex max-h-full w-full flex-col rounded-xl bg-white shadow-xl', widths[size])}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Hapus', onConfirm, onClose, loading, tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      dismissable={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className={cx(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          )}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div className="pt-1 text-sm text-slate-600">{message}</div>
      </div>
    </Modal>
  );
}

export function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = start; i <= Math.min(pages, start + 4); i += 1) nums.push(i);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <div className="flex items-center gap-3">
        <span>
          {from}–{to} dari {total.toLocaleString('id-ID')}
        </span>
        {onPageSize && (
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Jumlah baris per halaman"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / halaman
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Sebelumnya
        </Button>
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            className={cx(
              'h-8 min-w-8 rounded-md px-2 text-xs font-medium',
              n === page ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {n}
          </button>
        ))}
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
