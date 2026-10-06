import clsx from 'clsx';
import { STATUS_TONES } from '../../utils/constants';
import { label as toLabel } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

const TONES = {
  stone: 'bg-stone-100 text-stone-700 ring-stone-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  brass: 'bg-gradient-to-br from-brass-100 to-brass-50 text-brass-800 ring-brass-300',
};

export function Badge({ tone = 'stone', children, className, dot }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }) {
  const t = useT();
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONES[status] || 'stone'} className={className} dot>
      {t(toLabel(status))}
    </Badge>
  );
}
