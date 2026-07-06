import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useIntegrationStatus } from '../context/StatusContext';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../lib';
import { BRAND } from '../brand';

// Lockup da marca no estilo da logomarca A&L: monograma fino com o tique
// vermelho, divisor vertical e o nome do produto em caixa alta espaçada.
export function BrandLockup({ light = true }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`font-brand relative text-[26px] font-light leading-none tracking-wide ${light ? 'text-cream' : 'text-accent-600'}`}>
        A<span className="relative">
          &amp;
          <span className="absolute -left-[3px] bottom-[2px] h-[11px] w-[2px] rotate-[22deg] rounded-full bg-signal-500" aria-hidden="true" />
        </span>L
      </span>
      <span className={`h-7 w-px ${light ? 'bg-cream/25' : 'bg-accent-600/25'}`} aria-hidden="true" />
      <span className={`flex flex-col text-[9px] font-semibold uppercase leading-[1.5] tracking-[0.22em] ${light ? 'text-cream/80' : 'text-accent-600/80'}`}>
        <span>{BRAND.product}</span>
        <span className={light ? 'text-cream/45' : 'text-accent-600/50'}>{BRAND.tagline}</span>
      </span>
    </div>
  );
}

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
      className="rounded-lg p-2 text-cream/50 transition-colors hover:bg-white/10 hover:text-cream"
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

function UserFooter() {
  const { enabled, user, logout } = useAuth() ?? {};
  if (!enabled || !user) return <span className="text-[10px] uppercase tracking-[0.18em] text-cream/35">{BRAND.domain}</span>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {user.picture ? (
        <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full ring-1 ring-white/20" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-cream">
          {user.name?.[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="truncate text-xs text-cream/70" title={user.email}>{user.name}</span>
      <button
        onClick={logout}
        title="Sair"
        className="ml-auto rounded-md p-1 text-cream/40 hover:bg-white/10 hover:text-cream"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 14H3V2h3M10 11l3-3-3-3M13 8H6" />
        </svg>
      </button>
    </div>
  );
}

function IntegrationBanners() {
  const { status } = useIntegrationStatus() ?? {};
  const { enabled: authOn, loading: authLoading } = useAuth() ?? {};
  const tecimob = status?.tecimob;

  const authWarning = !authLoading && authOn === false && (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      <span className="font-medium">CRM sem login</span> — qualquer pessoa com o link acessa. Para
      ativar, defina no servidor as variáveis <code className="text-xs">ALLOWED_EMAILS</code> e{' '}
      <code className="text-xs">LOGIN_PASSWORD</code> (e-mail + senha) e/ou{' '}
      <code className="text-xs">GOOGLE_CLIENT_ID</code> (conta Google) — passo a passo no README.
    </div>
  );

  if (!tecimob?.lastError) return authWarning || null;

  const tecimobBanner =
    tecimob.lastError.code === 'auth' ? (
      <div className="flex items-center gap-2 border-b border-signal-200 bg-signal-50 px-4 py-2 text-sm text-signal-700 dark:border-signal-500/20 dark:bg-signal-500/10 dark:text-signal-300">
        <span className="font-medium">Chave de API inválida</span> — reconecte em{' '}
        <Link to="/configuracoes" className="font-medium underline underline-offset-2">
          Configurações
        </Link>
      </div>
    ) : (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        Sincronização com a Tecimob indisponível no momento
        {tecimob.lastSyncAt ? ` — últimos dados salvos às ${fmtDate(tecimob.lastSyncAt)}` : ''}. O CRM
        segue funcionando com os dados locais.
      </div>
    );

  return (
    <>
      {authWarning}
      {tecimobBanner}
    </>
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
            `relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/10 text-cream'
                : 'text-cream/55 hover:bg-white/5 hover:text-cream/85'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute inset-y-2 left-0 w-[2.5px] rounded-full bg-signal-500" aria-hidden="true" />
              )}
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop — navy petróleo da marca, nos dois temas */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-zinc-900 pt-5 md:flex dark:border-r dark:border-white/5">
        <div className="mb-7 px-5">
          <BrandLockup />
        </div>
        {nav}
        <div className="mt-auto flex items-center gap-2 border-t border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <UserFooter />
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm" />
          <aside
            className="absolute inset-y-0 left-0 w-64 bg-zinc-900 pt-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-7 px-5">
              <BrandLockup />
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-zinc-900 px-4 py-2.5 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-cream/70 hover:bg-white/10"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-brand text-lg font-light tracking-wide text-cream">
            A&amp;L <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/60">{BRAND.product}</span>
          </span>
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
