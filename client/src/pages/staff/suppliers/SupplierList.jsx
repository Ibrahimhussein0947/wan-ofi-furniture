import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Banknote, Plus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Checkbox, Input, Textarea } from '../../../components/ui/Field';
import { SupplierPaymentModal } from '../../../components/finance/PaymentModals';
import { suppliersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { money } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export function SupplierModal({ open, onClose, supplier }) {
  const t = useT();
  const form = useForm({
    values: {
      name: supplier?.name || '',
      contactPerson: supplier?.contactPerson || '',
      phone: supplier?.phone || '',
      email: supplier?.email || '',
      address: supplier?.address || '',
      materialsSupplied: (supplier?.materialsSupplied || []).join(', '),
      paymentTerms: supplier?.paymentTerms || '',
      notes: supplier?.notes || '',
    },
  });
  const save = useMutationToast((body) => (supplier ? suppliersApi.update(supplier._id, body) : suppliersApi.create(body)), { success: 'Supplier saved', invalidate: ['suppliers', 'supplier'], onSuccess: onClose });
  const submit = form.handleSubmit((v) =>
    save.mutate({
      ...v,
      materialsSupplied: v.materialsSupplied
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  );
  return (
    <Modal open={open} onClose={onClose} title={supplier ? 'Edit supplier' : 'New supplier'} size="lg" footer={<Button loading={save.isPending} onClick={submit}>{t('Save')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Name')} required {...form.register('name', { required: true })} />
        <Input label={t('Contact person')} {...form.register('contactPerson')} />
        <Input label={t('Phone')} {...form.register('phone')} />
        <Input label={t('Email')} type="email" {...form.register('email')} />
        <Input label={t('Address')} containerClassName="sm:col-span-2" {...form.register('address')} />
        <Input label={t('Materials supplied')} hint={t('Comma separated')} {...form.register('materialsSupplied')} />
        <Input label={t('Payment terms')} placeholder="e.g. Net 30" {...form.register('paymentTerms')} />
        <Textarea label={t('Notes')} containerClassName="sm:col-span-2" rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

export default function SupplierList() {
  const t = useT();
  const [params, set] = useListParams();
  const [modal, setModal] = useState(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['suppliers', params], queryFn: () => suppliersApi.list(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'name', header: 'Supplier', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'contactPerson', header: 'Contact', mobile: false },
    { key: 'phone', header: 'Phone' },
    { key: 'materialsSupplied', header: 'Supplies', mobile: false, render: (s) => (s.materialsSupplied || []).join(', '), exportValue: (s) => (s.materialsSupplied || []).join('; ') },
    { key: 'paymentTerms', header: 'Terms', mobile: false },
    { key: 'balance', header: 'We owe', align: 'right', render: (s) => <span className={s.balance > 0 ? 'font-semibold text-red-600' : 'text-stone-400'}>{money(s.balance)}</span> },
  ];
  return (
    <div>
      <PageHeader
        title={t('Suppliers')}
        actions={
          <>
            <ExportMenu filename="suppliers" title={t('Suppliers')} columns={columns} rows={query.data?.items} />
            {can('payments:write') && <Button variant="secondary" icon={Banknote} onClick={() => setModal('pay')}>{t('Pay supplier')}</Button>}
            {can('suppliers:write') && <Button icon={Plus} onClick={() => setModal('new')}>{t('New supplier')}</Button>}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder={t('Name, phone, material…')} className="sm:w-72" />
        <Checkbox label={t('With outstanding balance')} checked={params.withBalance === 'true'} onChange={(e) => set({ withBalance: e.target.checked ? 'true' : '' })} />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={(s) => navigate(`/app/suppliers/${s._id}`)} />
      <SupplierModal open={modal === 'new'} onClose={() => setModal(null)} />
      <SupplierPaymentModal open={modal === 'pay'} onClose={() => setModal(null)} />
    </div>
  );
}
