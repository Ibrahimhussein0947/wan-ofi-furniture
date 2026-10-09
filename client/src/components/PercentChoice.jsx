import clsx from 'clsx';
import { money } from '../utils/format';
import { useT } from '../i18n/LanguageContext';

export const PERCENT_OPTIONS = [10, 25, 50, 75, 100];

/** What a "pay X%" choice costs: X% of the order total, never more than what is still owed. */
export const amountForPercent = (total, balance, percent) =>
  percent >= 100 ? balance : Math.min(Math.round(total * percent) / 100, balance);

/**
 * "How much do you want to pay now?" chips. `value` is null for the default amount
 * (the required deposit), otherwise one of PERCENT_OPTIONS (100 = pay in full).
 */
export default function PercentChoice({ total, balance, depositPercent, value, onChange, className }) {
  const t = useT();
  const chip = (key, active, text, sub, onClick) => (
    <button
      key={key}
      type='button'
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'rounded-lg border-2 px-2 py-1.5 text-center text-sm leading-tight transition',
        active ? 'border-walnut-700 bg-walnut-50 font-semibold' : 'border-stone-200 hover:border-walnut-300',
      )}
    >
      {text}
      {sub && <span className='block text-[11px] font-normal text-stone-500'>{sub}</span>}
    </button>
  );
  return (
    <div className={className}>
      <p className='mb-1 text-sm font-medium text-stone-700'>{t('How much do you want to pay now?')}</p>
      <div className='grid grid-cols-3 gap-2 sm:grid-cols-6'>
        {chip('deposit', value === null, `${depositPercent}%`, t('Deposit'), () => onChange(null))}
        {PERCENT_OPTIONS.map((p) =>
          chip(
            p,
            value === p,
            p === 100 ? t('Full') : `${p}%`,
            total ? money(amountForPercent(total, balance ?? total, p)) : null,
            () => onChange(p),
          ),
        )}
      </div>
      <p className='mt-1 text-xs text-stone-500'>
        {t('Your order is confirmed once the deposit is paid; you can pay the rest in any share later.')}
      </p>
    </div>
  );
}
