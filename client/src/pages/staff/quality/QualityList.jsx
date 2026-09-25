import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import { PageHeader, Tabs } from '../../../components/ui/misc';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/States';
import { qualityApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { dateTime } from '../../../utils/format';

export default function QualityList() {
  const [params, set] = useListParams({ status: 'PENDING' });
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['quality', params], queryFn: () => qualityApi.list({ ...params, status: params.status === 'ALL' ? '' : params.status }) });
  return (
    <div>
      <PageHeader title="Quality control" subtitle="Nothing is marked ready until it passes inspection" />
      <Tabs
        className="mb-4"
        value={params.status}
        onChange={(status) => set({ status })}
        tabs={[
          { value: 'PENDING', label: 'Awaiting inspection' },
          { value: 'PASSED', label: 'Passed' },
          { value: 'FAILED,REWORK_REQUIRED', label: 'Failed / rework' },
          { value: 'ALL', label: 'All' },
        ]}
      />
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(q) => navigate(`/app/quality/${q._id}`)}
        empty={<EmptyState icon={ClipboardCheck} title="Nothing waiting for inspection" />}
        columns={[
          { key: 'job', header: 'Job', render: (q) => <span className="font-medium">{q.job?.jobNumber}</span> },
          { key: 'title', header: 'Furniture', render: (q) => q.job?.title },
          { key: 'order', header: 'Order', render: (q) => q.order?.orderNumber },
          { key: 'attempt', header: 'Attempt', align: 'right' },
          { key: 'workers', header: 'Built by', mobile: false, render: (q) => q.job?.assignedWorkers?.map((w) => w.name).join(', ') },
          { key: 'inspector', header: 'Inspector', render: (q) => q.inspector?.name || '—' },
          { key: 'date', header: 'Date', render: (q) => dateTime(q.inspectedAt || q.createdAt) },
          { key: 'status', header: 'Result', render: (q) => <StatusBadge status={q.status} /> },
        ]}
      />
    </div>
  );
}
