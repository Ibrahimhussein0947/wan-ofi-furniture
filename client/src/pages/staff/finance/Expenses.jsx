import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Check, Plus, X } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import ExportMenu from '../../../components/ExportMenu';
import ImagePicker from '../../../components/ui/ImagePicker';
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../../components/ui/misc';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { expensesApi } from '../../../api/endpoints';
import BranchSelect from '../../../components/BranchSelect';
import { fileUrl } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../../utils/constants';
import { date, label, money, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

function ExpenseModal({ open, onClose }) {
  const t = useT();
  const [receipt, setReceipt] = useState([]);
  const [branch, setBranch] = useState('');
  const form = useForm({ values: { category: 'UTILITIES', amount: '', date: toInputDate(new Date()), description: '', vendor: '', method: 'CASH', reference: '' } });
  const save = useMutationToast((body) => expensesApi.create(body, receipt), {
    success: (e) => (e.status === 'PENDING' ? 'Large expense submitted for owner approval' : 'Expense recorded'),
    invalidate: ['expenses', 'dashboard', 'transactions'],
    onSuccess: () => {
      form.reset();
      setReceipt([]);
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={t('Record expense')} footer={<Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ ...v, amount: Number(v.amount), branch: branch || undefined }))}>{t('Save expense')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('Category')} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(label(c)) }))} {...form.register('category')} />
        <Input label={t('Amount')} type="number" step="any" min="0" required error={form.formState.errors.amount && 'Enter an amount'} {...form.register('amount', { required: true, min: 0.01 })} />
        <Input label={t('Date')} type="date" {...form.register('date')} />
        <Select label={t('Paid via')} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(label(m)) }))} {...form.register('method')} />
        <Input label={t('Vendor / payee')} {...form.register('vendor')} />
        <Input label={t('Reference')} {...form.register('reference')} />
        <BranchSelect label={t('Branch')} placeholder={t('My branch')} value={branch} onChange={(e) => setBranch(e.target.value)} />
        <Textarea label={t('Description')} required containerClassName="sm:col-span-2" rows={2} error={form.formState.errors.description && 'Describe the expense'} {...form.register('description', { required: true, minLength: 3 })} />
        <div className="sm:col-span-2">
          <p className="label">{t('Receipt photo (optional)')}</p>
          <ImagePicker files={receipt} onChange={setReceipt} max={1} capture label={t('Receipt')} />
        </div>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const t = useT();
  const [params, set] = useListParams();
  const [search] = useSearchParams();
  const [creating, setCreating] = useState(search.get('record') === '1');
  const [rejecting, setRejecting] = useState(null);
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['expenses', params], queryFn: () => expensesApi.list(params), placeholderData: keepPreviousData });
  const decide = useMutationToast(({ id, approve, reason }) => expensesApi.decide(id, { approve, reason }), {
    success: (e) => `Expense ${t(label(e.status)).toLowerCase()}`,
    invalidate: ['expenses', 'dashboard'],
    onSuccess: () => setRejecting(null),
  });

  const columns = [
    { key: 'expenseNumber', header: 'Number', render: (e) => <span className="font-medium">{e.expenseNumber}</span> },
    { key: 'date', header: 'Date', render: (e) => date(e.date), exportValue: (e) => date(e.date) },
    { key: 'category', header: 'Category', render: (e) => t(label(e.category)), exportValue: (e) => e.category },
    { key: 'description', header: 'Description', render: (e) => <span className="block max-w-xs truncate">{e.description}</span>, exportValue: (e) => e.description },
    { key: 'vendor', header: 'Vendor', mobile: false },
    { key: 'branch', header: 'Branch', mobile: false, render: (e) => e.branch?.code || '—', exportValue: (e) => e.branch?.name },
    { key: 'method', header: 'Method', mobile: false, render: (e) => t(label(e.method)), exportValue: (e) => e.method },
    { key: 'amount', header: 'Amount', align: 'right', render: (e) => money(e.amount) },
    { key: 'createdBy', header: 'By', mobile: false, render: (e) => e.createdBy?.name, exportValue: (e) => e.createdBy?.name },
    {
      key: 'status',
      header: 'Status',
      export: false,
      render: (e) => (
        <span className="flex items-center gap-2">
          {e.status === 'PENDING' && can('expenses:approve') ? (
            <>
              <Button size="xs" variant="success" icon={Check} onClick={() => decide.mutate({ id: e._id, approve: true })}>
                {t('Approve')}
              </Button>
              <Button size="xs" variant="secondary" icon={X} onClick={() => setRejecting(e)}>
                {t('Reject')}
              </Button>
            </>
          ) : (
            <StatusBadge status={e.status} />
          )}
          {e.receiptImage && (
            <a href={fileUrl(e.receiptImage)} target="_blank" rel="noreferrer" className="text-xs text-walnut-700 underline">
              {t('Receipt')}
            </a>
          )}
        </span>
      ),
    },
  ];

  const total = (query.data?.items || []).filter((e) => e.status === 'APPROVED').reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title={t('Expenses')}
        subtitle={query.data && t('Approved on this page: {amount}', { amount: money(total) })}
        actions={
          <>
            <ExportMenu filename="expenses" title={t('Expenses')} columns={columns} rows={query.data?.items} />
            {can('expenses:write') && <Button icon={Plus} onClick={() => setCreating(true)}>{t('Record expense')}</Button>}
          </>
        }
      />
      <Tabs
        className="mb-4"
        value={params.status || ''}
        onChange={(status) => set({ status })}
        tabs={[
          { value: '', label: 'All' },
          { value: 'PENDING', label: 'Awaiting approval' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ]}
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(s) => set({ search: s })} placeholder={t('Description, vendor…')} className="sm:w-60" />
        <Select value={params.category || ''} onChange={(e) => set({ category: e.target.value })} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(label(c)) }))} placeholder={t('All categories')} aria-label={t('Category')} containerClassName="sm:w-44" />
        <BranchSelect label={undefined} value={params.branch || ''} onChange={(e) => set({ branch: e.target.value })} aria-label={t('Branch')} containerClassName="sm:w-44" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label={t('From')} containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} />
      <ExpenseModal open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={t('Reject expense?')} confirmLabel={t('Reject')} requireReason loading={decide.isPending} onConfirm={(reason) => decide.mutate({ id: rejecting._id, approve: false, reason })} />
    </div>
  );
}
