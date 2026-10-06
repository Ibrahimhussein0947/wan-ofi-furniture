import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ExportMenu from '../../../components/ExportMenu';
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { materialsApi, suppliersApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import useListParams from '../../../hooks/useListParams';
import useMutationToast from '../../../hooks/useMutationToast';
import { MATERIAL_CATEGORIES } from '../../../utils/constants';
import { date, label, money, number, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export function MaterialModal({ open, onClose, material }) {
  const t = useT();
  const { can } = useAuth();
  const suppliers = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => suppliersApi.list({ limit: 100 }).then((r) => r.items), enabled: open && can('suppliers:read') });
  const form = useForm({
    values: {
      name: material?.name || '',
      code: material?.code || '',
      category: material?.category || 'WOOD',
      unit: material?.unit || 'piece',
      quantity: '',
      minStock: material?.minStock ?? 0,
      reorderQuantity: material?.reorderQuantity || '',
      unitCost: material?.unitCost ?? 0,
      supplier: material?.supplier?._id || material?.supplier || '',
      expirationDate: toInputDate(material?.expirationDate),
      location: material?.location || '',
      notes: material?.notes || '',
    },
  });
  const save = useMutationToast((body) => (material ? materialsApi.update(material._id, body) : materialsApi.create(body)), { success: 'Material saved', invalidate: ['materials', 'material', 'inventory'], onSuccess: onClose });
  const submit = form.handleSubmit(({ quantity, ...v }) =>
    save.mutate({ ...v, minStock: Number(v.minStock), reorderQuantity: Number(v.reorderQuantity) || 0, unitCost: Number(v.unitCost), supplier: v.supplier || null, expirationDate: v.expirationDate || undefined, ...(!material && { quantity: Number(quantity) || 0 }) })
  );
  return (
    <Modal open={open} onClose={onClose} title={material ? 'Edit material' : 'New material'} size="lg" footer={<Button loading={save.isPending} onClick={submit}>{t('Save')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('Name')} required {...form.register('name', { required: true })} />
        <Input label={t('Code')} {...form.register('code')} />
        <Select label={t('Category')} options={MATERIAL_CATEGORIES.map((c) => ({ value: c, label: t(label(c)) }))} {...form.register('category')} />
        <Input label={t('Unit')} placeholder="piece, sheet, metre, litre…" required {...form.register('unit', { required: true })} />
        {!material && <Input label={t('Opening stock')} type="number" step="any" min="0" hint={t('Recorded as a stock-in')} {...form.register('quantity')} />}
        <Input label={t('Minimum stock')} type="number" step="any" min="0" {...form.register('minStock')} />
        <Input label={t('Reorder quantity')} type="number" step="any" min="0" hint={t('How much to buy when low. Empty = top up to twice the minimum')} {...form.register('reorderQuantity')} />
        <Input label={t('Unit cost')} type="number" step="any" min="0" {...form.register('unitCost')} />
        <Select label={t('Main supplier')} placeholder={t('None')} options={(suppliers.data || []).map((s) => ({ value: s._id, label: s.name }))} {...form.register('supplier')} />
        <Input label={t('Expiry date (if applicable)')} type="date" {...form.register('expirationDate')} />
        <Input label={t('Storage location')} {...form.register('location')} />
        <Textarea label={t('Notes')} containerClassName="sm:col-span-2" rows={2} {...form.register('notes')} />
      </div>
    </Modal>
  );
}

export default function Materials() {
  const t = useT();
  const [params, set] = useListParams();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();
  const query = useQuery({ queryKey: ['materials', params], queryFn: () => materialsApi.list(params), placeholderData: keepPreviousData });
  const columns = [
    { key: 'name', header: 'Material', render: (m) => <span className="font-medium">{m.name}</span> },
    { key: 'code', header: 'Code', mobile: false },
    { key: 'category', header: 'Category', render: (m) => t(label(m.category)), exportValue: (m) => m.category },
    { key: 'quantity', header: 'In stock', align: 'right', render: (m) => <span className={m.isLowStock ? 'font-semibold text-red-600' : ''}>{number(m.quantity)} {m.unit}</span>, exportValue: (m) => m.quantity },
    { key: 'minStock', header: 'Minimum', align: 'right', mobile: false },
    { key: 'unitCost', header: 'Unit cost', align: 'right', render: (m) => money(m.unitCost) },
    { key: 'supplier', header: 'Supplier', mobile: false, render: (m) => m.supplier?.name || '—', exportValue: (m) => m.supplier?.name },
    { key: 'purchaseDate', header: 'Last purchase', mobile: false, render: (m) => date(m.purchaseDate), exportValue: (m) => date(m.purchaseDate) },
    { key: 'low', header: '', export: false, render: (m) => m.isLowStock && <Badge tone="red">{t('Low stock')}</Badge> },
  ];
  return (
    <div>
      <PageHeader
        title={t('Raw materials')}
        actions={
          <>
            <ExportMenu filename="materials" title={t('Raw materials')} columns={columns} rows={query.data?.items} />
            {can('materials:write') && <Button icon={Plus} onClick={() => setCreating(true)}>{t('New material')}</Button>}
          </>
        }
      />
      <FilterBar>
        <SearchInput value={params.search} onChange={(search) => set({ search })} placeholder={t('Name or code…')} className="sm:w-72" />
        <Select value={params.category || ''} onChange={(e) => set({ category: e.target.value })} options={MATERIAL_CATEGORIES.map((c) => ({ value: c, label: t(label(c)) }))} placeholder={t('All categories')} aria-label={t('Category')} containerClassName="sm:w-44" />
        <Checkbox label={t('Low stock only')} checked={params.lowStock === 'true'} onChange={(e) => set({ lowStock: e.target.checked ? 'true' : '' })} />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} onRowClick={(m) => navigate(`/app/materials/${m._id}`)} />
      <MaterialModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
