import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function Logo({ light = false, to = '/', compact = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Wan Ofi Furniture home">
      {/* The emblem's black "W" needs a light backdrop on dark surfaces. */}
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden
        className={clsx('h-11 w-11 shrink-0 object-contain', light ? 'rounded-xl bg-[#fbf8f2] p-1' : 'dark:rounded-xl dark:bg-[#fbf8f2] dark:p-1')}
      />
      {!compact && (
        <span className="whitespace-nowrap leading-tight">
          <span className={clsx('block font-display text-lg font-semibold', light ? 'text-white' : 'text-walnut-900')}>Wan Ofi</span>
          <span className={clsx('block text-[10px] font-medium uppercase tracking-[0.2em]', light ? 'text-brass-200' : 'text-brass-600')}>Furniture</span>
        </span>
      )}
    </Link>
  );
}
