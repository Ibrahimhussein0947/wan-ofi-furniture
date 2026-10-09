import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Heart, Mail, MapPin, Menu, Phone, ShoppingBag, User, X } from 'lucide-react';
import Logo from '../components/Logo';
import SocialIcon from '../components/SocialIcon';
import { socialLinks } from '../utils/social';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import Button from '../components/ui/Button';
import { useAuth, homePathFor } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { publicApi } from '../api/endpoints';
import { LanguageSwitcher, ThemeToggle } from '../components/PreferenceControls';
import { useT } from '../i18n/LanguageContext';

const NAV = [
  ['/', 'Home'],
  ['/products', 'Shop'],
  ['/categories', 'Categories'],
  ['/custom-furniture', 'Custom Furniture'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { count } = useCart();
  const { count: saved } = useWishlist();
  const t = useT();
  const location = useLocation();
  const { data: company } = useQuery({ queryKey: ['public-settings'], queryFn: publicApi.settings, staleTime: 5 * 60 * 1000 });
  const social = socialLinks(company?.socialLinks);

  useEffect(() => {
    setOpen(false);
    // Links like /contact#pay scroll to their section themselves.
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t('Skip to content')}
      </a>
      <header className="glass sticky top-0 z-40 !border-walnut-100">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          {/* Full menu only where it fits next to the language picker, icons and login (≥1280px). */}
          <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
            {NAV.map(([to, text]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => clsx('relative whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition 2xl:px-3', isActive ? 'nav-active-underline text-walnut-900' : 'text-stone-600 hover:bg-white/70 hover:text-walnut-800')}
              >
                {t(text)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <LanguageSwitcher className="hidden sm:flex" />
            <ThemeToggle />
            {(!user || user.role === 'CUSTOMER') && (
              <Link to={user ? '/account/wishlist' : '/wishlist'} className="relative rounded-lg p-2 text-stone-700 hover:bg-walnut-50" aria-label={t('Wishlist, {count} saved', { count: saved })}>
                <Heart className="h-5 w-5" />
                {saved > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{saved}</span>
                )}
              </Link>
            )}
            <Link to="/cart" className="relative rounded-lg p-2 text-stone-700 hover:bg-walnut-50" aria-label={t('Cart, {count} items', { count })}>
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 animate-pulse-soft items-center justify-center rounded-full bg-gradient-to-br from-brass-300 to-brass-500 px-1 text-[11px] font-bold text-walnut-950 shadow-glow-sm ring-2 ring-white">
                  {count}
                </span>
              )}
            </Link>
            {user ? (
              <Button to={homePathFor(user)} variant="secondary" size="sm" icon={User} className="hidden sm:inline-flex">
                {t(user.role === 'CUSTOMER' ? 'My account' : 'Dashboard')}
              </Button>
            ) : (
              <div className="hidden items-center gap-1 sm:flex">
                <Button to="/login" variant="ghost" size="sm">
                  {t('Log in')}
                </Button>
                <Button to="/register" size="sm">
                  {t('Sign up')}
                </Button>
              </div>
            )}
            <button type="button" className="rounded-lg p-2 text-stone-700 hover:bg-walnut-50 xl:hidden" onClick={() => setOpen((o) => !o)} aria-label={t('Menu')} aria-expanded={open}>
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-walnut-100 bg-white px-4 pb-4 pt-2 xl:hidden" aria-label="Mobile">
            {NAV.map(([to, text]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => clsx('block rounded-lg px-3 py-3 text-base font-medium', isActive ? 'bg-gradient-to-r from-brass-50 to-walnut-50 text-walnut-900' : 'text-stone-700 hover:bg-white')}>
                {t(text)}
              </NavLink>
            ))}
            <LanguageSwitcher className="mt-2 sm:hidden" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <Button to={homePathFor(user)} block className="col-span-2">
                  {t(user.role === 'CUSTOMER' ? 'My account' : 'Dashboard')}
                </Button>
              ) : (
                <>
                  <Button to="/login" variant="secondary" block>
                    {t('Log in')}
                  </Button>
                  <Button to="/register" block>
                    {t('Sign up')}
                  </Button>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <VerifyEmailBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="theme-static border-t-2 border-brass-500/25 bg-gradient-to-b from-walnut-950 to-[#160d09] text-walnut-100">
        <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo light />
            <p className="text-sm text-walnut-200/80">{t('Handcrafted furniture from our workshop in Bale Robe — built to last for generations.')}</p>
            {social.length > 0 && (
              <div className="flex gap-3 text-walnut-300">
                {social.map((s) => (
                  <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="hover:text-brass-300">
                    <SocialIcon name={s.key} className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brass-300">{t('Shop')}</h3>
            <ul className="space-y-2 text-sm">
              {[
                ['/products', 'All furniture'],
                ['/products?featured=true', 'Featured'],
                ['/categories', 'Categories'],
                ['/custom-furniture', 'Custom orders'],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="hover:text-white">
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brass-300">{t('Company')}</h3>
            <ul className="space-y-2 text-sm">
              {[
                ['/about', 'About us'],
                ['/contact', 'Contact'],
                ['/login', 'Staff & customer login'],
              ].map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="hover:text-white">
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brass-300">{t('Visit us')}</h3>
            <ul className="space-y-2.5 text-sm text-walnut-200/90">
              <li className="flex gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-brass-300" />
                {company?.companyAddress || 'Bale Robe, Ethiopia'}
              </li>
              <li className="flex gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brass-300" />
                {company?.companyPhone || '+251 900 000 000'}
              </li>
              <li className="flex gap-2">
                <Mail className="h-4 w-4 shrink-0 text-brass-300" />
                {company?.companyEmail || 'info@wanofi.com'}
              </li>
              {social.map((s) => (
                <li key={s.key}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="flex gap-2 hover:text-white" title={s.label}>
                    <SocialIcon name={s.key} className="h-4 w-4 shrink-0 text-brass-300" />
                    <span className="min-w-0 break-all">
                      <span className="sr-only">{s.label}: </span>
                      {s.text}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-walnut-300/70">© {new Date().getFullYear()} Wan Ofi Furniture. {t('All rights reserved.')}</div>
      </footer>
    </div>
  );
}
