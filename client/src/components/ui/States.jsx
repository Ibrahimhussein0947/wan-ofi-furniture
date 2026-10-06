import clsx from 'clsx';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import Button from './Button';
import { errorMessage } from '../../api/client';
import { useT } from '../../i18n/LanguageContext';

export function Spinner({ className }) {
  const t = useT();
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-walnut-600', className)} aria-label={t('Loading')} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-stone-500" role="status">
      <Spinner className="h-7 w-7" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-walnut-50 text-walnut-500">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-stone-800">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-stone-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-stone-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={onRetry}>
          {t('Try again')}
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / empty / content for a TanStack query. */
export function QueryState({ query, empty, isEmpty, children, loader }) {
  if (query.isLoading) return loader || <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (isEmpty?.(query.data)) return empty || <EmptyState />;
  return children(query.data);
}
