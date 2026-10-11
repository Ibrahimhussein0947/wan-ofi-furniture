import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Banknote, Hourglass, Plus, ReceiptText, Wallet } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, ProgressBar, SearchInput, StatCard } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { ordersApi } from '../../../api/endpoints';
import BranchSelect from '../../../components/BranchSelect';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../../utils/constants';
import { date, label, money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function OrderList() {
  const t = useT();
  const [params, set] = useListParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['orders', params], queryFn: () => ordersApi.list(params), placeholderData: keepPreviousData });

  const columns = [
    { key: 'orderNumber', header: 'Order', render: (o) => <span className="font-medium text-walnut-900">{o.orderNumber}</span> },
    { key: 'customer', header: 'Customer', render: (o) => o.customer?.name, exportValue: (o) => o.customer?.name },
    { key: 'orderDate', header: 'Date', render: (o) => date(o.orderDate), exportValue: (o) => date(o.orderDate) },
    { key: 'orderType', header: 'Type', mobile: false, render: (o) => t(label(o.orderType)) },
    { key: 'branch', header: 'Branch', mobile: false, render: (o) => o.branch?.code || '—', exportValue: (o) => o.branch?.name },
    { key: 'total', header: 'Total', align: 'right', render: (o) => money(o.total) },
    {
      key: 'amountPaid',
      header: 'Paid',
      align: 'right',
      render: (o) => (
        <div className="ml-auto w-28">
          <span className={o.amountPaid > 0 ? 'font-medium text-emerald-700' : 'text-stone-400'}>{money(o.amountPaid)}</span>
          <ProgressBar value={o.total ? (o.amountPaid / o.total) * 100 : 0} tone={o.balance <= 0 ? 'green' : 'brass'} className="mt-1" />
        </div>
      ),
      exportValue: (o) => o.amountPaid,
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (o) => <span className={o.balance > 0 ? 'font-medium text-brass-800' : 'text-stone-400'}>{money(o.balance)}</span> },
    {
      key: 'receipt',
      header: 'Receipt',
      mobile: false,
      render: (o) =>
        o.pendingPayments ? (
          <Badge tone="amber">{o.pendingReceipts ? t('Receipt to verify') : t('Awaiting receipt')}</Badge>
        ) : (
          <span className="text-stone-400">—</span>
        ),
      exportValue: (o) => (o.pendingPayments ? (o.pendingReceipts ? 'Receipt to verify' : 'Awaiting receipt') : ''),
    },
    { key: 'paymentStatus', header: 'Payment', render: (o) => <StatusBadge status={o.paymentStatus} /> },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t('Orders')}
        subtitle={query.data ? `${query.data.pagination.total} orders` : undefined}
        actions={
          <>
            <ExportMenu filename="orders" title={t('Orders')} columns={columns} rows={query.data?.items} />
            {can('orders:write') && (
              <Button to="/app/orders/new" icon={Plus}>
                {t('New order')}
              </Button>
            )}
          </>
        }
      />
      {query.data?.meta && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('Ordered')} value={money(query.data.meta.total)} icon={Wallet} />
          <StatCard label={t('Paid so far')} value={money(query.data.meta.paid)} icon={Banknote} tone="green" hint={`${query.data.meta.total ? Math.round((query.data.meta.paid / query.data.meta.total) * 100) : 0}%`} />
          <StatCard label={t('Still owed')} value={money(query.data.meta.balance)} icon={Hourglass} tone="brass" />
          <StatCard label={t('To verify')} value={money(query.data.meta.toVerifyAmount)} icon={ReceiptText} tone="red" hint={`${query.data.meta.toVerifyCount} ${t('payments')}`} />
        </div>
      )}
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder={t('Order number, item, phone…')} className="sm:w-72" />
        <Select value={params.status || ''} onChange={(e) => set({ status: e.target.value })} options={ORDER_STATUSES.map((s) => ({ value: s, label: t(label(s)) }))} placeholder={t('All statuses')} aria-label={t('Status')} containerClassName="sm:w-44" />
        <Select value={params.paymentStatus || ''} onChange={(e) => set({ paymentStatus: e.target.value })} options={PAYMENT_STATUSES.map((s) => ({ value: s, label: t(label(s)) }))} placeholder={t('Any payment')} aria-label={t('Payment status')} containerClassName="sm:w-40" />
        <Select value={params.needsVerification || ''} onChange={(e) => set({ needsVerification: e.target.value })} options={[{ value: 'true', label: t('Payment to verify') }]} placeholder={t('Any receipt')} aria-label={t('Receipt')} containerClassName="sm:w-44" />
        <BranchSelect label={undefined} value={params.branch || ''} onChange={(e) => set({ branch: e.target.value })} aria-label={t('Branch')} containerClassName="sm:w-48" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label={t('From date')} containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label={t('To date')} containerClassName="sm:w-40" />
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
