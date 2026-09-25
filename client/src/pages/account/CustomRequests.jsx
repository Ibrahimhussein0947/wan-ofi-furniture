import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PencilRuler } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/States';
import { customOrdersApi } from '../../api/endpoints';
import useListParams from '../../hooks/useListParams';
import { date, money } from '../../utils/format';

export default function CustomRequests() {
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['custom-orders', 'mine', params], queryFn: () => customOrdersApi.list(params) });
  return (
    <div>
      <PageHeader title="Custom furniture requests" actions={<Button to="/custom-furniture" icon={PencilRuler}>New request</Button>} />
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(r) => navigate(`/account/custom-requests/${r._id}`)}
        empty={<EmptyState icon={PencilRuler} title="No custom requests yet" message="Describe your dream piece and we'll quote it." action={<Button to="/custom-furniture">Start a request</Button>} />}
        columns={[
          { key: 'requestNumber', header: 'Request', render: (r) => <span className="font-medium">{r.requestNumber}</span> },
          { key: 'furnitureType', header: 'Furniture' },
          { key: 'createdAt', header: 'Submitted', render: (r) => date(r.createdAt) },
          { key: 'quotedPrice', header: 'Quote', align: 'right', render: (r) => (r.quotedPrice ? money(r.quotedPrice) : '—') },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
}
