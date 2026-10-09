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
import {
  CustomerPaymentModal,
  SupplierPaymentModal,
  WorkerPaymentModal,
} from '../../../components/finance/PaymentModals';
import { paymentsApi } from '../../../api/endpoints';
import { fileUrl } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { PAYMENT_METHODS } from '../../../utils/constants';
import { dateTime, label, money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function Payments() {
  const t = useT();
  const [params, set] = useListParams();
  const [search] = useSearchParams();
  const [modal, setModal] = useState(search.get('record') || null);
  const [rejecting, setRejecting] = useState(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ['payments', params],
    queryFn: () => paymentsApi.list(params),
    placeholderData: keepPreviousData,
  });
  const verify = useMutationToast(
    ({ id, approve, reason }) => paymentsApi.verify(id, { approve, reason }),
    {
      success: (_, v) =>
        v.approve ? 'Payment verified and applied to the order' : 'Payment rejected',
      invalidate: ['payments', 'orders', 'dashboard'],
      onSuccess: () => setRejecting(null),
    },
  );
  const pendingView = params.status === 'PENDING_VERIFICATION';

  const columns = [
    {
      key: 'number',
      header: 'Receipt',
      render: (p) => <span className='font-medium'>{p.receiptNumber || p.paymentNumber}</span>,
      exportValue: (p) => p.receiptNumber || p.paymentNumber,
    },
    {
      key: 'paidAt',
      header: 'Date',
      render: (p) => dateTime(p.paidAt),
      exportValue: (p) => dateTime(p.paidAt),
    },
    {
      key: 'category',
      header: 'Type',
      render: (p) => (
        <Badge tone={p.category === 'CUSTOMER_PAYMENT' ? 'green' : 'red'}>
          {t(label(p.category))}
        </Badge>
      ),
      exportValue: (p) => p.category,
    },
    {
      key: 'party',
      header: 'From / to',
      render: (p) => p.customer?.name || p.supplier?.name || p.worker?.user?.name || '—',
      exportValue: (p) => p.customer?.name || p.supplier?.name || p.worker?.user?.name,
    },
    {
      key: 'order',
      header: 'Order',
      mobile: false,
      render: (p) => p.order?.orderNumber || '—',
      exportValue: (p) => p.order?.orderNumber,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => t(label(p.method)),
      exportValue: (p) => p.method,
    },
    { key: 'reference', header: 'Reference', mobile: false },
    {
      key: 'screenshot',
      header: 'Receipt',
      export: false,
      render: (p) =>
        p.screenshot ? (
          <a
            href={fileUrl(p.screenshot)}
            target='_blank'
            rel='noreferrer'
            onClick={(e) => e.stopPropagation()}
            className='text-walnut-700 hover:text-walnut-900'
            title={t('View the receipt the customer uploaded')}
          >
            <img
              src={fileUrl(p.screenshot)}
              alt={t('Receipt attached')}
              className='h-10 w-10 rounded border border-stone-200 object-cover'
            />
          </a>
        ) : (
          <span className='text-stone-300'>—</span>
        ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => (
        <>
          {money(p.amount)}
          {p.percent ? (
            <span className='block text-xs font-normal text-stone-500'>
              {p.percent === 100 ? t('Paying in full') : t('{pct}% of the order', { pct: p.percent })}
            </span>
          ) : null}
        </>
      ),
      exportValue: (p) => p.amount,
    },
    {
      key: 'status',
      header: 'Status',
      export: false,
      render: (p) =>
        p.status === 'PENDING_VERIFICATION' && can('payments:write') ? (
          <span className='flex gap-1' onClick={(e) => e.stopPropagation()} role='presentation'>
            <Button
              size='xs'
              variant='success'
              icon={Check}
              onClick={() => verify.mutate({ id: p._id, approve: true })}
            >
              {t('Verify')}
            </Button>
            <Button size='xs' variant='secondary' icon={X} onClick={() => setRejecting(p)}>
              {t('Reject')}
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
        title={t('Payments')}
        actions={
          <>
            <ExportMenu
              filename='payments'
              title={t('Payments')}
              columns={columns}
              rows={query.data?.items}
            />
            {can('payments:write') && (
              <>
                <Button icon={Banknote} onClick={() => setModal('customer')}>
                  {t('Customer payment')}
                </Button>
                <Button variant='secondary' icon={Truck} onClick={() => setModal('supplier')}>
                  {t('Supplier')}
                </Button>
                <Button variant='secondary' icon={UserCog} onClick={() => setModal('worker')}>
                  {t('Worker')}
                </Button>
              </>
            )}
          </>
        }
      />
      <Tabs
        className='mb-4'
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
        <SearchInput
          value={params.search}
          onChange={(s) => set({ search: s })}
          placeholder={t('Receipt, reference…')}
          className='sm:w-60'
        />
        <Select
          value={params.category || ''}
          onChange={(e) => set({ category: e.target.value })}
          options={['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'WORKER_PAYMENT', 'REFUND'].map(
            (c) => ({ value: c, label: t(label(c)) }),
          )}
          placeholder={t('All types')}
          aria-label={t('Type')}
          containerClassName='sm:w-48'
        />
        <Select
          value={params.method || ''}
          onChange={(e) => set({ method: e.target.value })}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(label(m)) }))}
          placeholder={t('All methods')}
          aria-label={t('Method')}
          containerClassName='sm:w-44'
        />
        <Input
          type='date'
          value={params.from || ''}
          onChange={(e) => set({ from: e.target.value })}
          aria-label={t('From')}
          containerClassName='sm:w-40'
        />
        <Input
          type='date'
          value={params.to || ''}
          onChange={(e) => set({ to: e.target.value })}
          aria-label='To'
          containerClassName='sm:w-40'
        />
      </FilterBar>
      {pendingView && (
        <p className='mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>
          {t(
            'Customers submitted these payments online. Check your bank or mobile-money statement for the reference before verifying.',
          )}
        </p>
      )}
      <DataTable
        columns={columns}
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.items}
        pagination={query.data?.pagination}
        onPageChange={(page) => set({ page })}
        onRowClick={(p) => p.status === 'COMPLETED' && navigate(`/app/receipts/${p._id}`)}
      />
      <CustomerPaymentModal open={modal === 'customer'} onClose={() => setModal(null)} />
      <SupplierPaymentModal open={modal === 'supplier'} onClose={() => setModal(null)} />
      <WorkerPaymentModal open={modal === 'worker'} onClose={() => setModal(null)} />
      {rejecting?.screenshot && (
        <div className='card fixed bottom-4 right-4 z-40 w-64 p-3 shadow-lg'>
          <p className='mb-2 text-xs font-semibold text-stone-600'>
            {t('Receipt the customer uploaded')}
          </p>
          <a href={fileUrl(rejecting.screenshot)} target='_blank' rel='noreferrer'>
            <img
              src={fileUrl(rejecting.screenshot)}
              alt={t('Transfer receipt')}
              className='max-h-48 w-full rounded object-contain'
            />
          </a>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t('Reject this payment?')}
        message={t('The customer will be told the payment could not be verified.')}
        confirmLabel={t('Reject')}
        requireReason
        loading={verify.isPending}
        onConfirm={(reason) => verify.mutate({ id: rejecting._id, approve: false, reason })}
      />
    </div>
  );
}
