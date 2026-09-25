import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function Logo({ light = false, to = '/', compact = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Wan Ofi Furniture home">
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? '#f6ecc9' : '#3f2a21'} />
        <path d="M14 36h36v8H14zM18 24h28v12H18zM18 44v6M46 44v6" stroke={light ? '#3f2a21' : '#d9a531'} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="leading-tight">
          <span className={clsx('block font-display text-lg font-semibold', light ? 'text-white' : 'text-walnut-900')}>Wan Ofi</span>
          <span className={clsx('block text-[10px] font-medium uppercase tracking-[0.2em]', light ? 'text-brass-200' : 'text-brass-600')}>Furniture</span>
        </span>
      )}
    </Link>
  );
}
