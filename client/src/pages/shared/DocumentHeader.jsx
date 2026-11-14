import { StatusBadge } from '../../components/ui/Badge';
import Logo from '../../components/Logo';

export function DocumentHeader({ company, title, number, status }) {
  return (
    <div className='flex flex-wrap items-start justify-between gap-6 border-b border-stone-200 pb-6'>
      <div>
        <Logo />
        <p className='mt-3 text-sm text-stone-600'>{company?.address}</p>
        <p className='text-sm text-stone-600'>
          {company?.phone} · {company?.email}
        </p>
      </div>
      <div className='text-right'>
        <p className='font-display text-3xl font-semibold uppercase tracking-wide text-walnut-900'>
          {title}
        </p>
        <p className='mt-1 font-mono text-sm text-stone-700'>{number}</p>
        {status && <StatusBadge status={status} className='mt-2' />}
      </div>
    </div>
  );
}
