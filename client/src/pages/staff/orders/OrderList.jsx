import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { ordersApi } from '../../../api/endpoints';
import BranchSelect from '../../../components/BranchSelect';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../../utils/constants';
import { date, label, money } from '../../../utils/format';

export default function OrderList() {
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['orders', params], queryFn: () => ordersApi.list(params), placeholderData: keepPreviousData });

  const columns = [
    { key: 'orderNumber', header: 'Order', render: (o) => <span className="font-medium text-walnut-900">{o.orderNumber}</span> },
    { key: 'customer', header: 'Customer', render: (o) => o.customer?.name, exportValue: (o) => o.customer?.name },
    { key: 'orderDate', header: 'Date', render: (o) => date(o.orderDate), exportValue: (o) => date(o.orderDate) },
    { key: 'orderType', header: 'Type', mobile: false, render: (o) => label(o.orderType) },
    { key: 'branch', header: 'Branch', mobile: false, render: (o) => o.branch?.code || '—', exportValue: (o) => o.branch?.name },
    { key: 'total', header: 'Total', align: 'right', render: (o) => money(o.total) },
    { key: 'balance', header: 'Balance', align: 'right', render: (o) => <span className={o.balance > 0 ? 'font-medium text-brass-800' : 'text-stone-400'}>{money(o.balance)}</span> },
    { key: 'paymentStatus', header: 'Payment', render: (o) => <StatusBadge status={o.paymentStatus} /> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={query.data ? `${query.data.pagination.total} orders` : undefined}
        actions={
          <>
            <ExportMenu filename="orders" title="Orders" columns={columns} rows={query.data?.items} />
            {can('orders:write') && (
              <Button to="/app/orders/new" icon={Plus}>
                New order
              </Button>
            )}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder="Order number, item, phone…" className="sm:w-72" />
        <Select value={params.status || ''} onChange={(e) => set({ status: e.target.value })} options={ORDER_STATUSES.map((s) => ({ value: s, label: label(s) }))} placeholder="All statuses" aria-label="Status" containerClassName="sm:w-44" />
        <Select value={params.paymentStatus || ''} onChange={(e) => set({ paymentStatus: e.target.value })} options={PAYMENT_STATUSES.map((s) => ({ value: s, label: label(s) }))} placeholder="Any payment" aria-label="Payment status" containerClassName="sm:w-40" />
        <BranchSelect label={undefined} value={params.branch || ''} onChange={(e) => set({ branch: e.target.value })} aria-label="Branch" containerClassName="sm:w-48" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From date" containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To date" containerClassName="sm:w-40" />
      </FilterBar>
      <DataTable
        columns={columns}
        loading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(o) => navigate(`/app/orders/${o._id}`)}
      />
    </div>
  );
}
