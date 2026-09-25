import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import { FilterBar, PageHeader, Tabs } from '../../../components/ui/misc';
import { Input } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/States';
import { deliveriesApi } from '../../../api/endpoints';
import useListParams from '../../../hooks/useListParams';
import { date, money } from '../../../utils/format';

const TABS = [
  { value: 'PENDING,SCHEDULED,OUT_FOR_DELIVERY', label: 'Upcoming' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ALL', label: 'All' },
];

export default function DeliveryList() {
  const [params, set] = useListParams({ status: 'PENDING,SCHEDULED,OUT_FOR_DELIVERY' });
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['deliveries', params], queryFn: () => deliveriesApi.list({ ...params, status: params.status === 'ALL' ? '' : params.status }), placeholderData: keepPreviousData });
  return (
    <div>
      <PageHeader title="Deliveries" subtitle="Schedule deliveries from an order that is ready." />
      <Tabs tabs={TABS} value={params.status} onChange={(status) => set({ status })} className="mb-4" />
      <FilterBar>
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From" containerClassName="sm:w-44" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-44" />
      </FilterBar>
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(d) => navigate(`/app/deliveries/${d._id}`)}
        empty={<EmptyState icon={Truck} title="No deliveries" />}
        columns={[
          { key: 'deliveryNumber', header: 'Delivery', render: (d) => <span className="font-medium">{d.deliveryNumber}</span> },
          { key: 'order', header: 'Order', render: (d) => d.order?.orderNumber },
          { key: 'customer', header: 'Customer', render: (d) => `${d.customer?.name || ''}` },
          { key: 'scheduledDate', header: 'Date', render: (d) => date(d.scheduledDate) },
          { key: 'address', header: 'Address', mobile: false, render: (d) => [d.address?.street, d.address?.city].filter(Boolean).join(', ') },
          { key: 'deliveryPerson', header: 'Driver', render: (d) => d.deliveryPerson?.name || 'Unassigned' },
          { key: 'balance', header: 'Balance', align: 'right', mobile: false, render: (d) => money(d.order?.balance) },
          { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
        ]}
      />
    </div>
  );
}
