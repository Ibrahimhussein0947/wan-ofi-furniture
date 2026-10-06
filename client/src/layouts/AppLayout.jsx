import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ExternalLink, Menu, X } from 'lucide-react';
import Logo from '../components/Logo';
import { GlobalSearch, MessagesLink, NotificationBell, UserMenu } from '../components/TopbarWidgets';
import { useAuth } from '../context/AuthContext';
import { visibleNav } from './navigation';
import useLiveEvents from '../hooks/useLiveEvents';
import { LanguageSwitcher, ThemeToggle } from '../components/PreferenceControls';
import { useT } from '../i18n/LanguageContext';

function Sidebar({ groups, onNavigate }) {
  const t = useT();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
      {groups.map((group) => (
        <div key={group.section || 'main'}>
          {group.section && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-walnut-300/70">{t(group.section)}</p>}
          <ul className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition duration-200 ease-smooth',
                      isActive
                        ? 'bg-gradient-to-r from-brass-500/25 to-brass-500/0 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
                        : 'text-walnut-200 hover:translate-x-0.5 hover:bg-white/5 hover:text-white'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Brass rail marking the active section. */}
                      <span
                        className={clsx(
                          'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brass-300 to-brass-500 transition-all duration-300 ease-smooth',
                          isActive ? 'opacity-100' : 'scale-y-0 opacity-0 group-hover:scale-y-75 group-hover:opacity-60'
                        )}
                        aria-hidden
                      />
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {t(label)}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const auth = useAuth();
  useLiveEvents();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const groups = visibleNav(auth);
  const t = useT();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const sidebarInner = (
    <>
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light to="/app" />
        <button type="button" className="rounded-lg p-1.5 text-walnut-200 lg:hidden" onClick={() => setMobileOpen(false)} aria-label={t('Close menu')}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <Sidebar groups={groups} onNavigate={() => setMobileOpen(false)} />
      <a href="/" className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-walnut-300 hover:bg-white/5 hover:text-white">
        <ExternalLink className="h-3.5 w-3.5" /> {t('View storefront')}
      </a>
    </>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <aside className="fixed inset-y-0 left-0 z-30 theme-static hidden w-64 flex-col bg-walnut-950 lg:flex">{sidebarInner}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 theme-static flex w-72 flex-col bg-walnut-950 shadow-2xl">{sidebarInner}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 px-4 sm:px-6">
          <button type="button" className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t('Open menu')}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 sm:block">{auth.user?.role !== 'WORKER' || auth.can('production:manage') ? <GlobalSearch /> : null}</div>
          <div className="flex flex-1 items-center justify-end gap-1 sm:flex-none">
            <LanguageSwitcher className="hidden md:flex" />
            <ThemeToggle />
            <MessagesLink basePath="/app" />
            <NotificationBell basePath="/app" />
            <UserMenu basePath="/app" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
