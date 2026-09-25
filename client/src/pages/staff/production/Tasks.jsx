import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, PlayCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { PageHeader, Tabs } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, QueryState } from '../../../components/ui/States';
import { tasksApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { date } from '../../../utils/format';

export default function Tasks() {
  const [params, set] = useListParams({ status: 'TODO,IN_PROGRESS,BLOCKED' });
  const query = useQuery({ queryKey: ['tasks', params], queryFn: () => tasksApi.list({ ...params, mine: 'true' }) });
  const update = useMutationToast(({ id, status }) => tasksApi.update(id, { status }), { success: 'Task updated', invalidate: ['tasks', 'dashboard'] });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My tasks" />
      <Tabs
        className="mb-4"
        value={params.status}
        onChange={(status) => set({ status })}
        tabs={[
          { value: 'TODO,IN_PROGRESS,BLOCKED', label: 'Open' },
          { value: 'DONE', label: 'Done' },
        ]}
      />
      <QueryState query={query} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={ClipboardList} title="No tasks" />}>
        {(data) => (
          <ul className="space-y-3">
            {data.items.map((t) => (
              <li key={t._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-stone-500">
                    <Link to={`/app/production/${t.job?._id}`} className="link">
                      {t.job?.jobNumber}
                    </Link>{' '}
                    · {t.job?.title} {t.dueDate && `· due ${date(t.dueDate)}`}
                  </p>
                  {t.description && <p className="mt-1 text-sm text-stone-600">{t.description}</p>}
                </div>
                {t.status === 'TODO' && (
                  <Button size="lg" variant="secondary" icon={PlayCircle} onClick={() => update.mutate({ id: t._id, status: 'IN_PROGRESS' })}>
                    Start
                  </Button>
                )}
                {t.status === 'IN_PROGRESS' && (
                  <Button size="lg" variant="success" icon={CheckCircle2} onClick={() => update.mutate({ id: t._id, status: 'DONE' })}>
                    Mark done
                  </Button>
                )}
                {['DONE', 'BLOCKED'].includes(t.status) && <StatusBadge status={t.status} />}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
