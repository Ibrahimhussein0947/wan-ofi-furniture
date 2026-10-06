import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { accountingApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../../../utils/constants';
import { dateTime, label, money, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

function IncomeModal({ open, onClose }) {
  const t = useT();
  const form = useForm({ values: { amount: '', method: 'CASH', date: toInputDate(new Date()), description: '' } });
  const save = useMutationToast((body) => accountingApi.income(body), { success: 'Income recorded', invalidate: ['transactions', 'dashboard'], onSuccess: onClose });
  return (
    <Modal open={open} onClose={onClose} title={t('Record other income')} description={t('Income not linked to an order, e.g. selling offcuts or scrap.')} footer={<Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ ...v, amount: Number(v.amount) }))}>{t('Save')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Amount')} type="number" step="any" required {...form.register('amount', { required: true, min: 0.01 })} />
        <Select label={t('Method')} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(label(m)) }))} {...form.register('method')} />
        <Input label={t('Date')} type="date" {...form.register('date')} />
        <Textarea label={t('Description')} required containerClassName="sm:col-span-2" rows={2} {...form.register('description', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}

export default function Ledger() {
  const t = useT();
  const [params, set] = useListParams();
  const [adding, setAdding] = useState(false);
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['transactions', params], queryFn: () => accountingApi.transactions(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'transactionNumber', header: 'Transaction', render: (tx) => <span className="font-mono text-xs">{tx.transactionNumber}</span> },
    { key: 'date', header: 'Date', render: (tx) => dateTime(tx.date), exportValue: (tx) => dateTime(tx.date) },
    { key: 'type', header: 'Type', render: (tx) => <Badge tone={tx.direction === 'IN' ? 'green' : tx.direction === 'OUT' ? 'red' : 'stone'}>{t(label(tx.type))}</Badge>, exportValue: (tx) => tx.type },
    { key: 'description', header: 'Description', render: (tx) => <span className="block max-w-sm truncate">{tx.description}</span>, exportValue: (tx) => tx.description },
    { key: 'party', header: 'Customer / supplier', mobile: false, render: (tx) => tx.customer?.name || tx.supplier?.name || '—', exportValue: (tx) => tx.customer?.name || tx.supplier?.name },
    { key: 'method', header: 'Method', mobile: false, render: (tx) => (tx.method ? t(label(tx.method)) : '—'), exportValue: (tx) => tx.method },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (tx) => (
        <span className={tx.direction === 'IN' ? 'text-emerald-700' : tx.direction === 'OUT' ? 'text-red-600' : 'text-stone-500'}>
          {tx.direction === 'IN' ? '+' : tx.direction === 'OUT' ? '−' : ''}
          {money(tx.amount)}
        </span>
      ),
      exportValue: (tx) => (tx.direction === 'OUT' ? -tx.amount : tx.amount),
    },
    { key: 'createdBy', header: 'By', mobile: false, render: (tx) => tx.createdBy?.name, exportValue: (tx) => tx.createdBy?.name },
  ];
  return (
    <div>
      <PageHeader
        title={t('General ledger')}
        subtitle={t('Every financial transaction. Entries are never edited — corrections are new entries.')}
        actions={
          <>
            <ExportMenu filename="ledger" title={t('General ledger')} columns={columns} rows={query.data?.items} />
            {can('accounting:write') && <Button icon={Plus} onClick={() => setAdding(true)}>{t('Other income')}</Button>}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(s) => set({ search: s })} placeholder={t('Number or description…')} className="sm:w-60" />
        <Select value={params.type || ''} onChange={(e) => set({ type: e.target.value })} options={TRANSACTION_TYPES.map((type) => ({ value: type, label: t(label(type)) }))} placeholder={t('All types')} aria-label={t('Type')} containerClassName="sm:w-48" />
        <Select value={params.direction || ''} onChange={(e) => set({ direction: e.target.value })} options={[{ value: 'IN', label: 'Money in' }, { value: 'OUT', label: 'Money out' }, { value: 'NONE', label: 'Non-cash' }]} placeholder={t('All directions')} aria-label={t('Direction')} containerClassName="sm:w-40" />
        <Select value={params.method || ''} onChange={(e) => set({ method: e.target.value })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(label(m)) }))} placeholder={t('All methods')} aria-label={t('Method')} containerClassName="sm:w-40" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label={t('From')} containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} dense />
      <IncomeModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
