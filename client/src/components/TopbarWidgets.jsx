import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck, LogOut, MessageSquare, Search, User } from 'lucide-react';
import { notificationsApi, searchApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui/misc';
import { label, money, timeAgo } from '../utils/format';

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

export function useUnreadCounts() {
  const { isAuthenticated } = useAuth();
  // Live events refresh this instantly; the slow poll is a fallback.
  return useQuery({ queryKey: ['unread'], queryFn: notificationsApi.unread, enabled: isAuthenticated, refetchInterval: 120000 });
}

export function NotificationBell({ basePath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  const { data: counts } = useUnreadCounts();
  const { data } = useQuery({ queryKey: ['notifications', 'latest'], queryFn: () => notificationsApi.list({ limit: 8 }), enabled: open });

  const openItem = async (n) => {
    if (!n.isRead) await notificationsApi.read(n._id);
    qc.invalidateQueries({ queryKey: ['unread'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    setOpen(false);
    if (n.link) navigate(n.link.startsWith('/account') || n.link.startsWith('/app') ? n.link : `${basePath}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label={`Notifications, ${counts?.notifications || 0} unread`}>
        <Bell className="h-5 w-5" />
        {counts?.notifications > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {counts.notifications > 99 ? '99+' : counts.notifications}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
            <p className="font-semibold">Notifications</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-walnut-700 hover:underline"
              onClick={async () => {
                await notificationsApi.readAll();
                qc.invalidateQueries({ queryKey: ['unread'] });
                qc.invalidateQueries({ queryKey: ['notifications'] });
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
            {!data?.items?.length && <li className="px-4 py-8 text-center text-sm text-stone-500">You're all caught up.</li>}
            {data?.items?.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => openItem(n)} className={clsx('block w-full px-4 py-3 text-left hover:bg-stone-50', !n.isRead && 'bg-brass-50/50')}>
                  <p className="flex items-start gap-2 text-sm font-medium text-stone-800">
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass-500" />}
                    {n.title}
                  </p>
                  {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{n.message}</p>}
                  <p className="mt-1 text-[11px] text-stone-400">{timeAgo(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
          <Link to={`${basePath}/notifications`} onClick={() => setOpen(false)} className="block border-t border-stone-100 py-2.5 text-center text-sm font-medium text-walnut-700 hover:bg-stone-50">
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

export function MessagesLink({ basePath }) {
  const { data: counts } = useUnreadCounts();
  return (
    <Link to={`${basePath}/messages`} className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label={`Messages, ${counts?.messages || 0} unread`}>
      <MessageSquare className="h-5 w-5" />
      {counts?.messages > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-brass-500 ring-2 ring-white" />}
    </Link>
  );
}

export function UserMenu({ basePath }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-stone-100" aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user?.name} size="sm" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium text-stone-800">{user?.name}</span>
          <span className="block text-[11px] text-stone-500">{label(user?.workerRole || user?.role)}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl" role="menu">
          <Link to={`${basePath}/profile`} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-stone-50">
            <User className="h-4 w-4" /> Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

const SEARCH_GROUPS = {
  orders: ['Orders', (r) => `/app/orders/${r._id}`, (r) => `${r.orderNumber} · ${r.customer?.name || ''}`],
  customers: ['Customers', (r) => `/app/customers/${r._id}`, (r) => `${r.name} · ${r.phone || r.customerCode}`],
  products: ['Products', (r) => `/app/products/${r._id}`, (r) => `${r.name} · ${r.sku}`],
  workers: ['Workers', (r) => (r.workerId ? `/app/workers/${r.workerId}` : '/app/workers'), (r) => `${r.name} · ${label(r.workerRole)}`],
  materials: ['Materials', (r) => `/app/materials/${r._id}`, (r) => `${r.name} · ${r.quantity} ${r.unit}`],
  suppliers: ['Suppliers', (r) => `/app/suppliers/${r._id}`, (r) => r.name],
  invoices: ['Invoices', (r) => `/app/invoices/${r._id}`, (r) => `${r.invoiceNumber} · ${money(r.total)}`],
  transactions: ['Transactions', () => '/app/accounting', (r) => `${r.transactionNumber} · ${label(r.type)} · ${money(r.amount)}`],
};

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { data, isFetching } = useQuery({ queryKey: ['search', debounced], queryFn: () => searchApi.search(debounced), enabled: debounced.length >= 2 });
  const groups = Object.entries(data || {}).filter(([k, rows]) => SEARCH_GROUPS[k] && rows?.length);

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search orders, customers, products…"
        className="input h-9 bg-stone-50 pl-9 pr-14"
        aria-label="Global search"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-stone-200 bg-white px-1.5 text-[10px] text-stone-400 sm:block">Ctrl K</kbd>
      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 bg-white py-2 shadow-xl">
          {isFetching && !data && <p className="px-4 py-3 text-sm text-stone-500">Searching…</p>}
          {data && !groups.length && <p className="px-4 py-3 text-sm text-stone-500">No results for "{debounced}".</p>}
          {groups.map(([key, rows]) => {
            const [title, link, text] = SEARCH_GROUPS[key];
            return (
              <div key={key} className="py-1">
                <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{title}</p>
                {rows.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    className="block w-full truncate px-4 py-2 text-left text-sm text-stone-700 hover:bg-walnut-50"
                    onClick={() => {
                      setOpen(false);
                      setQ('');
                      navigate(link(r));
                    }}
                  >
                    {text(r)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
