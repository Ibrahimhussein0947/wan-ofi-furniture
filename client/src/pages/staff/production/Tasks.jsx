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
import { useT } from '../../../i18n/LanguageContext';

export default function Tasks() {
  const t = useT();
  const [params, set] = useListParams({ status: 'TODO,IN_PROGRESS,BLOCKED' });
  const query = useQuery({ queryKey: ['tasks', params], queryFn: () => tasksApi.list({ ...params, mine: 'true' }) });
  const update = useMutationToast(({ id, status }) => tasksApi.update(id, { status }), { success: 'Task updated', invalidate: ['tasks', 'dashboard'] });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('My tasks')} />
      <Tabs
        className="mb-4"
        value={params.status}
        onChange={(status) => set({ status })}
        tabs={[
          { value: 'TODO,IN_PROGRESS,BLOCKED', label: 'Open' },
          { value: 'DONE', label: 'Done' },
        ]}
      />
      <QueryState query={query} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={ClipboardList} title={t('No tasks')} />}>
        {(data) => (
          <ul className="space-y-3">
            {data.items.map((task) => (
              <li key={task._id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-sm text-stone-500">
                    <Link to={`/app/production/${task.job?._id}`} className="link">
                      {task.job?.jobNumber}
                    </Link>{' '}
                    · {task.job?.title} {task.dueDate && `· due ${date(task.dueDate)}`}
                  </p>
                  {task.description && <p className="mt-1 text-sm text-stone-600">{task.description}</p>}
                </div>
                {task.status === 'TODO' && (
                  <Button size="lg" variant="secondary" icon={PlayCircle} onClick={() => update.mutate({ id: task._id, status: 'IN_PROGRESS' })}>
                    {t('Start')}
                  </Button>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <Button size="lg" variant="success" icon={CheckCircle2} onClick={() => update.mutate({ id: task._id, status: 'DONE' })}>
                    {t('Mark done')}
                  </Button>
                )}
                {['DONE', 'BLOCKED'].includes(task.status) && <StatusBadge status={task.status} />}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
