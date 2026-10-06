import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import { PageHeader, Tabs } from '../../components/ui/misc';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/States';
import { ordersApi } from '../../api/endpoints';
import useListParams from '../../hooks/useListParams';
import { date, money } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

const TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Awaiting deposit' },
  { value: 'CONFIRMED,PAID,IN_PRODUCTION', label: 'In progress' },
  { value: 'READY,OUT_FOR_DELIVERY', label: 'Ready' },
  { value: 'DELIVERED,COMPLETED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function Orders() {
  const t = useT();
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['orders', 'mine', params], queryFn: () => ordersApi.list(params), placeholderData: keepPreviousData });

  return (
    <div>
      <PageHeader title={t('My orders')} actions={<Button to="/products">{t('Shop more')}</Button>} />
      <Tabs tabs={TABS} value={params.status || ''} onChange={(status) => set({ status })} className="mb-4" />
      <DataTable
        loading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(o) => navigate(`/account/orders/${o._id}`)}
        empty={<EmptyState icon={Package} title={t('No orders here')} action={<Button to="/products">{t('Browse furniture')}</Button>} />}
        columns={[
          { key: 'orderNumber', header: 'Order', render: (o) => <span className="font-medium text-walnut-900">{o.orderNumber}</span> },
          { key: 'orderDate', header: 'Date', render: (o) => date(o.orderDate) },
          { key: 'items', header: 'Items', render: (o) => <span className="block max-w-xs truncate">{o.items.map((i) => i.name).join(', ')}</span> },
          { key: 'total', header: 'Total', align: 'right', render: (o) => money(o.total) },
          { key: 'balance', header: 'Balance', align: 'right', render: (o) => <span className={o.balance > 0 ? 'font-medium text-brass-800' : ''}>{money(o.balance)}</span> },
          { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
        ]}
      />
    </div>
  );
}
