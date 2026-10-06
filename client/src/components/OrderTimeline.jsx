import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const STEPS = [
  ['Order placed', ['PENDING']],
  ['Confirmed', ['CONFIRMED', 'PAID']],
  ['In production', ['IN_PRODUCTION']],
  ['Ready', ['READY']],
  ['On the way', ['OUT_FOR_DELIVERY']],
  ['Delivered', ['DELIVERED']],
  ['Completed', ['COMPLETED']],
];

/** Customer-facing progress of an order through the workflow. */
export default function OrderTimeline({ order }) {
  const t = useT();
  if (order.status === 'CANCELLED') {
    return <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-600">This order was cancelled{order.cancellationReason ? `: ${order.cancellationReason}` : '.'}</p>;
  }
  const steps = order.deliveryMethod === 'PICKUP' ? STEPS.filter(([name]) => name !== 'On the way').map(([n, s]) => (n === 'Delivered' ? ['Collected', s] : [n, s])) : STEPS;
  const current = steps.findIndex(([, statuses]) => statuses.includes(order.status));

  return (
    <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0" aria-label={t('Order progress')}>
      {steps.map(([name], i) => {
        const done = i < current || order.status === 'COMPLETED';
        const active = i === current && order.status !== 'COMPLETED';
        return (
          <li key={name} className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-2 sm:text-center">
            {i > 0 && <span className={clsx('absolute hidden h-0.5 sm:block', done || active ? 'bg-walnut-600' : 'bg-stone-200')} style={{ left: '-50%', right: '50%', top: 14 }} aria-hidden />}
            <span
              className={clsx(
                'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                done ? 'border-walnut-700 bg-walnut-700 text-white' : active ? 'border-brass-500 bg-brass-50 text-brass-800 ring-4 ring-brass-100' : 'border-stone-300 bg-white text-stone-400'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={clsx('text-xs font-medium', done || active ? 'text-walnut-900' : 'text-stone-400')}>{name}</span>
          </li>
        );
      })}
    </ol>
  );
}
