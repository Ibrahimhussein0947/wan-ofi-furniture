import { useForm } from 'react-hook-form';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { inventoryApi } from '../../../api/endpoints';
import useMutationToast from '../../../hooks/useMutationToast';
import { useT } from '../../../i18n/LanguageContext';

const TYPES = [
  { value: 'STOCK_IN', label: 'Stock in (add)' },
  { value: 'STOCK_OUT', label: 'Stock out (remove)' },
  { value: 'DAMAGED', label: 'Damaged / write-off' },
  { value: 'RETURN', label: 'Customer return (add)' },
  { value: 'ADJUSTMENT', label: 'Correction (+/−)' },
];

/** Every manual stock change goes through here and is recorded as an inventory transaction. */
export default function StockAdjustModal({ open, onClose, item, itemType, branches = [], defaultBranch }) {
  const t = useT();
  const form = useForm({ values: { type: 'STOCK_IN', quantity: '', unitCost: '', note: '', branch: defaultBranch || branches[0]?._id || '' } });
  const type = form.watch('type');
  const save = useMutationToast((body) => inventoryApi.adjust(body), {
    success: (updated) => `Stock updated — now ${updated.quantity}`,
    invalidate: ['inventory', 'materials', 'material', 'products', 'dashboard'],
    onSuccess: () => {
      form.reset();
      onClose();
    },
  });
  const submit = form.handleSubmit((v) =>
    save.mutate({ itemType, itemId: item._id, type: v.type, quantity: Number(v.quantity), unitCost: v.unitCost ? Number(v.unitCost) : undefined, note: v.note, branch: v.branch || undefined })
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adjust stock — ${item?.name}`}
      description={`Current: ${item?.quantity} ${item?.unit || 'units'}`}
      footer={
        <Button loading={save.isPending} onClick={submit}>
          {t('Record stock change')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Select label={t('Type')} options={TYPES} {...form.register('type')} />
        {branches.length > 1 && (
          <Select
            label={t('Branch')}
            options={branches.map((b) => ({ value: b._id, label: `${b.name} (${item?.branchStock?.find((s) => s.branch === b._id)?.quantity || 0} now)` }))}
            {...form.register('branch')}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={type === 'ADJUSTMENT' ? 'Change (use − to reduce)' : 'Quantity'}
            type="number"
            step="any"
            required
            error={form.formState.errors.quantity && 'Enter a non-zero quantity'}
            {...form.register('quantity', { validate: (v) => Number(v) !== 0 && !Number.isNaN(Number(v)) })}
          />
          {type === 'STOCK_IN' && <Input label={t('Unit cost (optional)')} type="number" step="any" {...form.register('unitCost')} />}
        </div>
        <Textarea label={t('Reason')} required rows={2} error={form.formState.errors.note && 'A reason is required for the audit trail'} {...form.register('note', { required: true, minLength: 3 })} />
      </div>
    </Modal>
  );
}
