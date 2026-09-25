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

function IncomeModal({ open, onClose }) {
  const form = useForm({ values: { amount: '', method: 'CASH', date: toInputDate(new Date()), description: '' } });
  const save = useMutationToast((body) => accountingApi.income(body), { success: 'Income recorded', invalidate: ['transactions', 'dashboard'], onSuccess: onClose });
  return (
    <Modal open={open} onClose={onClose} title="Record other income" description="Income not linked to an order, e.g. selling offcuts or scrap." footer={<Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate({ ...v, amount: Number(v.amount) }))}>Save</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Amount" type="number" step="any" required {...form.register('amount', { required: true, min: 0.01 })} />
        <Select label="Method" options={PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) }))} {...form.register('method')} />
        <Input label="Date" type="date" {...form.register('date')} />
        <Textarea label="Description" required containerClassName="sm:col-span-2" rows={2} {...form.register('description', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}

export default function Ledger() {
  const [params, set] = useListParams();
  const [adding, setAdding] = useState(false);
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['transactions', params], queryFn: () => accountingApi.transactions(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'transactionNumber', header: 'Transaction', render: (t) => <span className="font-mono text-xs">{t.transactionNumber}</span> },
    { key: 'date', header: 'Date', render: (t) => dateTime(t.date), exportValue: (t) => dateTime(t.date) },
    { key: 'type', header: 'Type', render: (t) => <Badge tone={t.direction === 'IN' ? 'green' : t.direction === 'OUT' ? 'red' : 'stone'}>{label(t.type)}</Badge>, exportValue: (t) => t.type },
    { key: 'description', header: 'Description', render: (t) => <span className="block max-w-sm truncate">{t.description}</span>, exportValue: (t) => t.description },
    { key: 'party', header: 'Customer / supplier', mobile: false, render: (t) => t.customer?.name || t.supplier?.name || '—', exportValue: (t) => t.customer?.name || t.supplier?.name },
    { key: 'method', header: 'Method', mobile: false, render: (t) => (t.method ? label(t.method) : '—'), exportValue: (t) => t.method },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => (
        <span className={t.direction === 'IN' ? 'text-emerald-700' : t.direction === 'OUT' ? 'text-red-600' : 'text-stone-500'}>
          {t.direction === 'IN' ? '+' : t.direction === 'OUT' ? '−' : ''}
          {money(t.amount)}
        </span>
      ),
      exportValue: (t) => (t.direction === 'OUT' ? -t.amount : t.amount),
    },
    { key: 'createdBy', header: 'By', mobile: false, render: (t) => t.createdBy?.name, exportValue: (t) => t.createdBy?.name },
  ];
  return (
    <div>
      <PageHeader
        title="General ledger"
        subtitle="Every financial transaction. Entries are never edited — corrections are new entries."
        actions={
          <>
            <ExportMenu filename="ledger" title="General ledger" columns={columns} rows={query.data?.items} />
            {can('accounting:write') && <Button icon={Plus} onClick={() => setAdding(true)}>Other income</Button>}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(s) => set({ search: s })} placeholder="Number or description…" className="sm:w-60" />
        <Select value={params.type || ''} onChange={(e) => set({ type: e.target.value })} options={TRANSACTION_TYPES.map((t) => ({ value: t, label: label(t) }))} placeholder="All types" aria-label="Type" containerClassName="sm:w-48" />
        <Select value={params.direction || ''} onChange={(e) => set({ direction: e.target.value })} options={[{ value: 'IN', label: 'Money in' }, { value: 'OUT', label: 'Money out' }, { value: 'NONE', label: 'Non-cash' }]} placeholder="All directions" aria-label="Direction" containerClassName="sm:w-40" />
        <Select value={params.method || ''} onChange={(e) => set({ method: e.target.value })} options={PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) }))} placeholder="All methods" aria-label="Method" containerClassName="sm:w-40" />
        <Input type="date" value={params.from || ''} onChange={(e) => set({ from: e.target.value })} aria-label="From" containerClassName="sm:w-40" />
        <Input type="date" value={params.to || ''} onChange={(e) => set({ to: e.target.value })} aria-label="To" containerClassName="sm:w-40" />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} dense />
      <IncomeModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
