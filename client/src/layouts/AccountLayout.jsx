import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { FileText, Heart, Home, MessageSquare, Package, PencilRuler, ShoppingBag, User, Bell } from 'lucide-react';
import Logo from '../components/Logo';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import useLiveEvents from '../hooks/useLiveEvents';
import { MessagesLink, NotificationBell, UserMenu } from '../components/TopbarWidgets';
import { LanguageSwitcher, ThemeToggle } from '../components/PreferenceControls';
import { useT } from '../i18n/LanguageContext';

const NAV = [
  ['/account', 'Overview', Home, true],
  ['/account/orders', 'Orders', Package],
  ['/account/wishlist', 'Wishlist', Heart],
  ['/account/custom-requests', 'Custom requests', PencilRuler],
  ['/account/invoices', 'Invoices & receipts', FileText],
  ['/account/messages', 'Messages', MessageSquare],
  ['/account/notifications', 'Notifications', Bell],
  ['/account/profile', 'Profile', User],
];

export default function AccountLayout() {
  useLiveEvents();
  const t = useT();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-walnut-100 bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-1">
            <NavLink to="/products" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-brass-50 hover:text-walnut-800 sm:inline-flex">
              <ShoppingBag className="h-4 w-4" /> {t('Shop')}
            </NavLink>
            <LanguageSwitcher className="hidden md:flex" />
            <ThemeToggle />
            <MessagesLink basePath="/account" />
            <NotificationBell basePath="/account" />
            <UserMenu basePath="/account" />
          </div>
        </div>
        <nav className="container-page -mb-px flex gap-1 overflow-x-auto" aria-label={t('My account')}>
          {NAV.map(([to, text, Icon, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium',
                  isActive ? 'border-brass-500 text-walnut-900' : 'border-transparent text-stone-500 hover:border-brass-300 hover:text-walnut-800'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {t(text)}
            </NavLink>
          ))}
        </nav>
      </header>
      <VerifyEmailBanner />
      <main className="container-page py-6">
        <Outlet />
      </main>
    </div>
  );
}
