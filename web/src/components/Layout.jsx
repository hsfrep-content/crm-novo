import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useIntegrationStatus } from '../context/StatusContext';
import { fmtDate } from '../lib';

const NAV = [
  { to: '/', label: 'Funil', icon: 'M3 4h13M3 8h9M3 12h5' },
  { to: '/contatos', label: 'Contatos', icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0' },
  { to: '/dashboard', label: 'Dashboard', icon: 'M2 13h3V7H2v6zm4.5 0h3V3h-3v10zM11 13h3V9h-3v4z' },
  { to: '/integracoes', label: 'Integrações', icon: 'M6 2v4M10 2v4M4 6h8v3a4 4 0 01-8 0V6zM8 13v1' },
  { to: '/configuracoes', label: 'Configurações', icon: 'M8 10a2 2 0 100-4 2 2 0 000 4zM8 1v2m0 10v2M1 8h2m10 0h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.theme = next ? 'dark' : 'light';
  };
  return (
    <button
      onClick={toggle}
      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? (
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1m11.9-4.9l-1 1M3.1 12.9l1-1m8.8 1l-1-1M3.1 3.1l1 1" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 107 7z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function IntegrationBanners() {
  const { status } = useIntegrationStatus() ?? {};
  const tecimob = status?.tecimob;
  if (!tecimob?.lastError) return null;

  if (tecimob.lastError.code === 'auth') {
    return (
      <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
        <span className="font-medium">Chave de API inválida</span> — reconecte em{' '}
        <Link to="/configuracoes" className="font-medium underline underline-offset-2">
          Configurações
        </Link>
      </div>
    );
  }
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      Sincronização com a Tecimob indisponível no momento
      {tecimob.lastSyncAt ? ` — últimos dados salvos às ${fmtDate(tecimob.lastSyncAt)}` : ''}. O CRM
      segue funcionando com os dados locais.
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60'
            }`
          }
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon} />
          </svg>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-zinc-200 bg-white pt-4 md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-2 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white shadow-sm shadow-accent-600/30">
            I
          </div>
          <span className="text-sm font-semibold tracking-tight">Imobi CRM</span>
        </div>
        {nav}
        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">v1.0</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" />
          <aside
            className="absolute inset-y-0 left-0 w-64 bg-white pt-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 px-5 text-sm font-semibold">Imobi CRM</div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:pl-56">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 py-2.5 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/80">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-sm font-semibold">Imobi CRM</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <IntegrationBanners />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
