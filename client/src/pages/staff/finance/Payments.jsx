import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Banknote, Check, Truck, UserCog, X } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import ExportMenu from '../../../components/ExportMenu';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../../components/ui/misc';
import { Input, Select } from '../../../components/ui/Field';
import { StatusBadge, Badge } from '../../../components/ui/Badge';
import { CustomerPaymentModal, SupplierPaymentModal, WorkerPaymentModal } from '../../../components/finance/PaymentModals';
import { paymentsApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { PAYMENT_METHODS } from '../../../utils/constants';
import { dateTime, label, money } from '../../../utils/format';

export default function Payments() {
  const [params, set] = useListParams();
  const [search] = useSearchParams();
  const [modal, setModal] = useState(search.get('record') || null);
  const [rejecting, setRejecting] = useState(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['payments', params], queryFn: () => paymentsApi.list(params), placeholderData: keepPreviousData });
  const verify = useMutationToast(({ id, approve, reason }) => paymentsApi.verify(id, { approve, reason }), {
    success: (_, v) => (v.approve ? 'Payment verified and applied to the order' : 'Payment rejected'),
    invalidate: ['payments', 'orders', 'dashboard'],
    onSuccess: () => setRejecting(null),
  });
  const pendingView = params.status === 'PENDING_VERIFICATION';

  const columns = [
    { key: 'number', header: 'Receipt', render: (p) => <span className="font-medium">{p.receiptNumber || p.paymentNumber}</span>, exportValue: (p) => p.receiptNumber || p.paymentNumber },
    { key: 'paidAt', header: 'Date', render: (p) => dateTime(p.paidAt), exportValue: (p) => dateTime(p.paidAt) },
    { key: 'category', header: 'Type', render: (p) => <Badge tone={p.category === 'CUSTOMER_PAYMENT' ? 'green' : 'red'}>{label(p.category)}</Badge>, exportValue: (p) => p.category },
    { key: 'party', header: 'From / to', render: (p) => p.customer?.name || p.supplier?.name || p.worker?.user?.name || '—', exportValue: (p) => p.customer?.name || p.supplier?.name || p.worker?.user?.name },
    { key: 'order', header: 'Order', mobile: false, render: (p) => p.order?.orderNumber || '—', exportValue: (p) => p.order?.orderNumber },
    { key: 'method', header: 'Method', render: (p) => label(p.method), exportValue: (p) => p.method },
    { key: 'reference', header: 'Reference', mobile: false },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => money(p.amount) },
    {
      key: 'status',
      header: 'Status',
      export: false,
      render: (p) =>
        p.status === 'PENDING_VERIFICATION' && can('payments:write') ? (
          <span className="flex gap-1" onClick={(e) => e.stopPropagation()} role="presentation">
            <Button size="xs" variant="success" icon={Check} onClick={() => verify.mutate({ id: p._id, approve: true })}>
              Verify
            </Button>
            <Button size="xs" variant="secondary" icon={X} onClick={() => setRejecting(p)}>
              Reject
            </Button>
          </span>
        ) : (
          <StatusBadge status={p.status} />
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        actions={
          <>
            <ExportMenu filename="payments" title="Payments" columns={columns} rows={query.data?.items} />
            {can('payments:write') && (
              <>
                <Button icon={Banknote} onClick={() => setModal('customer')}>Customer payment</Button>
                <Button variant="secondary" icon={Truck} onClick={() => setModal('supplier')}>Supplier</Button>
                <Button variant="secondary" icon={UserCog} onClick={() => setModal('worker')}>Worker</Button>
              </>
            )}
          </>
        }
      />
      <Tabs
        className="mb-4"
        value={params.status || ''}
        onChange={(status) => set({ status })}
        tabs={[
          { value: '', label: 'All payments' },
          { value: 'PENDING_VERIFICATION', label: 'To verify' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(s) => set({ search: s })} placeholder="Receipt, reference…" className="sm:w-60" />
        <Select value={params.category || ''} onChange={(e) => set({ category: e.target.value })} options={['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'WORKER_PAYMENT', 'REFUND'].map((c) => ({ value: c, label: label(c) }))} placeholder="All types" aria-label="Type" containerClassName="sm:w-48" />
        <Select value={params.method || ''} onChange={(e) => set({ method: e.target.value })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) }))} placeholder="All methods" aria-label="Method" containerClassName="sm:w-44" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From" containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
      </FilterBar>
      {pendingView && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Customers submitted these payments online. Check your bank or mobile-money statement for the reference before verifying.</p>}
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={(p) => p.status === 'COMPLETED' && navigate(`/app/receipts/${p._id}`)} />
      <CustomerPaymentModal open={modal === 'customer'} onClose={() => setModal(null)} />
      <SupplierPaymentModal open={modal === 'supplier'} onClose={() => setModal(null)} />
      <WorkerPaymentModal open={modal === 'worker'} onClose={() => setModal(null)} />
      <ConfirmDialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject this payment?" message="The customer will be told the payment could not be verified." confirmLabel="Reject" requireReason loading={verify.isPending} onConfirm={(reason) => verify.mutate({ id: rejecting._id, approve: false, reason })} />
    </div>
  );
}
