import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Pencil, Plus } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input, Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { promotionsApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { date, money, toInputDate } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

function PromotionModal({ open, onClose, promotion }) {
  const t = useT();
  const editing = Boolean(promotion?._id);
  const form = useForm({
    values: {
      code: promotion?.code || '',
      description: promotion?.description || '',
      type: promotion?.type || 'PERCENT',
      value: promotion?.value ?? '',
      maxDiscount: promotion?.maxDiscount || '',
      minSubtotal: promotion?.minSubtotal || '',
      startsAt: toInputDate(promotion?.startsAt),
      endsAt: toInputDate(promotion?.endsAt),
      usageLimit: promotion?.usageLimit || '',
      perCustomerLimit: promotion?.perCustomerLimit ?? 1,
      isActive: promotion?.isActive ?? true,
    },
  });
  const save = useMutationToast((body) => (editing ? promotionsApi.update(promotion._id, body) : promotionsApi.create(body)), {
    success: 'Promo code saved',
    invalidate: ['promotions'],
    onSuccess: onClose,
  });
  const type = form.watch('type');
  const { errors } = form.formState;

  const submit = form.handleSubmit((v) =>
    save.mutate({
      code: v.code,
      description: v.description,
      type: v.type,
      value: num(v.value),
      maxDiscount: num(v.maxDiscount) ?? 0,
      minSubtotal: num(v.minSubtotal) ?? 0,
      startsAt: v.startsAt || null,
      endsAt: v.endsAt || null,
      usageLimit: num(v.usageLimit) ?? 0,
      perCustomerLimit: num(v.perCustomerLimit) ?? 0,
      isActive: v.isActive,
    })
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${promotion.code}` : 'New promo code'} size="lg" footer={<Button loading={save.isPending} onClick={submit}>{t('Save')}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('Code')}
          required
          hint={t('What customers type, e.g. HOLIDAY10')}
          className="uppercase"
          error={errors.code && '3–30 letters, numbers, dashes or underscores'}
          {...form.register('code', { required: true, pattern: /^[A-Za-z0-9_-]{3,30}$/ })}
        />
        <Select label={t('Discount type')} options={[{ value: 'PERCENT', label: 'Percentage of the order' }, { value: 'FIXED', label: 'Fixed amount' }]} {...form.register('type')} />
        <Input label={type === 'PERCENT' ? 'Percentage (%)' : 'Amount off'} type="number" min="0" max={type === 'PERCENT' ? 100 : undefined} step="any" required error={errors.value && 'Required'} {...form.register('value', { required: true })} />
        {type === 'PERCENT' ? (
          <Input label={t('Maximum discount')} type="number" min="0" hint={t('Leave empty for no cap')} {...form.register('maxDiscount')} />
        ) : (
          <span className="hidden sm:block" />
        )}
        <Input label={t('Minimum order subtotal')} type="number" min="0" hint={t('Leave empty for any order')} {...form.register('minSubtotal')} />
        <Input label={t('Description')} hint={t('Shown to customers when the code is applied')} {...form.register('description')} />
        <Input label={t('Starts')} type="date" {...form.register('startsAt')} />
        <Input label={t('Ends')} type="date" {...form.register('endsAt')} />
        <Input label={t('Total uses allowed')} type="number" min="0" hint={t('Leave empty for unlimited')} {...form.register('usageLimit')} />
        <Input label={t('Uses per customer')} type="number" min="0" hint="0 = unlimited" {...form.register('perCustomerLimit')} />
        <Checkbox label={t('Active')} {...form.register('isActive')} />
      </div>
    </Modal>
  );
}

function statusOf(p, t) {
  const now = new Date();
  if (!p.isActive) return <Badge>{t('Inactive')}</Badge>;
  if (p.endsAt && new Date(p.endsAt) < now) return <Badge tone="red">{t('Expired')}</Badge>;
  if (p.startsAt && new Date(p.startsAt) > now) return <Badge tone="blue">{t('Scheduled')}</Badge>;
  if (p.usageLimit && p.uses >= p.usageLimit) return <Badge tone="amber">{t('Used up')}</Badge>;
  return <Badge tone="green">{t('Active')}</Badge>;
}

export default function Promotions() {
  const t = useT();
  const [editing, setEditing] = useState(null);
  const query = useQuery({ queryKey: ['promotions'], queryFn: promotionsApi.list });

  return (
    <div>
      <PageHeader
        title={t('Promo codes')}
        subtitle={t('Discount codes customers enter at checkout. A cancelled order gives its use back.')}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>{t('New promo code')}</Button>}
      />
      <DataTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data}
        columns={[
          {
            key: 'code',
            header: 'Code',
            render: (p) => (
              <span>
                <span className="font-mono font-semibold text-stone-900">{p.code}</span>
                {p.description && <span className="block text-xs text-stone-500">{p.description}</span>}
              </span>
            ),
          },
          { key: 'value', header: 'Discount', render: (p) => (p.type === 'PERCENT' ? `${p.value}%${p.maxDiscount ? ` (max ${money(p.maxDiscount)})` : ''}` : money(p.value)) },
          { key: 'minSubtotal', header: 'Min. order', align: 'right', mobile: false, render: (p) => (p.minSubtotal ? money(p.minSubtotal) : '—') },
          { key: 'period', header: 'Valid', mobile: false, render: (p) => (p.startsAt || p.endsAt ? `${p.startsAt ? date(p.startsAt) : '…'} – ${p.endsAt ? date(p.endsAt) : '…'}` : 'Always') },
          { key: 'uses', header: 'Uses', align: 'right', render: (p) => `${p.uses}${p.usageLimit ? ` / ${p.usageLimit}` : ''}` },
          { key: 'discountGiven', header: 'Discount given', align: 'right', mobile: false, render: (p) => money(p.discountGiven) },
          { key: 'status', header: 'Status', render: (p) => statusOf(p, t) },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (p) => (
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(p)} aria-label={`Edit ${p.code}`}>
                {t('Edit')}
              </Button>
            ),
          },
        ]}
      />
      {editing && <PromotionModal open onClose={() => setEditing(null)} promotion={editing} />}
    </div>
  );
}
