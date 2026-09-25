import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from './States';

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm" aria-label="Pagination">
      <p className="text-stone-500">
        <span className="font-medium text-stone-700">{from}</span>–<span className="font-medium text-stone-700">{to}</span> of{' '}
        <span className="font-medium text-stone-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-stone-600">
          {page} / {pages}
        </span>
        <button
          type="button"
          className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

/**
 * Responsive data table. On small screens rows collapse into cards showing
 * the columns marked `primary`/`mobile` (all columns if none are marked).
 */
export default function DataTable({ columns, rows, loading, error, onRetry, onRowClick, empty, pagination, onPageChange, rowKey = (r) => r._id, footer, dense }) {
  const mobileCols = columns.filter((c) => c.mobile !== false);

  let body;
  if (loading) {
    body = (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (error) {
    body = <ErrorState error={error} onRetry={onRetry} />;
  } else if (!rows?.length) {
    body = empty || <EmptyState />;
  } else {
    body = (
      <>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-stone-100">
            <thead className="bg-stone-50/80">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={clsx('table-th', c.align === 'right' && 'text-right', c.headerClassName)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={clsx(onRowClick && 'cursor-pointer hover:bg-walnut-50/50', 'transition')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={clsx('table-td', dense && 'py-2', c.align === 'right' && 'text-right tabular-nums', c.className)}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && <tfoot className="border-t-2 border-stone-200 bg-stone-50 font-semibold">{footer}</tfoot>}
          </table>
        </div>
        <ul className="divide-y divide-stone-100 md:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)}>
              <div
                className={clsx('space-y-1.5 px-4 py-3', onRowClick && 'cursor-pointer active:bg-walnut-50')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onRowClick(row) : undefined}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {mobileCols.map((c, i) => (
                  <div key={c.key} className={clsx('flex items-center justify-between gap-3 text-sm', i === 0 && 'font-medium text-stone-900')}>
                    {i > 0 && <span className="text-xs text-stone-500">{c.header}</span>}
                    <span className={clsx(i === 0 ? 'min-w-0' : 'text-right', 'text-stone-700')}>{c.render ? c.render(row) : row[c.key]}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="card overflow-hidden">
      {body}
      {onPageChange && <Pagination pagination={pagination} onPageChange={onPageChange} />}
    </div>
  );
}
