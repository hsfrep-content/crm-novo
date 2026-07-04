import { useEffect } from 'react';

export function Button({ variant = 'primary', className = '', ...props }) {
  const variants = {
    primary:
      'bg-accent-600 text-cream hover:bg-accent-700 shadow-sm shadow-accent-600/20 disabled:opacity-50 dark:bg-cream dark:text-accent-700 dark:shadow-none dark:hover:bg-white',
    secondary:
      'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
    danger: 'text-signal-600 hover:bg-signal-50 dark:hover:bg-signal-500/10',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition-shadow placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', ...props }) {
  return (
    <select
      className={`rounded-lg border-0 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10 ${className}`}
      {...props}
    />
  );
}

export function Badge({ tone = 'zinc', className = '', ...props }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    rose: 'bg-signal-50 text-signal-700 dark:bg-signal-500/15 dark:text-signal-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 p-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-white p-5 shadow-xl ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            aria-label="Fechar"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      {subtitle && <p className="text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>}
    </div>
  );
}
