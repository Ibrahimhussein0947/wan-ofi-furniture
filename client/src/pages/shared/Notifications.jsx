import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PageHeader, Tabs } from '../../components/ui/misc';
import { Pagination } from '../../components/ui/DataTable';
import { EmptyState, QueryState } from '../../components/ui/States';
import { notificationsApi } from '../../api/endpoints';
import useListParams from '../../hooks/useListParams';
import { dateTime, label } from '../../utils/format';

export default function Notifications() {
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['notifications', params], queryFn: () => notificationsApi.list(params) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['unread'] });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            onClick={async () => {
              await notificationsApi.readAll();
              refresh();
            }}
          >
            Mark all read
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        tabs={[
          { value: '', label: 'All' },
          { value: 'true', label: 'Unread', count: query.data?.meta?.unread },
        ]}
        value={params.unread || ''}
        onChange={(unread) => set({ unread })}
      />
      <QueryState query={query} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={Bell} title="No notifications" />}>
        {(data) => (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {data.items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    className={clsx('flex w-full gap-3 px-5 py-4 text-left hover:bg-stone-50', !n.isRead && 'bg-brass-50/40')}
                    onClick={async () => {
                      if (!n.isRead) await notificationsApi.read(n._id);
                      refresh();
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brass-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-stone-900">{n.title}</span>
                      {n.message && <span className="mt-0.5 block text-sm text-stone-600">{n.message}</span>}
                      <span className="mt-1 block text-xs text-stone-400">
                        {label(n.type)} · {dateTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination pagination={data.pagination} onPageChange={(page) => set({ page })} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
