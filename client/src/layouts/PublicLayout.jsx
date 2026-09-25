import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Facebook, Instagram, Mail, MapPin, Menu, Phone, ShoppingBag, User, X } from 'lucide-react';
import Logo from '../components/Logo';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import Button from '../components/ui/Button';
import { useAuth, homePathFor } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { publicApi } from '../api/endpoints';

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
  const location = useLocation();
  const { data: company } = useQuery({ queryKey: ['public-settings'], queryFn: publicApi.settings, staleTime: 5 * 60 * 1000 });

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-[#fbf8f4]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-walnut-100 bg-[#fbf8f4]/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map(([to, text]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => clsx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'text-walnut-900' : 'text-stone-600 hover:text-walnut-800')}
              >
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link to="/cart" className="relative rounded-lg p-2 text-stone-700 hover:bg-walnut-50" aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1 text-[11px] font-bold text-walnut-950">
                  {count}
                </span>
              )}
            </Link>
            {user ? (
              <Button to={homePathFor(user)} variant="secondary" size="sm" icon={User} className="hidden sm:inline-flex">
                {user.role === 'CUSTOMER' ? 'My account' : 'Dashboard'}
              </Button>
            ) : (
              <div className="hidden items-center gap-1 sm:flex">
                <Button to="/login" variant="ghost" size="sm">
                  Log in
                </Button>
                <Button to="/register" size="sm">
                  Sign up
                </Button>
              </div>
            )}
            <button type="button" className="rounded-lg p-2 text-stone-700 hover:bg-walnut-50 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-walnut-100 bg-white px-4 pb-4 pt-2 lg:hidden" aria-label="Mobile">
            {NAV.map(([to, text]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => clsx('block rounded-lg px-3 py-3 text-base font-medium', isActive ? 'bg-walnut-50 text-walnut-900' : 'text-stone-700')}>
                {text}
              </NavLink>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <Button to={homePathFor(user)} block className="col-span-2">
                  {user.role === 'CUSTOMER' ? 'My account' : 'Dashboard'}
                </Button>
              ) : (
                <>
                  <Button to="/login" variant="secondary" block>
                    Log in
                  </Button>
                  <Button to="/register" block>
                    Sign up
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

      <footer className="bg-walnut-950 text-walnut-100">
        <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo light />
            <p className="text-sm text-walnut-200/80">Handcrafted furniture from our workshop in Dar es Salaam — built to last for generations.</p>
            <div className="flex gap-3 text-walnut-300">
              <a href="https://instagram.com" aria-label="Instagram" className="hover:text-brass-300">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://facebook.com" aria-label="Facebook" className="hover:text-brass-300">
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brass-300">Shop</h3>
            <ul className="space-y-2 text-sm">
              {[
                ['/products', 'All furniture'],
                ['/products?featured=true', 'Featured'],
                ['/categories', 'Categories'],
                ['/custom-furniture', 'Custom orders'],
              ].map(([to, t]) => (
                <li key={to}>
                  <Link to={to} className="hover:text-white">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brass-300">Company</h3>
            <ul className="space-y-2 text-sm">
              {[
                ['/about', 'About us'],
                ['/contact', 'Contact'],
                ['/login', 'Staff & customer login'],
              ].map(([to, t]) => (
                <li key={to}>
                  <Link to={to} className="hover:text-white">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brass-300">Visit us</h3>
            <ul className="space-y-2.5 text-sm text-walnut-200/90">
              <li className="flex gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-brass-300" />
                {company?.companyAddress || 'Dar es Salaam, Tanzania'}
              </li>
              <li className="flex gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brass-300" />
                {company?.companyPhone || '+255 700 000 000'}
              </li>
              <li className="flex gap-2">
                <Mail className="h-4 w-4 shrink-0 text-brass-300" />
                {company?.companyEmail || 'info@wanofi.com'}
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-walnut-300/70">© {new Date().getFullYear()} Wan Ofi Furniture. All rights reserved.</div>
      </footer>
    </div>
  );
}
