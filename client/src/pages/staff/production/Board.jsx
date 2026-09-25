import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, CalendarClock, LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import DataTable from '../../../components/ui/DataTable';
import { FilterBar, PageHeader, ProgressBar } from '../../../components/ui/misc';
import { Checkbox } from '../../../components/ui/Field';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import Button from '../../../components/ui/Button';
import { productionApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { date, daysUntil, label } from '../../../utils/format';

const COLUMN_TONES = {
  PENDING: 'border-t-amber-400',
  MATERIALS: 'border-t-orange-400',
  PRODUCTION: 'border-t-violet-500',
  ASSEMBLY: 'border-t-violet-400',
  FINISHING: 'border-t-fuchsia-400',
  QUALITY_CHECK: 'border-t-teal-500',
  READY: 'border-t-emerald-500',
  COMPLETED: 'border-t-stone-400',
};

function JobCard({ job }) {
  const days = daysUntil(job.expectedCompletionDate);
  const late = days !== null && days < 0 && !['READY_FOR_DELIVERY', 'DELIVERED'].includes(job.stage);
  return (
    <Link to={`/app/production/${job._id}`} className="block rounded-lg border border-stone-200 bg-white p-3 shadow-sm transition hover:border-walnut-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-stone-500">{job.jobNumber}</p>
        {job.priority !== 'NORMAL' && <StatusBadge status={job.priority} />}
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-stone-900">{job.title}</p>
      <p className="text-xs text-stone-500">
        {job.order?.orderNumber} · {job.customer?.name}
      </p>
      <ProgressBar value={job.progress} className="mt-2" />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-stone-500">{label(job.stage)}</span>
        {job.openProblems > 0 && (
          <Badge tone="red">
            <AlertTriangle className="h-3 w-3" /> {job.openProblems}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className={clsx('flex items-center gap-1', late ? 'font-semibold text-red-600' : 'text-stone-500')}>
          <CalendarClock className="h-3 w-3" /> {late ? `${-days}d late` : date(job.expectedCompletionDate)}
        </span>
        <span className="flex -space-x-1.5">
          {job.assignedWorkers?.slice(0, 3).map((w) => (
            <span key={w._id} title={w.name} className="flex h-6 w-6 items-center justify-center rounded-full bg-walnut-100 text-[10px] font-semibold text-walnut-800 ring-2 ring-white">
              {w.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </span>
          ))}
        </span>
      </div>
    </Link>
  );
}

export default function Board() {
  const [params, set] = useListParams();
  const [view, setView] = useState('board');
  const navigate = useNavigate();
  const board = useQuery({ queryKey: ['production', 'board', params], queryFn: () => productionApi.board(params), enabled: view === 'board' });
  const list = useQuery({ queryKey: ['production', 'list', params], queryFn: () => productionApi.list(params), enabled: view === 'list' });

  return (
    <div>
      <PageHeader
        title="Production"
        subtitle="Jobs flow from pending through quality check to ready"
        actions={
          <div className="flex rounded-lg border border-stone-200 bg-white p-0.5">
            <Button size="sm" variant={view === 'board' ? 'primary' : 'ghost'} icon={LayoutGrid} onClick={() => setView('board')}>
              Board
            </Button>
            <Button size="sm" variant={view === 'list' ? 'primary' : 'ghost'} icon={List} onClick={() => setView('list')}>
              List
            </Button>
          </div>
        }
      />
      <FilterBar>
        <Checkbox label="Only my jobs" checked={params.mine === 'true'} onChange={(e) => set({ mine: e.target.checked ? 'true' : '' })} />
        <Checkbox label="Overdue only" checked={params.overdue === 'true'} onChange={(e) => set({ overdue: e.target.checked ? 'true' : '' })} />
      </FilterBar>

      {view === 'board' ? (
        <QueryState query={board}>
          {(columns) => (
            <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
              <div className="flex min-w-max gap-4">
                {columns.map((col) => (
                  <section key={col.key} className={clsx('flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-stone-100/80', COLUMN_TONES[col.key])} aria-label={col.title}>
                    <header className="flex items-center justify-between px-3 py-2.5">
                      <h2 className="text-sm font-semibold text-stone-800">{col.title}</h2>
                      <span className="rounded-full bg-white px-2 text-xs font-medium text-stone-600">{col.jobs.length}</span>
                    </header>
                    <div className="flex max-h-[calc(100vh-18rem)] flex-col gap-2 overflow-y-auto px-2 pb-3">
                      {col.jobs.length ? col.jobs.map((job) => <JobCard key={job._id} job={job} />) : <p className="px-2 py-6 text-center text-xs text-stone-400">No jobs</p>}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </QueryState>
      ) : (
        <DataTable
          loading={list.isLoading}
          error={list.error}
          rows={list.data?.items}
          pagination={list.data?.pagination}
          onPageChange={(page) => set({ page })}
          onRowClick={(j) => navigate(`/app/production/${j._id}`)}
          columns={[
            { key: 'jobNumber', header: 'Job', render: (j) => <span className="font-medium">{j.jobNumber}</span> },
            { key: 'title', header: 'Furniture' },
            { key: 'order', header: 'Order', render: (j) => j.order?.orderNumber },
            { key: 'workers', header: 'Workers', mobile: false, render: (j) => j.assignedWorkers?.map((w) => w.name).join(', ') || '—' },
            { key: 'progress', header: 'Progress', render: (j) => <ProgressBar value={j.progress} showLabel className="w-32" /> },
            { key: 'expected', header: 'Due', render: (j) => date(j.expectedCompletionDate) },
            { key: 'stage', header: 'Stage', render: (j) => <StatusBadge status={j.stage} /> },
          ]}
        />
      )}
    </div>
  );
}
