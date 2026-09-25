import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Search, X } from 'lucide-react';
import { initials } from '../../utils/format';

export function Card({ title, subtitle, actions, children, className, bodyClassName, padded = true }) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-3.5">
          <div>
            {title && <h2 className="text-base font-semibold text-stone-900">{title}</h2>}
            {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-walnut-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-stone-500">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'walnut', trend, to }) {
  const tones = {
    walnut: 'bg-walnut-50 text-walnut-700',
    brass: 'bg-brass-50 text-brass-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  const body = (
    <div className="card flex h-full items-start gap-4 p-4 transition hover:shadow-lift">
      {Icon && (
        <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold tabular-nums text-stone-900">{value}</p>
        {(hint || trend) && (
          <p className={clsx('mt-0.5 text-xs', trend === 'down' ? 'text-red-600' : trend === 'up' ? 'text-emerald-600' : 'text-stone-500')}>{hint}</p>
        )}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-brass-400">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', delay = 350, className }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  useEffect(() => {
    if (text === (value || '')) return undefined;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
      <input type="search" className="input pl-9 pr-8" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} aria-label={placeholder} />
      {text && (
        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-600" onClick={() => setText('')} aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('-mx-1 flex gap-1 overflow-x-auto border-b border-stone-200 px-1', className)} role="tablist">
      {tabs.map((t) => {
        const key = typeof t === 'object' ? t.value : t;
        const text = typeof t === 'object' ? t.label : t;
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={clsx(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition',
              active ? 'border-walnut-700 text-walnut-800' : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            {text}
            {typeof t === 'object' && t.count !== undefined && <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-xs text-stone-600">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value = 0, className, tone = 'walnut', showLabel }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tones = { walnut: 'bg-walnut-600', green: 'bg-emerald-500', brass: 'bg-brass-500', red: 'bg-red-500' };
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx('h-full rounded-full transition-all', tones[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="w-9 text-right text-xs tabular-nums text-stone-600">{pct}%</span>}
    </div>
  );
}

export function Avatar({ name, src, size = 'md', className }) {
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };
  if (src) return <img src={src} alt={name} className={clsx('rounded-full object-cover', sizes[size], className)} />;
  return (
    <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-full bg-walnut-100 font-semibold text-walnut-800', sizes[size], className)} aria-hidden>
      {initials(name) || '?'}
    </span>
  );
}

export function DetailList({ items, columns = 2 }) {
  return (
    <dl className={clsx('grid gap-x-6 gap-y-3', columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : '')}>
      {items
        .filter((i) => i && i.value !== undefined)
        .map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</dt>
            <dd className="mt-0.5 text-sm text-stone-800">{value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

export function FilterBar({ children, className }) {
  return <div className={clsx('mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end', className)}>{children}</div>;
}
